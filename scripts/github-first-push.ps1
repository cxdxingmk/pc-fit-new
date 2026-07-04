#requires -Version 5.1
<#
  Enterprise Public Push Automation Script
  Purpose:
  1) Prepare a local Next.js repo for safe GitHub public publishing.
  2) Enforce basic hygiene around tracked build artifacts and secret-like files.
  3) Execute first commit + branch setup + origin binding + push.

  Usage example:
  powershell -ExecutionPolicy Bypass -File .\scripts\github-first-push.ps1 -RepoUrl "https://github.com/<owner>/<repo>.git"
#>

[CmdletBinding()]
param(
  # GitHub remote repository URL. Example: https://github.com/org/repo.git
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl,

  # Target branch name for initial push.
  [Parameter(Mandatory = $false)]
  [string]$Branch = "main",

  # Commit message for the initial publication commit.
  [Parameter(Mandatory = $false)]
  [string]$CommitMessage = "chore: initial public release with hardened gitignore"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "`n[STEP] $Message" -ForegroundColor Cyan
}

function Ensure-Command {
  param([string]$CommandName)
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $CommandName. Install it and retry."
  }
}

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git command failed: git $($Args -join ' ')"
  }
}

function Get-GitOutput {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $output = & git @Args 2>$null
  if ($LASTEXITCODE -ne 0) {
    return ""
  }
  return ($output | Out-String).Trim()
}

# Resolve project root as script parent parent: /scripts -> project root
$ScriptDirectory = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $ScriptDirectory
Set-Location $ProjectRoot

Write-Host "Project root: $ProjectRoot" -ForegroundColor DarkGray

Write-Step "Validate prerequisites"
Ensure-Command -CommandName "git"

Write-Step "Initialize Git repository if missing"
if (-not (Test-Path ".git")) {
  Invoke-Git init
}

Write-Step "Prevent accidental tracking of heavy/secret outputs"
# These commands are safe even if paths are not tracked.
& git rm -r --cached --ignore-unmatch node_modules .next out .env .env.local .env.development.local .env.test.local .env.production.local *.env.json
if ($LASTEXITCODE -ne 0) {
  throw "Failed while removing cached sensitive/build files from index."
}

Write-Step "Stage all intended files"
Invoke-Git add .

Write-Step "Create commit when there are staged changes"
$Staged = Get-GitOutput diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($Staged)) {
  Write-Host "No staged changes found. Skipping commit." -ForegroundColor Yellow
} else {
  Invoke-Git commit -m $CommitMessage
}

Write-Step "Set primary branch name"
Invoke-Git branch -M $Branch

Write-Step "Configure origin remote"
$ExistingOrigin = Get-GitOutput remote get-url origin
if ([string]::IsNullOrWhiteSpace($ExistingOrigin)) {
  Invoke-Git remote add origin $RepoUrl
} else {
  Invoke-Git remote set-url origin $RepoUrl
}

Write-Step "Push to GitHub"
Invoke-Git push -u origin $Branch

Write-Host "`n[OK] Public repository first push completed." -ForegroundColor Green
Write-Host "Verify repository visibility and branch protection in GitHub settings." -ForegroundColor Green
