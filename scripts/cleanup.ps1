param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [Parameter(Mandatory = $true)]
    [string]$PageName,

    [Parameter(Mandatory = $true)]
    [string]$AppId
)

Write-Host "Cleaning up test artifacts from $SiteUrl..."

Write-Host "Removing test page $PageName.aspx..."
m365 spo page remove --name "$PageName.aspx" --webUrl "$SiteUrl" --force 2>$null

Write-Host "Waiting 30 seconds before verifying removal..."
Start-Sleep -Seconds 30

Write-Host "Verifying test page $PageName.aspx was removed..."
$pageExists = m365 spo page get --name "$PageName.aspx" --webUrl "$SiteUrl" 2>$null
if ($pageExists) {
    Write-Host "Page $PageName.aspx still exists. Removing it again..."
    m365 spo page remove --name "$PageName.aspx" --webUrl "$SiteUrl" --force 2>$null
}
else {
    Write-Host "Page $PageName.aspx was successfully removed."
}

Write-Host "Uninstalling app $AppId from site..."
m365 spo app uninstall --id "$AppId" --siteUrl "$SiteUrl" --appCatalogScope sitecollection --force 2>$null

Write-Host "Retracting app $AppId from app catalog..."
m365 spo app retract --id "$AppId" --appCatalogScope sitecollection --appCatalogUrl "$SiteUrl" --force 2>$null

Write-Host "Removing app $AppId from app catalog..."
m365 spo app remove --id "$AppId" --appCatalogScope sitecollection --appCatalogUrl "$SiteUrl" --force 2>$null

Write-Host "Cleanup complete."
