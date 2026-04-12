param(
    [Parameter(Mandatory = $true)]
    [string]$SpfxVersion,

    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [Parameter(Mandatory = $false)]
    [bool]$Cleanup = $true,

    [Parameter(Mandatory = $true)]
    [string]$NodeVersion,

    [Parameter(Mandatory = $true)]
    [string]$BuildTool,

    [Parameter(Mandatory = $true)]
    [string]$GeneratorVersion,

    [Parameter(Mandatory = $true)]
    [string]$YoVersion,

    [Parameter(Mandatory = $false)]
    [string]$GulpCliVersion = '',

    [Parameter(Mandatory = $true)]
    [string]$M365TenantId,

    [Parameter(Mandatory = $true)]
    [string]$M365AppId,

    [Parameter(Mandatory = $true)]
    [string]$M365CertificateBase64,

    [Parameter(Mandatory = $true)]
    [string]$M365CertificatePassword,

    [Parameter(Mandatory = $true)]
    [string]$M365TestUsername,

    [Parameter(Mandatory = $true)]
    [string]$M365TestPassword
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "========================================" 
Write-Host "  SPFx Integration Test " 
Write-Host "========================================" 

Write-Host ""
Write-Host "--- Workflow Inputs ---"
Write-Host "SpfxVersion:   $SpfxVersion"
Write-Host "SiteUrl:       $SiteUrl"
Write-Host "Cleanup:       $Cleanup"

Write-Host ""
Write-Host "--- Resolved SPFx Config ---"
Write-Host "NodeVersion:      $NodeVersion"
Write-Host "BuildTool:        $BuildTool"
Write-Host "GeneratorVersion: $GeneratorVersion"
Write-Host "YoVersion:        $YoVersion"
Write-Host "GulpCliVersion:   $( if ($GulpCliVersion) { $GulpCliVersion } else { '(not set)' } )"

$Packages = @("yo@$YoVersion", "@microsoft/generator-sharepoint@$GeneratorVersion", "@pnp/cli-microsoft365")

if ($GulpCliVersion) {
    $Packages += "gulp-cli@$GulpCliVersion"
} else {
    $Packages += "@rushstack/heft"
}

Write-Host "Installing global packages: $($Packages -join ', ')"
npm install -g @Packages
if ($LASTEXITCODE -ne 0) { throw "Failed to install global packages." }

# --- Scaffold SPFx webpart ---
Write-Host ""
Write-Host "--- Scaffolding SPFx webpart ---"

$ProjectDir = "spfx-project"
New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
Push-Location $ProjectDir

Write-Host "Running Yeoman SPFx generator..."
yo @microsoft/sharepoint `
    --solution-name "integration-test" `
    --component-type "webpart" `
    --component-name "HelloWorld" `
    --framework "none" `
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Yeoman generator failed to scaffold the project." }

Write-Host "Scaffolded project structure:"
Get-ChildItem -Recurse -Depth 2 | Select-Object -ExpandProperty FullName

Pop-Location
Write-Host "Scaffold complete."

# --- Build and package webpart ---
Write-Host ""
Write-Host "--- Building SPFx webpart ---"

Push-Location "spfx-project/integration-test"

if ($BuildTool -eq 'gulp') {
    Write-Host "Running gulp bundle..."
    gulp bundle --ship
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "gulp bundle failed." }

    Write-Host "Running gulp package-solution..."
    gulp package-solution --ship
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "gulp package-solution failed." }
}
elseif ($BuildTool -eq 'heft') {
    Write-Host "Running heft build..."
    heft build --clean --production
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "heft build failed." }

    Write-Host "Running heft package-solution..."
    heft package-solution --production
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "heft package-solution failed." }
}
else {
    Pop-Location
    throw "Unknown build tool: $BuildTool. Expected 'gulp' or 'heft'."
}

$SppkgFile = Get-ChildItem -Path "sharepoint/solution" -Filter "*.sppkg" -Recurse | Select-Object -First 1
if (-not $SppkgFile) { Pop-Location; throw "No .sppkg file found in sharepoint/solution/" }

Write-Host "Found package: $($SppkgFile.FullName)"
$script:SppkgPath = $SppkgFile.FullName
$script:SppkgName = $SppkgFile.Name

Pop-Location
Write-Host "Build complete."

# --- Setup site for integration tests ---
Write-Host ""
Write-Host "--- Setup SharePoint site ---"

Write-Host "Logging into Microsoft 365 tenant..."
m365 login --authType "certificate" --certificateBase64Encoded "$M365CertificateBase64" --password "$M365CertificatePassword" --appId "$M365AppId" --tenant "$M365TenantId"

Write-Host "Ensuring site collection app catalog exists..."
m365 spo site appcatalog add --siteUrl $SiteUrl 2>$null
Write-Host "Waiting 30s for app catalog provisioning..."
Start-Sleep -Seconds 30

Write-Host "Adding .sppkg to site collection app catalog..."
$AddOutput = m365 spo app add --filePath $SppkgPath --appCatalogScope "sitecollection" --appCatalogUrl $SiteUrl --overwrite --output json | ConvertFrom-Json
$AppUniqueId = $AddOutput.UniqueId
if (-not $AppUniqueId) {
    Write-Error "Failed to parse UniqueId from app add output: $($AddOutput | ConvertTo-Json -Depth 3)"
    exit 1
}
Write-Host "App UniqueId: $AppUniqueId"

Write-Host "Deploying (trusting) the app..."
m365 spo app deploy --name $SppkgName --appCatalogScope "sitecollection" --appCatalogUrl $SiteUrl
if ($LASTEXITCODE -ne 0) { throw "Failed to deploy app." }

Write-Host "Installing the app on the site..."
m365 spo app install --id $AppUniqueId --siteUrl $SiteUrl --appCatalogScope "sitecollection"
if ($LASTEXITCODE -ne 0) { throw "Failed to install app." }
Write-Host "Waiting 10s for propagation..."
Start-Sleep -Seconds 10

# --- Create test page and add webpart ---
Write-Host ""
Write-Host "--- Create test page ---"

$ManifestPath = "spfx-project/integration-test/src/webparts/helloWorld/HelloWorldWebPart.manifest.json"
if (-not (Test-Path $ManifestPath)) { throw "Manifest file not found: $ManifestPath" }

# Manifest is JSONC (has comments) — strip line-by-line, preserving // inside strings
$ManifestLines = Get-Content $ManifestPath
$CleanLines = foreach ($line in $ManifestLines) {
    $inString = $false
    $result = ''
    for ($i = 0; $i -lt $line.Length; $i++) {
        $ch = $line[$i]
        if ($inString) {
            $result += $ch
            if ($ch -eq '\' ) { $result += $line[++$i] }
            elseif ($ch -eq '"') { $inString = $false }
        }
        elseif ($ch -eq '"') { $inString = $true; $result += $ch }
        elseif ($ch -eq '/' -and $i + 1 -lt $line.Length -and $line[$i + 1] -eq '/') { break }
        else { $result += $ch }
    }
    $result
}
$ManifestClean = ($CleanLines -join "`n") -replace ',(\s*[}\]])', '$1'
$Manifest = $ManifestClean | ConvertFrom-Json
$WebPartId = $Manifest.id
if (-not $WebPartId) { throw "Could not extract webpart ID from manifest." }
Write-Host "Extracted WebPart ID: $WebPartId"

$PageName = "integration-test-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"
Write-Host "Creating test page: $PageName.aspx"

m365 spo page add --name "$PageName.aspx" --webUrl $SiteUrl --layoutType "Article"
if ($LASTEXITCODE -ne 0) { throw "Failed to create test page." }

Write-Host "Adding empty section..."
m365 spo page section add --webUrl $SiteUrl --pageName "$PageName.aspx" --sectionTemplate "OneColumn"

Write-Host "Adding webpart to page..."
m365 spo page clientsidewebpart add --webUrl $SiteUrl --pageName "$PageName.aspx" --webPartId $WebPartId --section 0 --column 0
sleep 10

echo "==> Publishing page..."
m365 spo page set --name "$PageName.aspx" --webUrl $SiteUrl --publish

$PageUrl = "$SiteUrl/SitePages/$PageName.aspx"
Write-Host "Page published at: $PageUrl"
"page_url=$PageUrl" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
"page_name=$PageName" | Out-File -Append -FilePath $env:GITHUB_OUTPUT
"app_id=$AppUniqueId" | Out-File -Append -FilePath $env:GITHUB_OUTPUT

Write-Host ""
Write-Host "========================================" 
Write-Host "  All parameters received successfully" 
Write-Host "========================================" 
