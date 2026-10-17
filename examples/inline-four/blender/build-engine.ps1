$ErrorActionPreference = 'Stop'
$exampleRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $exampleRoot '../..'))
$blenderExe = Join-Path $projectRoot '.tools/blender-4.5.14-windows-x64/blender.exe'
if (!(Test-Path -LiteralPath $blenderExe)) { throw 'Project-local portable Blender is missing.' }
$exampleCache = Join-Path $exampleRoot '.cache'
New-Item -ItemType Directory -Force -Path $exampleCache, (Join-Path $exampleCache 'temp'), (Join-Path $exampleCache 'blender-user') | Out-Null
$env:TEMP = Join-Path $exampleCache 'temp'
$env:TMP = $env:TEMP
$env:BLENDER_USER_RESOURCES = Join-Path $exampleCache 'blender-user'
& node (Join-Path $PSScriptRoot 'export-spec.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Shared spec export failed.' }
& $blenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'build-engine.py')
if ($LASTEXITCODE -ne 0) { throw 'Blender build failed.' }
