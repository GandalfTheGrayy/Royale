param(
  [switch]$ResetPassword,
  [switch]$EmergencyGate
)

$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$logDirectory = Join-Path $projectRoot '.share-logs'
$previewOutput = Join-Path $logDirectory 'preview.out.log'
$previewError = Join-Path $logDirectory 'preview.err.log'
$voiceOutput = Join-Path $logDirectory 'voice.out.log'
$voiceError = Join-Path $logDirectory 'voice.err.log'
$ollamaOutput = Join-Path $logDirectory 'ollama.out.log'
$ollamaError = Join-Path $logDirectory 'ollama.err.log'
$tailscaleLoginOutput = Join-Path $logDirectory 'tailscale-login.out.log'
$tailscaleLoginError = Join-Path $logDirectory 'tailscale-login.err.log'
$accessDirectory = Join-Path $env:LOCALAPPDATA 'PehlevanRoyale'
$accessFile = Join-Path $accessDirectory 'share-access.json'
$userName = 'Pehlevan'

function Convert-SecureStringToText([Security.SecureString]$secureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Get-Sha256([string]$value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)))).Replace('-', '').ToLowerInvariant()
  } finally { $sha.Dispose() }
}

function Save-AccessConfiguration {
  New-Item -ItemType Directory -Path $accessDirectory -Force | Out-Null
  while ($true) {
    Write-Host ''
    Write-Host 'Pehlevan hesabi icin kalici bir parola belirleyin.' -ForegroundColor Cyan
    $firstSecure = Read-Host 'Yeni parola (en az 8 karakter)' -AsSecureString
    $secondSecure = Read-Host 'Yeni parolayi tekrar yazin' -AsSecureString
    $first = Convert-SecureStringToText $firstSecure
    $second = Convert-SecureStringToText $secondSecure
    if ($first.Length -lt 8) {
      Write-Host 'Parola en az 8 karakter olmali.' -ForegroundColor Yellow
      continue
    }
    if ($first -cne $second) {
      Write-Host 'Parolalar ayni degil.' -ForegroundColor Yellow
      continue
    }
    $configuration = [ordered]@{
      userName = $userName
      passwordHash = Get-Sha256 $first
      updatedAt = [DateTime]::UtcNow.ToString('o')
    }
    [IO.File]::WriteAllText($accessFile, ($configuration | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    return $configuration
  }
}

function Find-Tailscale {
  $command = Get-Command 'tailscale.exe' -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
  if (Test-Path -LiteralPath $candidate) { return $candidate }
  return $null
}

function Install-Tailscale {
  $winget = Get-Command 'winget.exe' -ErrorAction SilentlyContinue
  if (-not $winget) { throw 'Windows Paket Yoneticisi (winget) bulunamadi; Tailscale otomatik kurulamadi.' }
  Write-Host 'Ilk kurulum: sabit HTTPS adresi icin Tailscale kuruluyor...' -ForegroundColor Cyan
  & $winget.Source install --id Tailscale.Tailscale --exact --source winget --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw 'Tailscale kurulumu tamamlanamadi.' }
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $found = Find-Tailscale
    if ($found) { return $found }
    Start-Sleep -Milliseconds 500
  }
  throw 'Tailscale kuruldu ancak komut satiri araci bulunamadi. Windows oturumunu yenileyip tekrar deneyin.'
}

