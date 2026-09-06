[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$projectDirectory = $PSScriptRoot
$repositoryUrl = "https://github.com/GandalfTheGrayy/Royale.git"
$branch = "main"
$server = "root@141.98.51.125"
$serverDirectory = "/opt/pehlevan-royale"
$liveUrl = "https://royale.141-98-51-125.sslip.io"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Program,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Komut basarisiz oldu ($LASTEXITCODE): $Program $($Arguments -join ' ')"
    }
}

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

Set-Location -LiteralPath $projectDirectory

try {
    Write-Step "Gerekli araclar kontrol ediliyor"
    foreach ($program in @("git", "npm", "ssh")) {
        if (-not (Get-Command $program -ErrorAction SilentlyContinue)) {
            throw "'$program' bulunamadi. Git, Node.js ve Windows OpenSSH kurulu olmali."
        }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory ".git"))) {
        Write-Step "Yerel Git deposu hazirlaniyor"
        Invoke-Checked git init
        Invoke-Checked git branch -M $branch
        Invoke-Checked git remote add origin $repositoryUrl
    }

    $origin = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0) {
        Invoke-Checked git remote add origin $repositoryUrl
    } elseif ($origin.Trim() -ne $repositoryUrl) {
        Invoke-Checked git remote set-url origin $repositoryUrl
    }

    Write-Step "Bagimliliklar kilit dosyasina gore guncelleniyor"
    Invoke-Checked npm install --no-audit --no-fund

    Write-Step "Testler calistiriliyor"
    Invoke-Checked npm test

    Write-Step "Uretim paketi yerelde dogrulaniyor"
    Invoke-Checked npm run build

    Write-Step "Degisiklikler GitHub icin hazirlaniyor"
    Invoke-Checked git add --all
    & git diff --cached --quiet
    $diffExit = $LASTEXITCODE
    if ($diffExit -eq 1) {
        $commitMessage = "deploy: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Invoke-Checked git commit -m $commitMessage
    } elseif ($diffExit -ne 0) {
        throw "Git degisiklik kontrolu basarisiz oldu ($diffExit)."
    } else {
        Write-Host "Yeni yerel degisiklik yok; mevcut commit dagitilacak." -ForegroundColor DarkGray
    }

    Write-Step "GitHub'a gonderiliyor"
    Invoke-Checked git push --set-upstream origin $branch

    Write-Step "Sunucu guncelleniyor ve canliya aliniyor"
    $remoteCommand = "set -e; if [ ! -d '$serverDirectory/.git' ]; then git clone --branch '$branch' '$repositoryUrl' '$serverDirectory'; fi; bash '$serverDirectory/deploy/server-deploy.sh'"
    Invoke-Checked ssh -o BatchMode=yes -o ConnectTimeout=15 $server $remoteCommand

    Write-Step "Disaridan HTTPS kontrolu yapiliyor"
    $status = Invoke-RestMethod -Uri "$liveUrl/api/auth/status" -TimeoutSec 30
    if ($null -eq $status.needsOwnerSetup) {
        throw "Canli servis beklenen saglik yanitini vermedi."
    }

    Write-Host ""
    Write-Host "CANLI: $liveUrl" -ForegroundColor Green
    Write-Host "Dagitim basariyla tamamlandi." -ForegroundColor Green
    exit 0
} catch {
    Write-Host ""
    Write-Host "DAGITIM HATASI: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
