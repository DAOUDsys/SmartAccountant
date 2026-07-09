param(
  [int]$Port = 8081,
  [int]$TimeoutSeconds = 360
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$mobileRoot = Join-Path $repoRoot 'apps\mobile'
$screenshotRoot = Join-Path $repoRoot 'project-management\screenshots\chat-ui'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$node = (Get-Command node).Source
$expoCli = Join-Path $repoRoot 'node_modules\expo\bin\cli'
$metroOut = Join-Path $repoRoot 'android-qa-clear.out'
$metroErr = Join-Path $repoRoot 'android-qa-clear.err'
$uiXmlDevice = '/sdcard/finance-ai-window.xml'
$uiXmlLocal = Join-Path $repoRoot 'android-qa-window.xml'

function Invoke-Adb {
  param([string[]]$Arguments)
  & $adb @Arguments
}

function Get-UiXml {
  Remove-Item -LiteralPath $uiXmlLocal -ErrorAction SilentlyContinue
  Invoke-Adb @('shell', 'uiautomator', 'dump', $uiXmlDevice) | Out-Null
  Invoke-Adb @('pull', $uiXmlDevice, $uiXmlLocal) | Out-Null
  Invoke-Adb @('shell', 'rm', $uiXmlDevice) | Out-Null
  return Get-Content $uiXmlLocal -Raw
}

function Wait-ForUiText {
  param([string[]]$Expected)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $xml = Get-UiXml
    $ready = $true
    foreach ($text in $Expected) {
      if ($xml -notlike "*$text*") {
        $ready = $false
      }
    }
    if ($ready -and $xml -notmatch 'Bundling|Loading|Opening project|Downloading') {
      Start-Sleep -Seconds 4
      return $xml
    }
    Start-Sleep -Seconds 5
  }
  throw "Timed out waiting for UI text: $($Expected -join ', ')"
}

function Tap-UiElement {
  param([string]$Text, [int]$WaitSeconds = 8)

  $xml = Wait-ForUiText -Expected @($Text)
  $escaped = [regex]::Escape($Text)
  foreach ($pattern in @(
    "text=`"$escaped`".*?bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"",
    "content-desc=`"$escaped`".*?bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  )) {
    $match = [regex]::Match($xml, $pattern)
    if ($match.Success) {
      $x = [int](([int]$match.Groups[1].Value + [int]$match.Groups[3].Value) / 2)
      $y = [int](([int]$match.Groups[2].Value + [int]$match.Groups[4].Value) / 2)
      Invoke-Adb @('shell', 'input', 'tap', "$x", "$y") | Out-Null
      Start-Sleep -Seconds $WaitSeconds
      return
    }
  }
  throw "Could not find UI element: $Text"
}

function Wait-ForMetroBundle {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $stdout = if (Test-Path $metroOut) { Get-Content $metroOut -Raw } else { '' }
    $stderr = if (Test-Path $metroErr) { Get-Content $metroErr -Raw } else { '' }
    if ($stderr -match 'CommandError|Cannot find module|Unable to resolve|Error:') {
      throw "Metro failed: $stderr"
    }
    if ($stdout -match 'Android Bundled|Logs for your project will appear below') {
      Start-Sleep -Seconds 20
      return
    }
    Start-Sleep -Seconds 5
  }
  throw 'Timed out waiting for Metro.'
}

if (-not (Test-Path $screenshotRoot)) {
  New-Item -ItemType Directory -Path $screenshotRoot | Out-Null
}

Remove-Item -LiteralPath $metroOut,$metroErr,$uiXmlLocal -ErrorAction SilentlyContinue

Invoke-Adb @('start-server') | Out-Null
Invoke-Adb @('reverse', '--remove-all') | Out-Null
Invoke-Adb @('reverse', "tcp:$Port", "tcp:$Port") | Out-Null
Invoke-Adb @('shell', 'cmd', 'uimode', 'night', 'no') | Out-Null
Invoke-Adb @('shell', 'am', 'force-stop', 'host.exp.exponent') | Out-Null

$metro = Start-Process `
  -FilePath $node `
  -ArgumentList @($expoCli, 'start', '--android', '--go', '--offline', '--port', "$Port", '--clear') `
  -WorkingDirectory $mobileRoot `
  -WindowStyle Hidden `
  -PassThru `
  -RedirectStandardOutput $metroOut `
  -RedirectStandardError $metroErr

try {
  Wait-ForMetroBundle
  Wait-ForUiText -Expected @('Finance AI', 'Daily sales review') | Out-Null
  Tap-UiElement -Text 'Open conversation Daily sales review' -WaitSeconds 12
  Wait-ForUiText -Expected @('Daily sales review', 'Message composer') | Out-Null
  Tap-UiElement -Text 'Open chat settings' -WaitSeconds 10
  Wait-ForUiText -Expected @('Chat Settings', 'Clear conversation') | Out-Null
  Tap-UiElement -Text 'Clear conversation' -WaitSeconds 10
  Wait-ForUiText -Expected @('Conversation cleared locally', 'No backend records were changed') | Out-Null

  $target = Join-Path $screenshotRoot '10-clear-conversation.png'
  Invoke-Adb @('shell', 'screencap', '-p', '/sdcard/10-clear-conversation.png') | Out-Null
  Invoke-Adb @('pull', '/sdcard/10-clear-conversation.png', $target) | Out-Null
  Invoke-Adb @('shell', 'rm', '/sdcard/10-clear-conversation.png') | Out-Null
  Write-Output "Clear conversation verified: $target"
}
finally {
  Invoke-Adb @('shell', 'cmd', 'uimode', 'night', 'no') | Out-Null
  if ($metro -and -not $metro.HasExited) {
    Stop-Process -Id $metro.Id -Force
  }
}
