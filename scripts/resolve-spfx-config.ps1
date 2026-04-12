param(
    [Parameter(Mandatory = $true)]
    [string]$SpfxVersion
)

$ErrorActionPreference = 'Stop'

$MajorMinor = ($SpfxVersion -replace '^(\d+\.\d+).*', '$1')
Write-Host "SPFx version: $SpfxVersion (major.minor: $MajorMinor)"

$ConfigPath = Join-Path $PSScriptRoot '..\config\spfx-versions.json'
if (-not (Test-Path $ConfigPath)) {
    Write-Error "Config file not found: $ConfigPath"
    exit 1
}

$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if (-not ($Config.PSObject.Properties.Name -contains $MajorMinor)) {
    Write-Error "SPFx version $MajorMinor not found in spfx-versions.json"
    exit 1
}

$VersionConfig = $Config.$MajorMinor
$NodeVersion = $VersionConfig.node
$BuildTool = $VersionConfig.buildTool
$GeneratorVersion = $VersionConfig.generator
$YoVersion = $VersionConfig.yo
$GulpCliVersion = if ($VersionConfig.PSObject.Properties.Name -contains 'gulp-cli') { $VersionConfig.'gulp-cli' } else { '' }

Write-Host "Resolved: Node $NodeVersion, Build tool: $BuildTool, Generator: $GeneratorVersion, Yo: $YoVersion, Gulp CLI: $GulpCliVersion"

"node_version=$NodeVersion" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
"build_tool=$BuildTool" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
"generator_version=$GeneratorVersion" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
"yo_version=$YoVersion" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
"gulp_cli_version=$GulpCliVersion" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
