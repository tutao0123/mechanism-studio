$ErrorActionPreference = 'Stop'
$prototypeRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $prototypeRoot
$toolRoot = Join-Path $projectRoot '.tools'
$blenderExe = Join-Path $toolRoot 'blender-4.5.14-windows-x64\blender.exe'
$runtimeRoot = Join-Path $toolRoot 'blender-user'
$tempRoot = Join-Path $toolRoot 'blender-temp'
$cacheRoot = Join-Path $toolRoot 'blender-cache'
New-Item -ItemType Directory -Path $runtimeRoot,$tempRoot,$cacheRoot -Force | Out-Null
$env:BLENDER_USER_RESOURCES = $runtimeRoot
$env:BLENDER_USER_CONFIG = Join-Path $runtimeRoot 'config'
$env:BLENDER_USER_SCRIPTS = Join-Path $runtimeRoot 'scripts'
$env:BLENDER_USER_DATAFILES = Join-Path $runtimeRoot 'datafiles'
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
$env:XDG_CACHE_HOME = $cacheRoot
$env:PYTHONDONTWRITEBYTECODE = '1'
& $blenderExe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'build-lock.py')
if ($LASTEXITCODE -ne 0) { throw "Blender asset build failed: $LASTEXITCODE" }
