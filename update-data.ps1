# Refreshes the embedded fixture data (teams, kickoff times, final scores)
# from fixturedownload.com. Run any time; the app picks it up on next reload.
#   powershell -ExecutionPolicy Bypass -File update-data.ps1
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026'

Write-Host "Fetching $url ..."
$resp = Invoke-WebRequest -Uri $url -UseBasicParsing
$raw = $resp.Content

$parsed = $raw | ConvertFrom-Json
if ($parsed.Count -lt 100) { throw "Unexpected fixture count ($($parsed.Count)) - feed may have changed, keeping existing data." }

$utf8 = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText((Join-Path $dir 'fixtures_raw.json'), $raw, $utf8)

$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$js = "window.WC_FIXTURES = $raw;`nwindow.WC_FETCHED_AT = '$stamp';`n"
[IO.File]::WriteAllText((Join-Path $dir 'fixtures.js'), $js, $utf8)

$done = ($parsed | Where-Object { $null -ne $_.HomeTeamScore }).Count
Write-Host "OK: $($parsed.Count) matches written to fixtures.js ($done with final scores) at $stamp"
