# Quick Start - Development Mode

## Prerequisites

- **Python 3.10+** - Required for backend
- **Node.js 18+** - Required for frontend (https://nodejs.org/)

## Quick Setup

### Option 1: Linux/macOS

```bash
# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend (in a new terminal)
cd dashboard/frontend
npm install
npm run dev
```

### Option 2: Windows (PowerShell)

```powershell
# Backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend (in a new terminal)
cd dashboard\frontend
npm install
npm run dev
```

## Start Development Servers

### Start Both Services

**Linux/macOS:**
```bash
# Terminal 1 - Backend
source venv/bin/activate
cd dashboard/backend
python app.py

# Terminal 2 - Frontend
cd dashboard/frontend
npm run dev
```

**Windows:**
```powershell
# Use the convenience script
.\start-dev.ps1
```

### Access Points
- **Frontend**: http://localhost:1344 (main entry point)
- **Backend API**: http://localhost:5000 (proxied by frontend)

## Configuration

1. Start both servers
2. Open http://localhost:1344
3. Use the Setup Wizard to configure your Aruba Central API credentials
4. The `.env` file will be automatically updated

## Project Structure

```
aruba-central-portal/
├── dashboard/
│   ├── backend/          # Flask API server
│   │   └── app.py        # Main Flask application
│   └── frontend/         # React frontend
│       ├── src/          # React source code
│       └── package.json  # Node.js dependencies
├── scripts/              # Automation scripts
│   ├── discovery/        # API exploration
│   ├── network/wlan/     # WLAN management
│   ├── users/            # User management
│   ├── monitoring/       # Health checks
│   └── testing/          # Integration tests
├── utils/                # Shared Python utilities
├── tests/                # Unit tests (pytest)
├── venv/                 # Python virtual environment
└── .env                  # Environment variables
```

## Running Tests

```bash
# Unit tests
pytest

# With coverage
pytest --cov=utils --cov-report=term-missing

# Code quality
black .
ruff check .
```

## Troubleshooting

### Port 1344 already in use

**Linux/macOS:**
```bash
lsof -i :1344
kill -9 <PID>
```

**Windows:**
```powershell
netstat -ano | findstr :1344
taskkill /PID <PID> /F
```

### Module not found errors

```bash
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### npm install fails

```bash
cd dashboard/frontend
npm cache clean --force
npm install
```

## More Information

- **[DEV_SETUP.md](DEV_SETUP.md)** - Detailed setup instructions
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines
- **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)** - System architecture
