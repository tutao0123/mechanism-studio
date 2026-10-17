param([string]$Python = '3.12')

# Project-local CAD import runtime. Never changes PATH, registry, global skills,
# Python installations, or the user's uv configuration.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'The project Node.js runtime is required for real-path boundary checks.'
}
function Get-CadRealPath([string]$CadCandidate) {
    # realpath follows every ancestor junction/symlink. For paths that do not
    # exist yet, resolve the nearest existing ancestor before any mutation.
    $cadRealPathScript = 'const fs=require("node:fs"),path=require("node:path");let p=path.resolve(process.argv[1]),tail=[];for(;;){try{fs.lstatSync(p);break;}catch(e){if(e.code!=="ENOENT")throw e;const q=path.dirname(p);if(q===p)throw e;tail.unshift(path.basename(p));p=q;}}process.stdout.write(path.join(fs.realpathSync.native(p),...tail));'
    $cadResolved = & node --input-type=commonjs -e $cadRealPathScript $CadCandidate
    if ($LASTEXITCODE -ne 0 -or -not $cadResolved) { throw "Could not resolve local path: $CadCandidate" }
    return $cadResolved
}
$cadProjectRoot = Get-CadRealPath (Join-Path $PSScriptRoot '../..')
function Assert-CadLocalPath([string]$CadCandidate) {
    $cadResolved = Get-CadRealPath $CadCandidate
    if (-not $cadResolved.StartsWith($cadProjectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Local runtime path resolves outside project: $CadCandidate"
    }
}
$cadVenvPath = Join-Path $cadProjectRoot '.tools/cad-python'
$cadCachePath = Join-Path $cadProjectRoot '.cache/uv'
$cadPythonStore = Join-Path $cadProjectRoot '.tools/python'
$cadTempPath = Join-Path $cadProjectRoot '.tools/cad-temp'
$cadSavedEnvironment = @{}
$cadEnvironment = @{
    UV_CACHE_DIR = $cadCachePath
    UV_PYTHON_INSTALL_DIR = $cadPythonStore
    TMP = $cadTempPath
    TEMP = $cadTempPath
    PYTHONDONTWRITEBYTECODE = '1'
}
try {
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        throw 'uv is required. Use an existing uv executable; this script does not install global tools.'
    }
    foreach ($cadDirectory in @($cadVenvPath, $cadCachePath, $cadPythonStore, $cadTempPath)) {
        Assert-CadLocalPath $cadDirectory
    }
    foreach ($cadKey in $cadEnvironment.Keys) {
        $cadSavedEnvironment[$cadKey] = [Environment]::GetEnvironmentVariable($cadKey, 'Process')
        [Environment]::SetEnvironmentVariable($cadKey, $cadEnvironment[$cadKey], 'Process')
    }
    foreach ($cadDirectory in @($cadCachePath, $cadPythonStore, $cadTempPath)) {
        New-Item -ItemType Directory -Force -Path $cadDirectory | Out-Null
        Assert-CadLocalPath $cadDirectory
    }
    $cadPythonExe = Join-Path $cadVenvPath 'Scripts/python.exe'
    Assert-CadLocalPath $cadPythonExe
    if (-not (Test-Path -LiteralPath $cadPythonExe)) {
        & uv venv --python $Python $cadVenvPath
        if ($LASTEXITCODE -ne 0) { throw 'Could not create local CAD Python environment' }
    }
    Assert-CadLocalPath $cadVenvPath
    Assert-CadLocalPath $cadPythonExe
    # OCP only needs VTK's DLLs. Deliberately omit VTK's optional plotting stack.
    & uv pip install --python $cadPythonExe --no-deps -r (Join-Path $PSScriptRoot 'requirements-xcaf.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Could not install pinned local CAD dependencies' }
    & $cadPythonExe -c 'from OCP.STEPCAFControl import STEPCAFControl_Reader; print("Local OCCT XCAF runtime ready")'
    if ($LASTEXITCODE -ne 0) { throw 'Local OCCT XCAF import failed' }
} finally {
    foreach ($cadKey in $cadSavedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($cadKey, $cadSavedEnvironment[$cadKey], 'Process')
    }
}
