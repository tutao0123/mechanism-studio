"""Real stdio client test and meaningful scope/immutability checks. No rebuild."""
import asyncio
from datetime import timedelta
import hashlib
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from operations import ROOT, SOURCE, HERE, BLEND, BUILD, ACTION, SPEC, REVIEW, checked, command, digest, dispatch, exclusive, validate_arguments


def snapshot():
    paths = [*sorted((ROOT / 'prototype-3d/assets').rglob('*')),
             *sorted((ROOT / 'prototype-3d/voice').rglob('*'))]
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in paths if p.is_file()}


class ScopeTests(unittest.TestCase):
    def test_scope_rejects_outside_sibling_and_traversal(self):
        for path in (ROOT.parent / 'outside.txt', ROOT.parent / 'anatomy-reference' / 'x',
                     ROOT.parent / (ROOT.name + '-other') / 'x',
                     ROOT / '..' / 'outside.txt'):
            with self.assertRaises(ValueError):
                checked(path, exists=False)
        self.assertEqual(checked(BLEND), BLEND)

    def test_all_free_code_path_command_arguments_rejected(self):
        for name in ('status', 'inspect_lock', 'rebuild_lock', 'render_preview'):
            for key in ('code', 'filepath', 'command', 'script', 'host'):
                with self.assertRaises(ValueError):
                    validate_arguments(name, {key: 'anything'})

    def test_camera_and_tool_are_closed_enums(self):
        for arguments in ({'camera': '../outside'}, {'camera': 'arbitrary'}, {'camera': 1}):
            with self.assertRaises(ValueError):
                validate_arguments('render_preview', arguments)
        with self.assertRaises(ValueError):
            validate_arguments('execute_code', {})

    def test_fixed_rebuild_command_without_execution(self):
        argv = command('rebuild')
        self.assertIn('--disable-autoexec', argv)
        self.assertEqual(argv[-1], str(BUILD))
        self.assertNotIn('powershell', argv)
        self.assertEqual(dispatch('status', {})['rebuildTriggered'], False)

    def test_concurrent_operation_rejected(self):
        with exclusive():
            with self.assertRaises(RuntimeError):
                with exclusive():
                    pass

    def test_changed_generator_is_blocked_before_blender_starts(self):
        real_digest = digest
        with patch('operations.digest', side_effect=lambda path: 'unreviewed' if path == BUILD else real_digest(path)):
            with self.assertRaisesRegex(ValueError, 'build changed after review'):
                dispatch('rebuild_lock', {})


def payload(result):
    assert not result.isError, result
    return json.loads(next(item.text for item in result.content if item.type == 'text'))


async def protocol_check():
    before = snapshot()
    params = StdioServerParameters(command=sys.executable, args=['-B', str(SOURCE / 'server.py')],
                                   cwd=str(ROOT), env={
                                       'SYSTEMROOT': os.environ.get('SYSTEMROOT', r'C:\Windows'),
                                       'TEMP': str(HERE / 'temp'), 'TMP': str(HERE / 'temp'),
                                       'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONNOUSERSITE': '1'})
    with (HERE / 'logs/protocol-stderr.log').open('w', encoding='utf-8') as log:
        async with stdio_client(params, errlog=log) as (read, write):
            async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=150)) as session:
                init = await session.initialize()
                tools = await session.list_tools()
                names = sorted(tool.name for tool in tools.tools)
                assert names == ['inspect_lock', 'rebuild_lock', 'render_preview', 'status'], names
                assert all(tool.inputSchema['additionalProperties'] is False for tool in tools.tools)
                status = payload(await session.call_tool('status', {}))
                assert status['nativeSceneMatchesReview'] and status['arbitraryCode'] is False
                inspection = payload(await session.call_tool('inspect_lock', {}))
                assert inspection['partCount'] == 24 and inspection['meshCount'] == 24
                negatives = []
                for name, arguments in [('render_preview', {'camera': '../outside'}),
                                        ('render_preview', {'camera': 'free-camera'}),
                                        ('render_preview', {'filepath': str(ROOT.parent / 'outside.png')}),
                                        ('inspect_lock', {'code': 'print(123)'}),
                                        ('rebuild_lock', {'command': 'calc.exe'}),
                                        ('execute_code', {'code': 'print(123)'})]:
                    denied = await session.call_tool(name, arguments)
                    assert denied.isError, (name, arguments, denied)
                    negatives.append({'tool': name, 'arguments': arguments, 'rejected': True})
                rendered = payload(await session.call_tool('render_preview', {'camera': 'overview'}))
                assert rendered['samples'] == 4 and checked(Path(rendered['path'])).exists()
                assert snapshot() == before, 'Inspection/render changed existing assets or voice files'
                report = {'protocolVersion': init.protocolVersion, 'server': init.serverInfo.model_dump(),
                          'tools': names, 'status': status, 'inspection': inspection,
                          'render': rendered, 'negativeProtocolChecks': negatives,
                          'existingAssetAndVoiceFilesUnchanged': True,
                          'assetAndVoiceSha256': before,
                          'parentAndReferenceSiblingDenied': True,
                          'rebuildExecuted': False, 'osSandbox': False}
                (HERE / 'logs/protocol-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
                print(json.dumps({k: v for k, v in report.items() if k not in ('status', 'inspection')}, indent=2))


if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ScopeTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
    asyncio.run(protocol_check())
