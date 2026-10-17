"""Four fixed project operations. This is an interface guard, not an OS sandbox."""
from __future__ import annotations

import contextlib
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import stat
import subprocess
import time

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
HERE = ROOT / '.tools/blender-mcp'
BLENDER = ROOT / '.tools/blender-4.5.14-windows-x64/blender.exe'
BUILD = ROOT / 'prototype-3d/blender/build-lock.py'
SPEC = ROOT / 'prototype-3d/spec.json'
BLEND = ROOT / 'prototype-3d/assets/lock.blend'
ACTION = SOURCE / 'blender_action.py'
REVIEW = SOURCE / 'reviewed-inputs.json'
PREVIEW = ROOT / 'prototype-3d/mcp-preview'
CAMERAS = ('overview', 'section', 'end', 'detail', 'rear')
PART_IDS = ('shell-back', 'shell-front', 'plug-back', 'plug-front',
            *[f'lower-{i}' for i in range(1, 6)],
            *[f'driver-{i}' for i in range(1, 6)],
            *[f'spring-{i}' for i in range(1, 6)],
            'key-correct', 'key-wrong', 'key-blank', 'cam', 'base')


def checked(path: Path, *, exists: bool = True) -> Path:
    """Reject traversal, siblings, symlinks/junctions and any resolved escape."""
    path = Path(path)
    if '..' in path.parts:
        raise ValueError('Path traversal is not accepted')
    lexical = Path(os.path.abspath(path))
    root_abs = Path(os.path.abspath(ROOT))
    if not lexical.is_relative_to(root_abs):
        raise ValueError('Path is outside this project')
    if not path.resolve(strict=exists).is_relative_to(root_abs):
        raise ValueError('Resolved path is outside this project')
    for ancestor in (lexical, *lexical.parents):
        if not ancestor.is_relative_to(root_abs):
            break
        if ancestor.exists() and (ancestor.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT):
            raise ValueError('Reparse points are not accepted')
    if exists and not lexical.exists():
        raise ValueError('Required project path is missing')
    return lexical


def digest(path: Path) -> str:
    return hashlib.sha256(checked(path).read_bytes()).hexdigest()


def reviewed() -> dict:
    return json.loads(checked(REVIEW).read_text(encoding='utf-8'))


def verify_source() -> dict:
    allow = reviewed()
    for key, path in [('build', BUILD), ('spec', SPEC), ('action', ACTION)]:
        if digest(path) != allow['sha256'][key]:
            raise ValueError(f'{key} changed after review; review and update reviewed-inputs.json locally')
    return allow


def environment() -> dict[str, str]:
    # Deliberately do not forward API keys, Python module paths or user Blender preferences.
    system_root = os.environ.get('SYSTEMROOT', r'C:\Windows')
    result = {'SYSTEMROOT': system_root, 'WINDIR': os.environ.get('WINDIR', system_root),
              'SYSTEMDRIVE': os.environ.get('SYSTEMDRIVE', Path(system_root).drive),
              'PATH': os.pathsep.join((str(BLENDER.parent), str(Path(system_root) / 'System32'), system_root))}
    local = {
        'BLENDER_USER_RESOURCES': HERE / 'runtime',
        'BLENDER_USER_CONFIG': HERE / 'runtime/config',
        'BLENDER_USER_SCRIPTS': HERE / 'runtime/scripts',
        'BLENDER_USER_DATAFILES': HERE / 'runtime/datafiles',
        'TEMP': HERE / 'temp', 'TMP': HERE / 'temp',
        'XDG_CACHE_HOME': HERE / 'cache', 'APPDATA': HERE / 'runtime/appdata',
        'LOCALAPPDATA': HERE / 'runtime/localappdata',
        'USERPROFILE': HERE / 'runtime/profile',
    }
    for name, path in local.items():
        checked(path, exists=False).mkdir(parents=True, exist_ok=True)
        result[name] = str(path)
    result.update(PYTHONDONTWRITEBYTECODE='1', PYTHONNOUSERSITE='1', PYTHONUNBUFFERED='1')
    return result


@contextlib.contextmanager
def exclusive():
    """One Blender operation at a time, including across MCP server processes."""
    import msvcrt
    lock_path = checked(HERE / 'operation.lock', exists=False)
    with lock_path.open('a+b') as handle:
        if lock_path.stat().st_size == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise RuntimeError('Another project Blender operation is running') from exc
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def command(action: str, camera: str = 'overview') -> list[str]:
    if action not in ('inspect', 'render', 'rebuild') or camera not in CAMERAS:
        raise ValueError('Unknown fixed operation or camera')
    source = BUILD if action == 'rebuild' else ACTION
    args = [str(checked(BLENDER)), '--background', '--factory-startup', '--disable-autoexec',
            '--python-exit-code', '1', '--python', str(checked(source))]
    if action != 'rebuild':
        args += ['--', action, camera]
    return args


