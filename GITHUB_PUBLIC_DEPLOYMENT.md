# GitHub Public Deployment Guide (Security-First)

## 1) Pre-check
- Confirm .gitignore excludes build artifacts, dependencies, secrets, and IDE metadata.
- Never push .env files, local DB dumps, session tokens, or private keys.

## 2) One-command automation (recommended)
Run this from project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github-first-push.ps1 -RepoUrl "https://github.com/<owner>/<repo>.git"
```

Optional parameters:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github-first-push.ps1 -RepoUrl "https://github.com/<owner>/<repo>.git" -Branch "main" -CommitMessage "chore: initial secure public release"
```

## 3) Manual Git CLI command set (fully expanded)
If you want to run each command manually:

```powershell
# Move to project root
Set-Location "C:\Users\rhkra\OneDrive\Desktop\coding\pc-fit-new"

# Initialize git if needed
if (-not (Test-Path ".git")) { git init }

# Remove accidentally tracked generated/secret files from index only
# (keeps local files on disk)
git rm -r --cached --ignore-unmatch node_modules .next out .env .env.local .env.development.local .env.test.local .env.production.local *.env.json

# Stage safe files
git add .

# First commit
git commit -m "chore: initial public release with hardened gitignore"

# Use main as canonical branch
git branch -M main

# Connect your GitHub repo as origin
# If origin does not exist:
git remote add origin https://github.com/<owner>/<repo>.git

# If origin already exists, update it:
git remote set-url origin https://github.com/<owner>/<repo>.git

# Push to GitHub
git push -u origin main
```

## 4) GitHub-side hardening checklist
- Repository visibility: Public (intended)
- Branch protection: enable on main
- Secret scanning: enable in repository settings
- Dependabot alerts: enable
- Require pull request review for main (recommended)

## 5) If push fails
- "git not found": install Git for Windows and reopen terminal.
- Authentication error: configure GitHub credential manager or personal access token.
- Large file error: remove generated binaries and push again.
