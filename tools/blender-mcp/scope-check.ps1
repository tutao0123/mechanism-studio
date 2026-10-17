$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskSourceRoot = $PSScriptRoot
$taskMcpRoot = Join-Path $taskProjectRoot '.tools\blender-mcp'
$taskLink = Join-Path (Join-Path $taskMcpRoot 'temp') ('scope-junction-' + [guid]::NewGuid().ToString('N'))
$taskAllowedPrefix = [IO.Path]::GetFullPath((Join-Path $taskMcpRoot 'temp')) + [IO.Path]::DirectorySeparatorChar
if (-not [IO.Path]::GetFullPath($taskLink).StartsWith($taskAllowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Unsafe test link path'
}
$taskPreviousEnvironment = @{}
foreach ($taskName in @('PROJECT_MCP_SCOPE_TEST_LINK','PROJECT_MCP_SOURCE','PYTHONDONTWRITEBYTECODE')) {
    $taskPreviousEnvironment[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process')
}
$env:PROJECT_MCP_SCOPE_TEST_LINK = $taskLink
$env:PROJECT_MCP_SOURCE = $taskSourceRoot
$env:PYTHONDONTWRITEBYTECODE = '1'
try {
    # The link is created inside this project; its outside target is never read or written.
    New-Item -ItemType Junction -Path $taskLink -Target (Split-Path -Parent $taskProjectRoot) | Out-Null
    @'
import json, os, sys
from pathlib import Path
sys.path.insert(0, os.environ['PROJECT_MCP_SOURCE'])
from operations import HERE, checked
link=Path(os.environ['PROJECT_MCP_SCOPE_TEST_LINK'])
try:
    checked(link/'must-not-read-or-write', exists=False)
except ValueError as e:
    report={'outsideJunctionRejected': True, 'reason': str(e), 'outsideFilesReadOrWritten': False}
    (HERE/'logs/reparse-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))
else:
    raise RuntimeError('Outside junction was incorrectly accepted')
'@ | & (Join-Path $taskMcpRoot '.venv\Scripts\python.exe') -B -
    if ($LASTEXITCODE -ne 0) { throw 'Project scope test failed' }
} finally {
    if (Test-Path -LiteralPath $taskLink) {
        $taskItem = Get-Item -LiteralPath $taskLink -Force
        if (($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) { throw 'Refusing to remove a non-link test directory' }
        # Remove precisely the link; no recursive delete and no target traversal.
        Remove-Item -LiteralPath $taskLink -Force
    }
    foreach ($taskName in $taskPreviousEnvironment.Keys) {
        if ($null -eq $taskPreviousEnvironment[$taskName]) {
            [Environment]::SetEnvironmentVariable($taskName, [NullString]::Value, 'Process')
        } else {
            [Environment]::SetEnvironmentVariable($taskName, $taskPreviousEnvironment[$taskName], 'Process')
        }
    }
}
