# PowerShell script to start the React frontend development server
# Run this in a separate terminal window
# Requires Node.js to be installed

Write-Host "Starting Aruba Central Portal Frontend..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
    Write-Host "npm version: $npmVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installing Node.js, run:" -ForegroundColor Yellow
    Write-Host "  cd dashboard\frontend" -ForegroundColor Cyan
    Write-Host "  npm install" -ForegroundColor Cyan
    Write-Host "  npm run dev" -ForegroundColor Cyan
    exit 1
}

# Check if node_modules exists, if not, install dependencies
if (-not (Test-Path "dashboard\frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location dashboard\frontend
    npm install
    Set-Location ..\..
}

# Change to frontend directory and start dev server
Set-Location dashboard\frontend
Write-Host ""
Write-Host "Frontend will be available at: http://localhost:1344" -ForegroundColor Cyan
Write-Host "API requests will be proxied to: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start Vite dev server
npm run dev

