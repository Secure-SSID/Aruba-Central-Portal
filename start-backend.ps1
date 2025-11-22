# PowerShell script to start the Flask backend server
# Run this in one terminal window

Write-Host "Starting Aruba Central Portal Backend..." -ForegroundColor Green
Write-Host ""

# Activate virtual environment
if (Test-Path "venv\Scripts\Activate.ps1") {
    & "venv\Scripts\Activate.ps1"
} else {
    Write-Host "Error: Virtual environment not found. Run: python -m venv venv" -ForegroundColor Red
    exit 1
}

# Set environment variables
$env:FLASK_ENV = "development"
$env:FLASK_APP = "dashboard\backend\app.py"
$env:PYTHONPATH = $PWD
$env:TOKEN_CACHE_DIR = "$PWD\data"

# Create data directory if it doesn't exist
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
}

# Change to backend directory and run Flask
Set-Location dashboard\backend
Write-Host "Backend API will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend will proxy /api requests to this backend" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Run Flask in development mode (on port 5000, frontend on 1344 will proxy to it)
python -m flask run --host=0.0.0.0 --port=5000 --debug

