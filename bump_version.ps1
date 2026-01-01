$file = "index.html"
$content = Get-Content $file -Raw

# Find version pattern vX.XX.XX
if ($content -match 'v(\d+)\.(\d+)\.(\d+)') {
    $major = $matches[1]
    $minor = $matches[2]
    $patch = $matches[3]

    # Increment patch
    $newPatch = [int]$patch + 1
    # Format with leading zero if needed (though original didn't strictly enforce, user seems to like 02)
    # Actually user has v1.31.02. Let's keep 2 digits for patch if it was 2 digits.
    $newPatchStr = "{0:D2}" -f $newPatch
    
    $oldVersion = "v$major.$minor.$patch"
    $newVersion = "v$major.$minor.$newPatchStr"

    $content = $content -replace [regex]::Escape($oldVersion), $newVersion
    Set-Content $file $content -NoNewline
    
    Write-Host "Updated version to $newVersion"
} else {
    Write-Warning "Version pattern not found in $file"
}
