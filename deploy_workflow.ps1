
# Workflow: Deploy Application
# Description: Bumps the version number in index.html, commits changes, creates a git tag, and pushes to GitHub.

$file = "index.html"
$content = Get-Content $file -Raw

# Find version pattern vX.XX.XX
if ($content -match 'v(\d+)\.(\d+)\.(\d+)') {
    $major = $matches[1]
    $minor = $matches[2]
    $patch = $matches[3]

    # Increment patch
    $newPatch = [int]$patch + 1
    # Format with leading zero if needed (user preference logic from previous script)
    # Keeping it simple: just the number is standard, but user had 02. 
    # Let's preserve the existing style if it was 0-padded.
    # Actually, simpler is better for automation unless user complains. 
    # ps1 logic: "{0:D2}" -f $newPatch
    $newPatchStr = "{0:D2}" -f $newPatch
    
    $oldVersion = "v$major.$minor.$patch"
    $newVersion = "v$major.$minor.$newPatchStr"

    $content = $content -replace [regex]::Escape($oldVersion), $newVersion
    Set-Content $file $content -NoNewline
    
    Write-Host "Updated version to $newVersion"

    # Git Operations
    Write-Host "Staging files..."
    git add .

    Write-Host "Committing..."
    git commit -m "Update to $newVersion"

    Write-Host "Tagging..."
    # Force tag if exists? No, should be new.
    git tag $newVersion

    Write-Host "Pushing to GitHub..."
    git push origin head
    git push origin --tags

    Write-Host "Deployment Complete! Version: $newVersion"

}
else {
    Write-Error "Version pattern not found in $file"
    exit 1
}
