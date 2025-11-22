# Simple PowerShell script to build the frontend
# Run with: powershell -ExecutionPolicy Bypass -File .\build-frontend-simple.ps1

Write-Host "Building Frontend..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is in PATH, if not, add common installation locations
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    # Try to find Node.js in common locations
    $nodePaths = @(
        "C:\Program Files\nodejs",
        "$env:ProgramFiles\nodejs",
        "$env:LOCALAPPDATA\Programs\nodejs"
    )
    
    $nodeFound = $false
    foreach ($path in $nodePaths) {
        $nodeExe = Join-Path $path "node.exe"
        if (Test-Path $nodeExe) {
            Write-Host "Found Node.js at: $path" -ForegroundColor Yellow
            Write-Host "Adding to PATH for this session..." -ForegroundColor Yellow
            $env:PATH = "$path;$env:PATH"
            $nodeFound = $true
            break
        }
    }
    
    if (-not $nodeFound) {
        Write-Host "Node.js is not installed or not in PATH!" -ForegroundColor Red
        Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
        Write-Host "After installing, RESTART PowerShell and run this script again." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "If Node.js is installed but not working, add it to PATH:" -ForegroundColor Yellow
        Write-Host "  1. Search for 'Environment Variables' in Windows" -ForegroundColor Cyan
        Write-Host "  2. Edit System Environment Variables" -ForegroundColor Cyan
        Write-Host "  3. Add C:\Program Files\nodejs to PATH" -ForegroundColor Cyan
        Start-Process "https://nodejs.org/"
        exit 1
    }
}

Write-Host "Node.js found: $(node --version)" -ForegroundColor Green
Write-Host ""

# Navigate to frontend
$frontendPath = Join-Path $PSScriptRoot "dashboard\frontend"
if (-not (Test-Path $frontendPath)) {
    Write-Host "Frontend directory not found!" -ForegroundColor Red
    exit 1
}

Set-Location $frontendPath
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Install failed! Trying with --legacy-peer-deps..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
}

Write-Host ""
Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Access: http://localhost:1344/" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Build failed! Check errors above." -ForegroundColor Red
}

Set-Location $PSScriptRoot

