$ErrorActionPreference = "Stop"

$file = "$PSScriptRoot\index.html"
$content = Get-Content $file -Raw -Encoding UTF8

# Find version pattern vX.X.X (using digits)
if ($content -match 'v(\d+)\.(\d+)\.(\d+)') {
    $major = $matches[1]
    $minor = $matches[2]
    $patch = $matches[3]

    # Increment patch
    $newPatch = [int]$patch + 1
    
    # Existing format seems to be just digits, but let's just use string formatting
    $oldVersion = "v$major.$minor.$patch"
    $newVersion = "v$major.$minor.$newPatch"

    # Replace in content
    # Note: escaping the dot in oldVersion for regex replacement safety
    $content = $content -replace [regex]::Escape($oldVersion), $newVersion

    # Force update visible version tag in case it was out of sync
    $content = $content -replace '<span class="version-tag">.*?</span>', "<span class=""version-tag"">$newVersion</span>"
    Set-Content $file $content -Encoding UTF8 -NoNewline
    
    Write-Host "Bumped version: $oldVersion -> $newVersion" -ForegroundColor Green

    # Git Operations
    Write-Host "Adding files..." -ForegroundColor Cyan
    git add .

    $commitMsg = "Update to $newVersion"
    Write-Host "Committing: $commitMsg" -ForegroundColor Cyan
    git commit -m "$commitMsg"

    Write-Host "Tagging: $newVersion" -ForegroundColor Cyan
    git tag $newVersion

    Write-Host "Pushing to origin..." -ForegroundColor Cyan
    git push origin main --tags

    Write-Host "Deployment Complete!" -ForegroundColor Green
}
else {
    Write-Error "Could not find version pattern 'vX.X.X' in $file"
}
