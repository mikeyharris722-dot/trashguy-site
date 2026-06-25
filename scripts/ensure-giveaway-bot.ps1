$project = "C:\Users\mikey\projects\trashguy-site"
$botFile = "scripts\twitch-giveaway-bot.js"
$node = "C:\Program Files\nodejs\node.exe"
$log = "C:\Users\mikey\projects\trashguy-site\scripts\giveaway-bot-watchdog.log"

$running = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -like "*twitch-giveaway-bot.js*"
  }

if (-not $running) {
  Add-Content $log "$(Get-Date) - Twitch + Kick bot not running. Starting..."
  Start-Process $node `
    -ArgumentList $botFile `
    -WorkingDirectory $project `
    -WindowStyle Hidden
} else {
  Add-Content $log "$(Get-Date) - Twitch + Kick bot already running."
}