"""Project-owned Blender MCP; stdin/stdout only, four narrowly defined tools."""
import asyncio
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool, ToolAnnotations
from operations import CAMERAS, dispatch

server = Server('project_blender', version='0.1.0')


@server.list_tools()
async def list_tools():
    definitions = (
        ('status', 'Read this project bridge status and reviewed input checksums. No Blender process is started.', True),
        ('inspect_lock', 'Read the fixed project lock.blend in background Blender with autoexec disabled; return its real 24 semantic parts.', True),
        ('rebuild_lock', 'Explicitly rebuild project assets using only the fixed checksum-reviewed build-lock.py. Overwrites the project lock.blend, lock.glb and original build preview. No arbitrary code or paths.', False),
        ('render_preview', 'Render the fixed project lock.blend at 4 CPU samples using one of five camera presets; write only prototype-3d/mcp-preview/lock-{camera}.png. Does not save the source scene or change website/voice assets.', False),
    )
    return [Tool(name=name, description=description,
                 inputSchema={'type': 'object', 'properties':
                              {'camera': {'type': 'string', 'enum': list(CAMERAS), 'default': 'overview'}}
                              if name == 'render_preview' else {}, 'additionalProperties': False},
                 annotations=ToolAnnotations(readOnlyHint=read_only, destructiveHint=name == 'rebuild_lock',
                                             openWorldHint=False))
            for name, description, read_only in definitions]


@server.call_tool()
async def call_tool(name: str, arguments: dict | None):
    # Dispatch also rejects extra arguments; do not rely solely on client JSON schema validation.
    result = await asyncio.to_thread(dispatch, name, arguments)
    return [TextContent(type='text', text=json.dumps(result, ensure_ascii=False, indent=2))]


async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == '__main__':
    asyncio.run(main())
