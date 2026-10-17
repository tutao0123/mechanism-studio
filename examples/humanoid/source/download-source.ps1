# Retain pinned public bytes. Never load or execute any upstream source script.
$ErrorActionPreference = 'Stop'
$repository = 'https://github.com/google-deepmind/mujoco_menagerie'
$revision = '71f066ad0be9cd271f7ed58c030243ef157af9f4'
$base = "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/$revision/"
$sourceRoot = $PSScriptRoot
$pins = Get-Content -Raw -LiteralPath (Join-Path $sourceRoot 'upstream-blobs.json') | ConvertFrom-Json
if ($pins.revision -ne $revision) { throw 'Pinned metadata revision mismatch' }
$modelFolder = Join-Path $sourceRoot 'unitree_g1'
New-Item -ItemType Directory -Force -Path $modelFolder | Out-Null
$xmlFile = Join-Path $modelFolder 'g1.xml'
Invoke-WebRequest -Uri "${base}unitree_g1/g1.xml" -OutFile $xmlFile
[xml]$model = Get-Content -Raw -LiteralPath $xmlFile
$meshFiles = @($model.mujoco.asset.mesh | ForEach-Object { $_.file })
if ($meshFiles.Count -ne 35) { throw 'Pinned G1 mesh set changed' }
$names = @('g1.xml', 'LICENSE', 'README.md', 'CHANGELOG.md') + @($meshFiles | ForEach-Object { "assets/$_" })
$records = @()
foreach ($filename in $names) {
    if ($filename.Split('/') -contains '..') { throw 'Source path must remain local' }
    $remotePath = "unitree_g1/$filename"
    $metadata = $pins.files.PSObject.Properties[$filename].Value
    if (-not $metadata) { throw "Missing source blob: $remotePath" }
    $destination = Join-Path $sourceRoot $remotePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    if ($filename -ne 'g1.xml' -and -not (Test-Path -LiteralPath $destination)) { Invoke-WebRequest -Uri "${base}${remotePath}" -OutFile $destination }
    $bytes = [IO.File]::ReadAllBytes($destination)
    if ($bytes.Length -ne $metadata[0]) { throw "Byte length mismatch: $remotePath" }
    $sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    $header = [Text.Encoding]::UTF8.GetBytes("blob $($bytes.Length)`0")
    $gitBytes = New-Object byte[] ($header.Length + $bytes.Length)
    [Array]::Copy($header, 0, $gitBytes, 0, $header.Length)
    [Array]::Copy($bytes, 0, $gitBytes, $header.Length, $bytes.Length)
    $gitHash = [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($gitBytes)).Replace('-', '').ToLowerInvariant()
    if ($gitHash -ne $metadata[1]) { throw "Git blob mismatch: $remotePath" }
    $records += [ordered]@{ localFile = $remotePath; upstreamPath = $remotePath; url = "${base}${remotePath}"; bytes = $bytes.Length; sha256 = $sha256; gitBlobSha1 = $gitHash }
}
$provenance = [ordered]@{
    schemaVersion = '1.0.0'; title = 'Unitree G1 29-DoF humanoid - MuJoCo Menagerie visual model'; author = 'Unitree Robotics; MuJoCo Menagerie contributors'
    repository = $repository; revision = $revision; modelDirectory = 'unitree_g1'; license = 'BSD-3-Clause'
    licenseScope = 'The upstream repository explicitly assigns individual model XML and assets to the LICENSE in that model directory; unitree_g1/README.md also states BSD-3-Clause. This does not rely on the repository-wide Apache-2.0 license.'
    licenseUrl = "$repository/blob/$revision/unitree_g1/LICENSE"; sourceUrl = "$repository/tree/$revision/unitree_g1"
    localFile = 'unitree_g1/g1.xml'; sha256 = (Get-FileHash -LiteralPath $xmlFile -Algorithm SHA256).Hash.ToLowerInvariant(); retrievedDate = '2026-10-18'; files = $records
    geometrySubset = [ordered]@{
        description = 'Every visual-class mesh in complete 29-DoF g1.xml; collision geoms, sites, lights and simulation floor are excluded from display GLB.'
        limitations = @(
            'MJCF body identities and hierarchy are source-backed, but visual meshes merge physical hardware; there is no per-screw identity, native STEP assembly, B-rep or manufacturing topology.'
            'Head and rubber hand visuals belong to existing torso/wrist bodies in this source. They are not additional articulated joints.'
            'Exploded separation is an editorial display operation, not collision-checked service disassembly.'
            'Source joint axes, limits, inertials and actuator declarations are retained as source evidence; no dynamics, balance, contact or control validation is claimed.'
        )
    }
}
[IO.File]::WriteAllText((Join-Path $sourceRoot 'provenance.json'), (($provenance | ConvertTo-Json -Depth 12) + "`n"), [Text.UTF8Encoding]::new($false))
$totalSourceBytes = 0
foreach ($record in $records) { $totalSourceBytes += $record.bytes }
[ordered]@{ revision = $revision; fileCount = $records.Count; sourceBytes = $totalSourceBytes; xmlSHA256 = $provenance.sha256 } | ConvertTo-Json
