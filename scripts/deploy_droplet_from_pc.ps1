# Push local IntelliDocs-V4 to GitHub, then deploy on the DigitalOcean droplet.
# Run from your PC (PowerShell):
#   cd C:\xampp\htdocs\IntelliDocs
#   .\scripts\deploy_droplet_from_pc.ps1
param(
    [string]$DropletIp = "129.213.234.3",
    [string]$SshUser = "root",
    [string]$Branch = "IntelliDocs-V4",
    [string]$AppRoot = "/var/www/intellidocs",
    [switch]$SkipPush,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "=== IntelliDocs droplet deploy ===" -ForegroundColor Cyan
Write-Host "Repo:    $repoRoot"
Write-Host "Branch:  $Branch"
Write-Host "Droplet: ${SshUser}@${DropletIp}:${AppRoot}"
Write-Host ""

Push-Location $repoRoot
try {
    if (-not $SkipPush) {
        Write-Host "=== Git: ensure latest is on GitHub ===" -ForegroundColor Cyan
        $branchName = (git rev-parse --abbrev-ref HEAD).Trim()
        if ($branchName -ne $Branch) {
            Write-Host "Checking out $Branch (was on $branchName)..." -ForegroundColor Yellow
            git checkout $Branch
        }

        $localHead = (git rev-parse HEAD).Trim()
        git fetch origin 2>&1 | Out-Host
        $remoteHead = (git rev-parse "origin/$Branch" 2>$null).Trim()
        if ($LASTEXITCODE -ne 0 -or -not $remoteHead) {
            throw "Remote branch origin/$Branch not found. Push manually: git push origin refs/heads/${Branch}:refs/heads/${Branch}"
        }

        if ($localHead -ne $remoteHead) {
            $ahead = [int](git rev-list --count "origin/$Branch..HEAD")
            $behind = [int](git rev-list --count "HEAD..origin/$Branch")
            if ($behind -gt 0) {
                Write-Host "Local is $behind commit(s) behind origin/$Branch. Run: git pull origin $Branch" -ForegroundColor Red
                git log --oneline -3 "HEAD..origin/$Branch"
                throw "Pull required before deploy"
            }
            if ($ahead -gt 0) {
                Write-Host "Pushing $ahead local commit(s) to GitHub..." -ForegroundColor Yellow
                git push origin "refs/heads/${Branch}:refs/heads/${Branch}"
            }
        }
        else {
            Write-Host "GitHub already has latest: $localHead" -ForegroundColor Green
        }
        git log -1 --oneline
    }

    if ($SkipDeploy) {
        Write-Host ""
        Write-Host "SkipDeploy set - done after push." -ForegroundColor Green
        return
    }

    Write-Host ""
    Write-Host "=== SSH: pull and build on droplet ===" -ForegroundColor Cyan
    Write-Host "This usually takes several minutes. Wait for 'Deploy finished.'" -ForegroundColor Yellow

    $remoteCmd = 'cd ' + $AppRoot + ' && git fetch origin && git checkout -B ' + $Branch + ' origin/' + $Branch + ' && git reset --hard origin/' + $Branch + ' && git log -1 --oneline && bash scripts/deploy_droplet.sh'
    $sshTarget = "${SshUser}@${DropletIp}"

    & ssh -o ConnectTimeout=30 $sshTarget $remoteCmd
    $sshExit = $LASTEXITCODE
    if ($sshExit -ne 0) {
        throw "SSH deploy failed (exit $sshExit). Open DigitalOcean -> Droplet -> Access -> Launch Console and run the commands in DEPLOY_DROPLET.md"
    }

    Write-Host ""
    Write-Host "=== Deploy complete ===" -ForegroundColor Green
    Write-Host "Open: http://${DropletIp}/landing  (Ctrl+Shift+R hard refresh)"
    Write-Host "Check: Forgot password link on login, change-password flow, announcement images"
}
finally {
    Pop-Location
}