function Needs-Build {
  $distIndex = Join-Path $projectRoot 'dist\index.html'
  if (-not (Test-Path -LiteralPath $distIndex)) { return $true }
  $builtAt = (Get-Item -LiteralPath $distIndex).LastWriteTimeUtc
  $inputPaths = @(
    (Join-Path $projectRoot 'src'),
    (Join-Path $projectRoot 'server'),
    (Join-Path $projectRoot 'scripts'),
    (Join-Path $projectRoot 'public'),
    (Join-Path $projectRoot 'index.html'),
    (Join-Path $projectRoot 'package.json'),
    (Join-Path $projectRoot 'package-lock.json'),
    (Join-Path $projectRoot 'vite.config.ts'),
    (Join-Path $projectRoot 'tsconfig.json')
  )
  foreach ($inputPath in $inputPaths) {
    if (-not (Test-Path -LiteralPath $inputPath)) { continue }
    $item = Get-Item -LiteralPath $inputPath
    if (-not $item.PSIsContainer -and $item.LastWriteTimeUtc -gt $builtAt) { return $true }
    if ($item.PSIsContainer) {
      $newer = Get-ChildItem -LiteralPath $inputPath -Recurse -File | Where-Object { $_.LastWriteTimeUtc -gt $builtAt } | Select-Object -First 1
      if ($newer) { return $true }
    }
  }
  return $false
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Remove-Item -LiteralPath $previewOutput, $previewError, $voiceOutput, $voiceError, $ollamaOutput, $ollamaError, $tailscaleLoginOutput, $tailscaleLoginError -Force -ErrorAction SilentlyContinue

if ($EmergencyGate) {
  $access = if ($ResetPassword -or -not (Test-Path -LiteralPath $accessFile)) {
    Save-AccessConfiguration
  } else {
    Get-Content -LiteralPath $accessFile -Raw | ConvertFrom-Json
  }
  if (-not $access.passwordHash) { $access = Save-AccessConfiguration }
  $env:PEHLEVAN_EMERGENCY_GATE = '1'
  $env:PEHLEVAN_SHARE_USER = $userName
  $env:PEHLEVAN_SHARE_PASSWORD_HASH = [string]$access.passwordHash
}
$previewProcess = $null
$voiceProcess = $null
$ollamaProcess = $null

try {
  Push-Location $projectRoot
  Write-Host ''
  Write-Host 'Pehlevan Royale genel yayin sunucusu baslatiliyor...' -ForegroundColor Cyan

  if (Needs-Build) {
    Write-Host 'Kod degisikligi bulundu; bir kez uretim derlemesi yapiliyor.' -ForegroundColor DarkGray
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Uretim derlemesi tamamlanamadi.' }
  } else {
    Write-Host 'Hazir derleme kullaniliyor; yeniden paketleme atlandi.' -ForegroundColor DarkGray
  }

  $nodeCommand = Get-Command 'node.exe' -ErrorAction Stop
  $viteScript = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
  if (-not (Test-Path -LiteralPath $viteScript)) { throw 'Vite sunucu dosyasi bulunamadi; npm install calistirin.' }
  $existingListeners = @(Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $existingListeners) {
    $existingProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $isProjectPreview = $existingProcess -and $existingProcess.Name -eq 'node.exe' -and
      $existingProcess.CommandLine -like "*$viteScript*" -and $existingProcess.CommandLine -match '\bpreview\b'
    if (-not $isProjectPreview) { throw "4173 portu baska bir uygulama tarafindan kullaniliyor (PID $($listener.OwningProcess))." }
    Write-Host "Onceki Pehlevan Royale sunucusu kapatiliyor (PID $($listener.OwningProcess))." -ForegroundColor DarkGray
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
    Start-Sleep -Milliseconds 500
  }
  $quotedViteScript = '"' + $viteScript + '"'
  $previewProcess = Start-Process -FilePath $nodeCommand.Source `
    -ArgumentList @($quotedViteScript, 'preview', '--strictPort') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $previewOutput `
    -RedirectStandardError $previewError `
    -PassThru

  $previewReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($previewProcess.HasExited) { break }
    try {
      Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 2 | Out-Null
      $previewReady = $true
      break
    } catch {
      if ($EmergencyGate -and $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $previewReady = $true; break }
    }
    Start-Sleep -Milliseconds 300
  }
  if (-not $previewReady) {
    $previewDetails = if (Test-Path -LiteralPath $previewError) { Get-Content -LiteralPath $previewError -Raw } else { '' }
    throw "Yerel oyun sunucusu acilamadi. $previewDetails"
  }

  $ownerSetupNeeded = $false
  try {
    $authStatus = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/auth/status' -TimeoutSec 3
    $ownerSetupNeeded = [bool]$authStatus.needsOwnerSetup
  } catch { }
  if ($ownerSetupNeeded) {
    Write-Host ''
    Write-Host 'Ilk hesap kurulumu gerekiyor. Yerel owner parola ekrani aciliyor.' -ForegroundColor Yellow
    Write-Host 'Bu ekran yalniz bu bilgisayarda calisir; bir kez parolani belirlemen yeterli.' -ForegroundColor DarkGray
    Start-Process 'http://127.0.0.1:4173/'
  }

  $tailscalePath = Find-Tailscale
  if (-not $tailscalePath) { $tailscalePath = Install-Tailscale }

  $statusJson = & $tailscalePath status --json 2>$null
  $backendState = $null
  if ($LASTEXITCODE -eq 0 -and $statusJson) {
    try { $backendState = ($statusJson | ConvertFrom-Json).BackendState } catch { $backendState = $null }
  }
  if ($backendState -ne 'Running') {
    Write-Host ''
    Write-Host 'Ilk kurulum: acilan sayfada Tailscale hesabina bir kez giris yapin.' -ForegroundColor Yellow
    $loginProcess = Start-Process -FilePath $tailscalePath -ArgumentList @('up') -WindowStyle Hidden -RedirectStandardOutput $tailscaleLoginOutput -RedirectStandardError $tailscaleLoginError -PassThru
    $loginPageOpened = $false
    for ($attempt = 0; $attempt -lt 180; $attempt++) {
      $freshStatus = & $tailscalePath status --json 2>$null
      if ($LASTEXITCODE -eq 0 -and $freshStatus) {
        try {
          $freshState = $freshStatus | ConvertFrom-Json
          if ($freshState.BackendState -eq 'Running') { break }
          if (-not $loginPageOpened -and $freshState.AuthURL) {
            Start-Process ([string]$freshState.AuthURL)
            $loginPageOpened = $true
          }
        } catch { }
      }
      Start-Sleep -Seconds 1
    }
    $finalStatus = & $tailscalePath status --json 2>$null | ConvertFrom-Json
    if ($finalStatus.BackendState -ne 'Running') {
      if ($loginProcess -and -not $loginProcess.HasExited) { Stop-Process -Id $loginProcess.Id -Force -ErrorAction SilentlyContinue }
      throw 'Tailscale oturumu 3 dakika icinde onaylanmadi.'
    }
  }

  $funnelResult = & $tailscalePath funnel --bg 4173 2>&1
  if ($LASTEXITCODE -ne 0) {
    $approvalUrl = [regex]::Match(($funnelResult -join "`n"), 'https://login\.tailscale\.com/[^\s]+').Value
    if ($approvalUrl) {
      Write-Host 'Ilk kurulum: acilan sayfadan genel internet yayinina izin verin.' -ForegroundColor Yellow
      Start-Process $approvalUrl
      for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Seconds 2
        $funnelResult = & $tailscalePath funnel --bg 4173 2>&1
        if ($LASTEXITCODE -eq 0) { break }
      }
    }
  }
  if ($LASTEXITCODE -ne 0) { throw "Genel internet yayini acilamadi. $($funnelResult -join ' ')" }

  $funnelStatus = & $tailscalePath funnel status 2>&1
  $publicUrl = [regex]::Match(($funnelStatus -join "`n"), 'https://[a-zA-Z0-9.-]+\.ts\.net').Value
  if (-not $publicUrl) { throw "Sabit yayin adresi okunamadi. $($funnelStatus -join ' ')" }

  # Optional local AI services start after the page is ready, so model and
  # voice warmup can never hold up the public URL.
  try {
    Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 1 | Out-Null
  } catch {
    $ollamaCommand = Get-Command 'ollama.exe' -ErrorAction SilentlyContinue
    if ($ollamaCommand) {
      $ollamaProcess = Start-Process -FilePath $ollamaCommand.Source -ArgumentList @('serve') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $ollamaOutput -RedirectStandardError $ollamaError -PassThru
    }
  }
  try {
    Invoke-WebRequest -Uri 'http://127.0.0.1:8765/health' -UseBasicParsing -TimeoutSec 1 | Out-Null
  } catch {
    $voicePython = Join-Path $projectRoot '.venv-voice\Scripts\python.exe'
    $voiceScript = Join-Path $projectRoot 'voice_server.py'
    if ((Test-Path -LiteralPath $voicePython) -and (Test-Path -LiteralPath $voiceScript)) {
      $quotedVoiceScript = '"' + $voiceScript + '"'
      $voiceProcess = Start-Process -FilePath $voicePython -ArgumentList @($quotedVoiceScript) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $voiceOutput -RedirectStandardError $voiceError -PassThru
    }
  }

  Write-Host ''
  Write-Host 'GENEL YAYINA HAZIR' -ForegroundColor Green
  Write-Host "Adres     : $publicUrl" -ForegroundColor White
  $localAddress = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4Address -and $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Where-Object { $_ -notlike '127.*' -and $_ -notlike '169.254.*' } |
    Select-Object -First 1
  if ($localAddress) {
    Write-Host "Ayni ag   : http://${localAddress}:4173 (en hizli baglanti)" -ForegroundColor Cyan
  }
  Write-Host 'Giris     : Herkes uygulamadaki kendi hesabini kullanir.' -ForegroundColor White
  Write-Host 'Kayit     : Yeni uyelikler owner onayindan sonra acilir.' -ForegroundColor White
  if ($ownerSetupNeeded) { Write-Host 'Ilk adim  : Acilan localhost ekraninda owner parolani belirle.' -ForegroundColor Yellow }
  Write-Host ''
  Write-Host 'Ayni Wi-Fi/LAN icinde "Ayni ag" adresi; disaridan sabit HTTPS adresi kullanilir.' -ForegroundColor DarkGray
  Write-Host 'Bilgisayar acik ve bu pencere calisiyor olmali. Kapatmak icin Enter tusuna basin.' -ForegroundColor DarkGray
  Set-Clipboard -Value $publicUrl
  if (-not $ownerSetupNeeded) { Start-Process $publicUrl }
  Read-Host | Out-Null
} finally {
  if ($previewProcess -and -not $previewProcess.HasExited) { Stop-Process -Id $previewProcess.Id -Force -ErrorAction SilentlyContinue }
  if ($voiceProcess -and -not $voiceProcess.HasExited) { Stop-Process -Id $voiceProcess.Id -Force -ErrorAction SilentlyContinue }
  if ($ollamaProcess -and -not $ollamaProcess.HasExited) { Stop-Process -Id $ollamaProcess.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:\PEHLEVAN_SHARE_USER -ErrorAction SilentlyContinue
  Remove-Item Env:\PEHLEVAN_SHARE_PASSWORD_HASH -ErrorAction SilentlyContinue
  Remove-Item Env:\PEHLEVAN_EMERGENCY_GATE -ErrorAction SilentlyContinue
  Pop-Location -ErrorAction SilentlyContinue
}
