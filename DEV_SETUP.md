# Development Setup Guide

This guide will help you set up a local development environment for the Aruba Central Portal.

## Prerequisites

1. **Python 3.10+** (✅ Already installed: Python 3.10.11)
2. **Node.js 18+** (⚠️ Not installed - see below)
3. **npm** (comes with Node.js)

## Setup Steps

### 1. Python Backend (✅ Already Set Up)

The Python virtual environment has been created and dependencies installed.

**To start the backend:**
```powershell
.\start-backend.ps1
```

Or manually:
```powershell
.\venv\Scripts\Activate.ps1
cd dashboard\backend
$env:FLASK_ENV="development"
$env:FLASK_APP="app.py"
python -m flask run --host=0.0.0.0 --port=1344 --debug
```

The backend API will be available at: **http://localhost:5000** (frontend proxies to it)

### 2. Node.js Frontend (⚠️ Needs Setup)

**Install Node.js:**
1. Download from: https://nodejs.org/ (LTS version recommended)
2. Install with default options
3. Restart your terminal/PowerShell

**After installing Node.js, set up the frontend:**
```powershell
cd dashboard\frontend
npm install
```

**To start the frontend:**
```powershell
.\start-frontend.ps1
```

Or manually:
```powershell
cd dashboard\frontend
npm run dev
```

The frontend will be available at: **http://localhost:1344**

### 3. Start Both Services

**Option 1: Use the convenience script (opens separate windows):**
```powershell
.\start-dev.ps1
```

**Option 2: Run in separate terminals:**
- Terminal 1: `.\start-backend.ps1` (runs on port 5000)
- Terminal 2: `.\start-frontend.ps1` (runs on port 1344, proxies /api to backend)

## Development Workflow

1. **Backend changes**: The Flask server will auto-reload when you save Python files
2. **Frontend changes**: Vite will hot-reload React components automatically
3. **API calls**: Frontend at `localhost:1344` proxies `/api/*` requests to backend at `localhost:5000`

## Configuration

The `.env` file in the project root contains your Aruba Central API credentials. You can configure these through the web interface at `http://localhost:1344` (Setup Wizard) or edit the file directly.

**Required environment variables:**
- `ARUBA_BASE_URL` - Aruba Central API base URL
- `ARUBA_CLIENT_ID` - Your API client ID
- `ARUBA_CLIENT_SECRET` - Your API client secret
- `ARUBA_CUSTOMER_ID` - Your customer ID

## Project Structure

```
aruba-central-portal/
├── dashboard/
│   ├── backend/          # Flask API server
│   │   └── app.py        # Main Flask application
│   └── frontend/         # React frontend
│       ├── src/          # React source code
│       └── package.json  # Node.js dependencies
├── venv/                 # Python virtual environment
├── .env                  # Environment variables (API credentials)
├── start-backend.ps1     # Backend startup script
├── start-frontend.ps1    # Frontend startup script
└── start-dev.ps1        # Start both services
```

## Troubleshooting

### Backend Issues

**Port 1344 already in use:**
```powershell
# Find what's using the port
netstat -ano | findstr :1344
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Module not found errors:**
```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r dashboard\backend\requirements.txt
```

### Frontend Issues

**Node.js not found:**
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation

**npm install fails:**
```powershell
cd dashboard\frontend
npm cache clean --force
npm install
```

**Port 1344 already in use:**
- Check what's using the port: `netstat -ano | findstr :1344`
- Kill the process if needed: `taskkill /PID <PID> /F`
- Or change the port in `dashboard/frontend/vite.config.js`

## Next Steps

1. Install Node.js if you haven't already
2. Run `.\start-dev.ps1` to start both services
3. Open `http://localhost:1344` in your browser
4. Use the Setup Wizard to configure your Aruba Central API credentials
5. Start coding! 🚀

## Port Configuration

- **Frontend**: http://localhost:1344 (Vite dev server)
- **Backend API**: http://localhost:5000 (Flask API, proxied by frontend)
- **Docker Production**: http://localhost:1344 (backend serves built frontend)

