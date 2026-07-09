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
$metroOut = Join-Path $repoRoot 'android-qa-retry-dark.out'
$metroErr = Join-Path $repoRoot 'android-qa-retry-dark.err'
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
  if (Test-Path $uiXmlLocal) {
    return Get-Content $uiXmlLocal -Raw
  }
  return ''
}

function Test-OverlayVisible {
  param([string]$Xml)
  return $Xml -match 'Bundling|Loading|Opening project|Downloading'
}

function Wait-ForUiText {
  param(
    [string[]]$Expected,
    [int]$TimeoutSeconds = $ActionTimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $xml = Get-UiXml
    $hasExpected = $true
    foreach ($text in $Expected) {
      if ($xml -notlike "*$text*") {
        $hasExpected = $false
      }
    }

    if ($hasExpected -and -not (Test-OverlayVisible $xml)) {
      Start-Sleep -Seconds 4
      return $xml
    }

    Start-Sleep -Seconds 5
  }

  throw "Timed out waiting for UI text: $($Expected -join ', ')"
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
  $captures = @()

  Wait-ForUiText -Expected @('Finance AI', 'Daily sales review') | Out-Null
  Tap-UiElement -Text 'Open conversation Daily sales review' -WaitSeconds 12
  Wait-ForUiText -Expected @('Daily sales review', 'Message composer') | Out-Null

  Tap -X 285 -Y 2230 -WaitSeconds 4
  Type-Text 'simulate error'
  Tap -X 995 -Y 2230 -WaitSeconds 14
  $captures += Save-Screenshot -Name '07-retry-ui' -Expected @('Retry', 'Mock-only failure')

  Tap-UiElement -Text 'Retry' -WaitSeconds 14
  $captures += Save-Screenshot -Name '08-retry-after-tap' -Expected @('simulate error', 'I can help turn this')

  Invoke-Adb @('shell', 'cmd', 'uimode', 'night', 'yes') | Out-Null
  Start-Sleep -Seconds 14
  $captures += Save-Screenshot -Name '09-dark-mode-thread' -Expected @('Daily sales review', 'Message composer')

  $captures | Format-Table -AutoSize
}
finally {
  Invoke-Adb @('shell', 'cmd', 'uimode', 'night', 'no') | Out-Null
  if ($metro -and -not $metro.HasExited) {
    Stop-Process -Id $metro.Id -Force
  }
}
