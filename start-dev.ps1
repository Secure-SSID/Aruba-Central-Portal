# PowerShell script to start both backend and frontend in development mode
# This opens two separate terminal windows

Write-Host "Starting Aruba Central Portal Development Environment..." -ForegroundColor Green
Write-Host ""

# Get the current directory
$projectRoot = $PWD

# Start backend in a new window
Write-Host "Starting backend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; .\start-backend.ps1"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend in a new window
Write-Host "Starting frontend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; .\start-frontend.ps1"

Write-Host ""
Write-Host "Development servers are starting in separate windows:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:1344" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5000 (API only)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the terminal windows to stop the servers." -ForegroundColor Yellow

