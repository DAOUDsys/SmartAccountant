param(
  [int]$Port = 8081,
  [int]$ReadyTimeoutSeconds = 360,
  [int]$ActionTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$mobileRoot = Join-Path $repoRoot 'apps\mobile'
$screenshotRoot = Join-Path $repoRoot 'project-management\screenshots\chat-ui'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$node = (Get-Command node).Source
$expoCli = Join-Path $repoRoot 'node_modules\expo\bin\cli'
$metroOut = Join-Path $repoRoot 'android-qa-metro.out'
$metroErr = Join-Path $repoRoot 'android-qa-metro.err'
$uiXmlDevice = '/sdcard/finance-ai-window.xml'
$uiXmlLocal = Join-Path $repoRoot 'android-qa-window.xml'

function Invoke-Adb {
  param([string[]]$Arguments)
  & $adb @Arguments
}

function New-QADirectory {
  if (-not (Test-Path $screenshotRoot)) {
    New-Item -ItemType Directory -Path $screenshotRoot | Out-Null
  }
}

function Get-UiXml {
  Remove-Item -LiteralPath $uiXmlLocal -ErrorAction SilentlyContinue
  Invoke-Adb @('shell', 'uiautomator', 'dump', $uiXmlDevice) | Out-Null
  Invoke-Adb @('pull', $uiXmlDevice, $uiXmlLocal) | Out-Null
  Invoke-Adb @('shell', 'rm', $uiXmlDevice) | Out-Null
  if (Test-Path $uiXmlLocal) {
    return Get-Content $uiXmlLocal -Raw
  }
  return ''
}

function Test-OverlayVisible {
  param([string]$Xml)
  return $Xml -match 'Bundling|Loading|Opening project|Downloading'
}

function Wait-ForMetroBundle {
  $deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
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
  throw "Timed out waiting for Metro bundle output."
}

function Wait-ForUiText {
  param(
    [string[]]$Expected,
    [int]$TimeoutSeconds = $ActionTimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastXml = ''
  while ((Get-Date) -lt $deadline) {
    $lastXml = Get-UiXml
    $hasExpected = $true
    foreach ($text in $Expected) {
      if ($lastXml -notlike "*$text*") {
        $hasExpected = $false
      }
    }

    if ($hasExpected -and -not (Test-OverlayVisible $lastXml)) {
      Start-Sleep -Seconds 4
      return $lastXml
    }

    Start-Sleep -Seconds 5
  }

  throw "Timed out waiting for UI text: $($Expected -join ', ')"
}

function Save-Screenshot {
  param(
    [string]$Name,
    [string[]]$Expected
  )

  $xml = Wait-ForUiText -Expected $Expected
  $target = Join-Path $screenshotRoot "$Name.png"
  Invoke-Adb @('shell', 'screencap', '-p', "/sdcard/$Name.png") | Out-Null
  Invoke-Adb @('pull', "/sdcard/$Name.png", $target) | Out-Null
  Invoke-Adb @('shell', 'rm', "/sdcard/$Name.png") | Out-Null
  [PSCustomObject]@{
    name = $Name
    path = $target
    expected = $Expected -join ', '
    xmlLength = $xml.Length
  }
}

function Save-ScreenshotImmediate {
  param([string]$Name)

  $target = Join-Path $screenshotRoot "$Name.png"
  Invoke-Adb @('shell', 'screencap', '-p', "/sdcard/$Name.png") | Out-Null
  Invoke-Adb @('pull', "/sdcard/$Name.png", $target) | Out-Null
  Invoke-Adb @('shell', 'rm', "/sdcard/$Name.png") | Out-Null
  [PSCustomObject]@{
    name = $Name
    path = $target
    expected = 'transient capture'
    xmlLength = 0
  }
}

function Tap {
  param([int]$X, [int]$Y, [int]$WaitSeconds = 8)
  Invoke-Adb @('shell', 'input', 'tap', "$X", "$Y") | Out-Null
  Start-Sleep -Seconds $WaitSeconds
}

function Tap-UiElement {
  param(
    [string]$Text,
    [int]$WaitSeconds = 8
  )

  $xml = Wait-ForUiText -Expected @($Text)
  $escaped = [regex]::Escape($Text)
  $patterns = @(
    "text=`"$escaped`".*?bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"",
    "content-desc=`"$escaped`".*?bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  )

  foreach ($pattern in $patterns) {
    $match = [regex]::Match($xml, $pattern)
    if ($match.Success) {
      $x = [int](([int]$match.Groups[1].Value + [int]$match.Groups[3].Value) / 2)
      $y = [int](([int]$match.Groups[2].Value + [int]$match.Groups[4].Value) / 2)
      Tap -X $x -Y $y -WaitSeconds $WaitSeconds
      return
    }
  }

  throw "Could not find tappable UI element: $Text"
}

function Type-Text {
  param([string]$Text)
  $escaped = $Text.Replace(' ', '%s').Replace('$', '\$')
  Invoke-Adb @('shell', 'input', 'text', $escaped) | Out-Null
  Start-Sleep -Seconds 5
}

function Ensure-ThreadOpen {
  try {
    Wait-ForUiText -Expected @('Daily sales review', 'Message composer') -TimeoutSeconds 20 | Out-Null
    return
  } catch {
    Wait-ForUiText -Expected @('Finance AI', 'Daily sales review') -TimeoutSeconds 60 | Out-Null
    Tap-UiElement -Text 'Open conversation Daily sales review' -WaitSeconds 12
    Wait-ForUiText -Expected @('Daily sales review', 'Message composer') -TimeoutSeconds 60 | Out-Null
  }
}

New-QADirectory
Remove-Item -LiteralPath $metroOut,$metroErr,$uiXmlLocal -ErrorAction SilentlyContinue

Invoke-Adb @('start-server') | Out-Null
Invoke-Adb @('reverse', '--remove-all') | Out-Null
Invoke-Adb @('reverse', "tcp:$Port", "tcp:$Port") | Out-Null
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
  $captures = @()

  $captures += Save-Screenshot -Name '01-conversation-list' -Expected @('Finance AI', 'Daily sales review')

  Tap-UiElement -Text 'Open conversation Daily sales review' -WaitSeconds 12
  $captures += Save-Screenshot -Name '02-chat-thread' -Expected @('Daily sales review', 'Message composer')

  Tap -X 285 -Y 2230 -WaitSeconds 4
  Type-Text 'I sold 5 chairs to Ahmed for $200 cash'
  $captures += Save-Screenshot -Name '03-composer-ready' -Expected @('I sold 5 chairs')
  Tap -X 995 -Y 2230 -WaitSeconds 0
  Start-Sleep -Milliseconds 1050
  $captures += Save-ScreenshotImmediate -Name '04-typing-streaming'
  Start-Sleep -Seconds 12
  $captures += Save-Screenshot -Name '05-after-send' -Expected @('I sold 5 chairs', 'did not write any transaction')

  Tap-UiElement -Text 'Open chat settings' -WaitSeconds 10
  $captures += Save-Screenshot -Name '06-settings-sheet' -Expected @('Chat Settings', 'Clear conversation')
  Tap-UiElement -Text 'Close chat settings' -WaitSeconds 8
  Ensure-ThreadOpen

  Tap -X 285 -Y 2230 -WaitSeconds 4
  Type-Text 'simulate error'
  Tap -X 995 -Y 2230 -WaitSeconds 14
  $captures += Save-Screenshot -Name '07-retry-ui' -Expected @('Retry', 'Mock-only failure')

  Tap-UiElement -Text 'Retry' -WaitSeconds 14
  $captures += Save-Screenshot -Name '08-retry-after-tap' -Expected @('simulate error', 'I can help turn this')

  Invoke-Adb @('shell', 'input', 'keyevent', '4') | Out-Null
  Start-Sleep -Seconds 8
  Invoke-Adb @('shell', 'cmd', 'uimode', 'night', 'yes') | Out-Null
  Start-Sleep -Seconds 12
  $captures += Save-Screenshot -Name '09-dark-mode-thread' -Expected @('Daily sales review', 'Message composer')

  $captures | Format-Table -AutoSize
}
finally {
  Invoke-Adb @('shell', 'cmd', 'uimode', 'night', 'no') | Out-Null
  if ($metro -and -not $metro.HasExited) {
    Stop-Process -Id $metro.Id -Force
  }
}
