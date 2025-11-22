# Quick Start - Development Mode

## ✅ Current Status

- ✅ Python virtual environment created
- ✅ Backend dependencies installed
- ✅ Development scripts created
- ⚠️ Node.js needed for frontend (install from https://nodejs.org/)

## 🚀 Start Development

### Option 1: Start Both Services (Recommended)

```powershell
.\start-dev.ps1
```

This opens two separate terminal windows:
- **Frontend**: http://localhost:1344 (main entry point)
- **Backend API**: http://localhost:5000 (proxied by frontend)

### Option 2: Start Separately

**Terminal 1 - Backend:**
```powershell
.\start-backend.ps1
```

**Terminal 2 - Frontend (after installing Node.js):**
```powershell
.\start-frontend.ps1
```

## 📝 First Time Frontend Setup

After installing Node.js:

```powershell
cd dashboard\frontend
npm install
npm run dev
```

## 🔧 Configuration

1. Start both servers with `.\start-dev.ps1`
2. Open http://localhost:1344 in your browser
3. Use the Setup Wizard to configure your Aruba Central API credentials
4. The `.env` file will be automatically updated

## 📚 More Information

See `DEV_SETUP.md` for detailed setup instructions and troubleshooting.

