# PowerShell script to build the frontend
# This script will check for Node.js and build the frontend if Node.js is available

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Aruba Central Portal - Frontend Builder" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
$nodeInstalled = $false
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
            $nodeInstalled = $true
        }
    } catch {
        $nodeInstalled = $false
    }
}

if (-not $nodeInstalled) {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js to build the frontend:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Download Node.js LTS from: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "2. Run the installer with default options" -ForegroundColor Cyan
    Write-Host "3. RESTART your PowerShell/terminal after installation" -ForegroundColor Yellow
    Write-Host "4. Run this script again: .\build-frontend.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Alternative: You can use Docker to build and run the entire application:" -ForegroundColor Yellow
    Write-Host "  docker-compose up -d" -ForegroundColor Cyan
    Write-Host ""
    
    # Open Node.js download page
    $response = Read-Host "Would you like to open the Node.js download page now? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Start-Process "https://nodejs.org/"
    }
    
    exit 1
}

# Check if npm is available
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host "✗ npm is not available!" -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "✗ npm is not available!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ npm is not available!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Navigate to frontend directory
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $scriptRoot "dashboard\frontend"

if (-not (Test-Path $frontendDir)) {
    Write-Host "✗ Frontend directory not found: $frontendDir" -ForegroundColor Red
    exit 1
}

Push-Location $frontendDir
Write-Host "Changed to frontend directory: $frontendDir" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists, if not, install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes..." -ForegroundColor Yellow
    Write-Host ""
    
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "✗ Failed to install dependencies!" -ForegroundColor Red
        Write-Host "Try running: npm install --legacy-peer-deps" -ForegroundColor Yellow
        Pop-Location
        exit 1
    }
    
    Write-Host ""
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
    Write-Host ""
}

# Build the frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Write-Host "This may take a minute..." -ForegroundColor Yellow
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Build failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    Pop-Location
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✓ Frontend built successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Check if build directory was created
$buildDir = Join-Path $frontendDir "build"
if (Test-Path $buildDir) {
    Write-Host "Build output location: $buildDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Make sure the backend server is running on port 1344" -ForegroundColor Cyan
    Write-Host "2. Open your browser and go to: http://localhost:1344/" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if backend is running
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:1344/api/health" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✓ Backend server is running!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now access the web interface at:" -ForegroundColor Green
        Write-Host "  http://localhost:1344/" -ForegroundColor Cyan
        Write-Host ""
    } catch {
        Write-Host "⚠ Backend server is not running on port 1344" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Start the backend server:" -ForegroundColor Yellow
        Write-Host "  .\start-backend.ps1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or run it directly on port 1344:" -ForegroundColor Yellow
        Write-Host "  cd dashboard\backend" -ForegroundColor Cyan
        Write-Host "  python app.py" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Host "⚠ Warning: Build directory was not created" -ForegroundColor Yellow
    Write-Host "Check the build output above for errors." -ForegroundColor Yellow
}

Pop-Location
