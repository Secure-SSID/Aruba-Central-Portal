# Fix: http://localhost:1344/ Not Working

## Status

✅ **Backend server is running** on port 1344  
❌ **Frontend is not built** - This is why the web interface doesn't work

The API endpoints are working (tested: `http://localhost:1344/api/health`), but the web UI requires the frontend to be built first.

## Quick Fix

### Option 1: Use the Automated Build Script (Easiest)

**To fix the execution policy issue, run:**
```powershell
cd F:\DockerClone\aruba-central-portal
powershell -ExecutionPolicy Bypass -File .\build-frontend-simple.ps1
```

Or if you prefer the full script:
```powershell
powershell -ExecutionPolicy Bypass -File .\build-frontend.ps1
```

The script will:
- ✅ Check if Node.js is installed
- ✅ Guide you to install Node.js if needed (opens download page)
- ✅ Install frontend dependencies automatically
- ✅ Build the frontend for you
- ✅ Verify everything is working

**After installing Node.js, RESTART PowerShell and run the script again!**

### Option 2: Manual Build (If you prefer)

1. **Install Node.js** (if not already installed):
   - Download from: https://nodejs.org/ (LTS version recommended)
   - Install with default options
   - **Restart your terminal/PowerShell after installation**

2. **Build the frontend**:
   ```powershell
   cd F:\DockerClone\aruba-central-portal\dashboard\frontend
   npm install
   npm run build
   ```

3. **Restart the backend** (if it's running):
   - Stop the current backend process (Ctrl+C in its terminal)
   - Start it again: `.\start-backend.ps1` or run it directly on port 1344

4. **Access the web interface**: http://localhost:1344/

### Option 2: Development Mode (Frontend + Backend)

If you want hot-reloading for development:

1. **Install Node.js** (same as above)

2. **Start both services**:
   ```powershell
   cd F:\DockerClone\aruba-central-portal
   .\start-dev.ps1
   ```
   This will:
   - Start backend on port 5000 (for API)
   - Start frontend on port 1344 (web UI with hot-reload)

3. **Access**: http://localhost:1344/

### Option 3: Use Docker (Alternative)

If you have Docker installed:

```powershell
cd F:\DockerClone\aruba-central-portal
docker-compose up -d
```

## Verify Installation

Check if Node.js is installed:
```powershell
node --version
npm --version
```

If these commands work, you're ready to build the frontend!

## Current Status

- ✅ Backend running on port 1344
- ✅ API endpoints working (test: `http://localhost:1344/api/health`)
- ❌ Frontend not built (need Node.js)

## Next Steps

1. Install Node.js from https://nodejs.org/
2. Run `npm install` and `npm run build` in the frontend directory
3. Access http://localhost:1344/ again

---

**Note**: The backend server is currently running in the background. If you need to stop it, you can find the process using:
```powershell
netstat -ano | findstr :1344
```
Then kill the process ID if needed.