def run_blender(action: str, camera: str = 'overview') -> dict:
    with exclusive():
        allow = verify_source()
        if action != 'rebuild' and digest(BLEND) != allow['sha256']['blend']:
            raise ValueError('The fixed lock.blend changed after review')
        for path in (ROOT / 'prototype-3d/assets', ROOT / '.tools/blender-temp',
                     ROOT / 'prototype-3d/assets/lock.blend', ROOT / 'prototype-3d/assets/lock.blend1',
                     ROOT / 'prototype-3d/assets/lock.glb', ROOT / 'prototype-3d/assets/lock-preview.png',
                     ROOT / 'prototype-3d/assets/asset-manifest.json'):
            checked(path, exists=False)
        # Blender may rotate numbered .blend backups. Refuse links for every
        # existing numbered backup, not just the usual lock.blend1 target.
        for path in checked(ROOT / 'prototype-3d/assets').iterdir():
            if '.blend' in path.name and path.name.rsplit('.blend', 1)[1].isdigit():
                checked(path, exists=False)
        output = checked(PREVIEW / f'lock-{camera}.png', exists=False)
        checked(PREVIEW, exists=False).mkdir(parents=True, exist_ok=True)
        args = command(action, camera)
        log = checked(HERE / 'logs' / f'{action}-{camera}.log', exists=False)
        start = time.monotonic()
        with log.open('wb') as stream:
            proc = subprocess.run(args, cwd=str(checked(ROOT)), env=environment(),
                                  stdin=subprocess.DEVNULL, stdout=stream, stderr=subprocess.STDOUT,
                                  timeout=300 if action == 'rebuild' else 120,
                                  shell=False, creationflags=subprocess.CREATE_NO_WINDOW)
        data = log.read_bytes()
        if proc.returncode:
            raise RuntimeError(f'Blender failed ({proc.returncode}); see project log {log}')
        lines = data.decode('utf-8', errors='replace').splitlines()
        payload = next((json.loads(line.removeprefix('PROJECT_BLENDER_RESULT '))
                        for line in lines if line.startswith('PROJECT_BLENDER_RESULT ')), None)
        if action == 'rebuild':
            # Only the exact reviewed generator can produce an updated native scene.
            allow['sha256']['blend'] = digest(BLEND)
            checked(REVIEW).write_text(json.dumps(allow, indent=2) + '\n', encoding='utf-8')
            payload = {'status': 'rebuilt', 'blend': str(BLEND), 'generatorSha256': digest(BUILD)}
        if payload is None:
            raise RuntimeError('Blender returned no structured project result')
        payload.update(elapsedSeconds=round(time.monotonic() - start, 2), log=str(log))
        if action == 'render':
            if not checked(output).read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
                raise RuntimeError('Expected a project PNG preview')
            payload.update(path=str(output), sha256=digest(output))
        return payload


def validate_arguments(name: str, arguments: dict | None) -> str:
    if name not in ('status', 'inspect_lock', 'rebuild_lock', 'render_preview'):
        raise ValueError('Unknown project tool')
    arguments = {} if arguments is None else arguments
    if not isinstance(arguments, dict):
        raise ValueError('Arguments must be an object')
    permitted = {'camera'} if name == 'render_preview' else set()
    if set(arguments) - permitted:
        raise ValueError('Arbitrary code, paths, commands and extra arguments are not accepted')
    camera = arguments.get('camera', 'overview')
    if not isinstance(camera, str) or camera not in CAMERAS:
        raise ValueError('Camera must be one of the fixed project presets')
    return camera


def dispatch(name: str, arguments: dict | None) -> dict:
    camera = validate_arguments(name, arguments)
    if name == 'status':
        allow = verify_source()
        return {'server': 'project_blender', 'implementation': 'project-owned restricted stdio bridge',
                'mcpSdkVersion': importlib.metadata.version('mcp'), 'project': str(ROOT),
                'blender': str(checked(BLENDER)), 'cameras': list(CAMERAS),
                'reviewedGeneratorSha256': allow['sha256']['build'],
                'nativeSceneMatchesReview': digest(BLEND) == allow['sha256']['blend'],
                'arbitraryCode': False, 'arbitraryPaths': False, 'networkListener': False,
                'osSandbox': False, 'rebuildTriggered': False}
    return run_blender({'inspect_lock': 'inspect', 'rebuild_lock': 'rebuild', 'render_preview': 'render'}[name], camera)
