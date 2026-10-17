param([switch]$Verify)
$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskMcpRoot = Join-Path $taskProjectRoot '.tools\blender-mcp'
$taskSourceRoot = $PSScriptRoot
$taskPython = (Join-Path $taskMcpRoot '.venv\Scripts\python.exe').Replace('\','/')
$taskServer = (Join-Path $taskSourceRoot 'server.py').Replace('\','/')
$taskProjectToml = ConvertTo-Json $taskProjectRoot.Replace('\','/') -Compress
$taskTempToml = ConvertTo-Json (Join-Path $taskMcpRoot 'temp').Replace('\','/') -Compress
$taskPythonToml = ConvertTo-Json $taskPython -Compress
$taskArgsToml = ConvertTo-Json @('-B',$taskServer) -Compress
if (-not (Test-Path -LiteralPath $taskPython) -or -not (Test-Path -LiteralPath $taskServer)) {
    throw 'Project-local MCP runtime or source is missing; see tools/blender-mcp/README.md'
}
$taskPreviousEnvironment = @{}
foreach ($taskName in @('TEMP','TMP','PYTHONDONTWRITEBYTECODE')) {
    $taskPreviousEnvironment[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process')
}
$env:TEMP = Join-Path $taskMcpRoot 'temp'
$env:TMP = $env:TEMP
$env:PYTHONDONTWRITEBYTECODE = '1'
$taskOverrides = @(
    '-c', "mcp_servers.project_blender.command=$taskPythonToml",
    '-c', "mcp_servers.project_blender.args=$taskArgsToml",
    '-c', "mcp_servers.project_blender.cwd=$taskProjectToml",
    '-c', 'mcp_servers.project_blender.enabled_tools=["status","inspect_lock","rebuild_lock","render_preview"]',
    '-c', "mcp_servers.project_blender.env={PYTHONDONTWRITEBYTECODE=""1"",PYTHONNOUSERSITE=""1"",TEMP=$taskTempToml,TMP=$taskTempToml}"
)
Push-Location -LiteralPath $taskProjectRoot
try {
    if ($Verify) {
        & codex @taskOverrides mcp get project_blender --json
    } else {
        # The user runs this to start a new CLI session; it does not reconfigure the desktop chat.
        & codex @taskOverrides
    }
    if ($LASTEXITCODE -ne 0) { throw "Codex exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
    foreach ($taskName in $taskPreviousEnvironment.Keys) {
        if ($null -eq $taskPreviousEnvironment[$taskName]) {
            [Environment]::SetEnvironmentVariable($taskName, [NullString]::Value, 'Process')
        } else {
            [Environment]::SetEnvironmentVariable($taskName, $taskPreviousEnvironment[$taskName], 'Process')
        }
    }
}
