# 🚀 Start Here - Aruba Central Portal

**Welcome!** This guide will get you up and running in 5 minutes.

> **⚠️ Important: Use the Setup Wizard!**
> Configure credentials through the web interface at `http://your-ip:1344` after starting the container.
> **Do NOT manually edit `.env` files** - the Setup Wizard handles everything automatically!

---

## 📋 Quick Navigation

### **New Users** 👋
- **[Quick Start Guide](#quick-start)** ← Start here!
- **[Setup Wizard Guide](docs/SETUP_WIZARD_GUIDE.md)** - Visual setup through web interface
- **[Video Tutorials](#video-tutorials)** - Watch how it works

### **Docker Users** 🐳
- **[Docker Deployment](DOCKER_DEPLOYMENT.md)** - Full Docker guide
- **[Ugreen NAS Setup](UGREEN_NAS_SETUP.md)** - NAS-specific instructions
- **[Update Container](UPDATE_DOCKER_CONTAINER.md)** - How to update

### **Developers** 💻
- **[Development Setup](#development-setup)** - Python environment
- **[API Documentation](#api-documentation)** - Endpoint reference
- **[Contributing Guide](#contributing)** - How to contribute

### **Troubleshooting** 🔧
- **[Common Issues](#common-issues)** - Solutions to frequent problems
- **[Debug Guide](#debugging)** - Debug tools and logs

---

## 🎯 Quick Start

### What is this?
A web dashboard and automation toolkit for managing Aruba Central networks.

### What do I need?
- ✅ Docker (recommended) or Python 3.9+
- ✅ Aruba Central API credentials ([Get them here](#getting-credentials))
- ✅ 10 minutes of your time

### Installation (3 Methods)

#### Method 1: One-Line Install (Easiest!) ⭐

For Ugreen NAS or any Linux server:

```bash
curl -L https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/main/download-to-nas.sh | bash
```

Then:
1. Start: `docker-compose up -d`
2. Access: `http://your-server-ip:1344`
3. **Use Setup Wizard** in web interface to configure credentials

#### Method 2: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal

# Start with Docker (no manual config needed!)
docker-compose up -d

# Access dashboard and use Setup Wizard
# Open: http://localhost:1344
```

The Setup Wizard will guide you through entering your Aruba Central credentials.

#### Method 3: Python (For Developers)

```bash
# Clone and setup
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run dashboard
cd dashboard/backend
python app.py

# Access: http://localhost:1344
```

Use the Setup Wizard at http://localhost:1344 to configure your credentials.

---

## 🔑 Getting Credentials

You need 3 things from Aruba Central:

1. **Log into Aruba Central** → https://central.arubanetworks.com
2. **Go to:** Account → API Gateway → System Apps & Tokens
3. **Create new token** and copy:
   - Client ID
   - Client Secret
   - Customer ID

Paste these into your `.env` file.

---

## 📚 Documentation Overview

### **Setup Guides** (Start here!)
| Document | When to Use | Time |
|----------|-------------|------|
| [QUICK_START_NO_GIT.md](QUICK_START_NO_GIT.md) | No git on NAS | 5 min |
| [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) | Docker setup | 10 min |
| [UGREEN_NAS_SETUP.md](UGREEN_NAS_SETUP.md) | Ugreen NAS users | 10 min |
| [docs/SETUP_WIZARD_GUIDE.md](docs/SETUP_WIZARD_GUIDE.md) | Web UI setup | 5 min |

### **Configuration**
| Document | Purpose |
|----------|---------|
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Detailed configuration |
| [docs/ENV_VARIABLES.md](docs/ENV_VARIABLES.md) | Environment variables |
| [.env.example](.env.example) | Configuration template |

### **Features & Reference**
| Document | Content |
|----------|---------|
| [FEATURES.md](dashboard/FEATURES.md) | Dashboard features |
| [MONITORING_FEATURES.md](dashboard/MONITORING_FEATURES.md) | Monitoring capabilities |
| [PORTAL_FEATURES_COMPLETE.md](PORTAL_FEATURES_COMPLETE.md) | Complete feature list |

### **Maintenance & Updates**
| Document | Purpose |
|----------|---------|
| [UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md) | Update your container |
| [UPDATING_DOCKER.md](UPDATING_DOCKER.md) | General Docker updates |

### **For Developers**
| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Technical overview |
| [CLAUDE.md](CLAUDE.md) | Development guidelines |
| [ARCHITECTURE.md](dashboard/ARCHITECTURE.md) | System architecture |

### **Quality Assurance**
| Document | Purpose |
|----------|---------|
| [_ARCHIVE/unused/qa_reports/QA_REPORT.md](_ARCHIVE/unused/qa_reports/QA_REPORT.md) | Quality assessment |
| [_ARCHIVE/unused/qa_reports/CUSTOMER_VERIFICATION_REPORT.md](_ARCHIVE/unused/qa_reports/CUSTOMER_VERIFICATION_REPORT.md) | Customer readiness |

---

## 🎬 Video Tutorials

Coming soon! Subscribe to get notified:
- Initial setup walkthrough
- Dashboard tour
- Bulk operations demo
- Troubleshooting common issues

---

## 🛠️ Helper Scripts

All scripts are in the root directory:

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-check.sh` | Validate before deploy | `./deploy-check.sh` |
| `update-portal.sh` | Update to latest | `./update-portal.sh` |
| `force-update.sh` | Force rebuild | `./force-update.sh` |
| `debug-setup.sh` | Debug issues | `./debug-setup.sh` |
| `set-uid-gid.sh` | Fix permissions | `./set-uid-gid.sh` |
| `fix-env-permissions.sh` | Secure .env | `./fix-env-permissions.sh` |

---

## ✅ Verify Installation

After installation, verify everything works:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Access dashboard
# Open browser: http://your-ip:1344

# Test API connection
# Use Setup Wizard in dashboard
```

---

## 🐛 Common Issues

### Container Won't Start

**Check logs:**
```bash
docker-compose logs aruba-central-portal
```

**Fix: Port already in use**
```bash
docker-compose down
docker-compose up -d
```

### "Token refresh failed 400"

This is NORMAL if credentials aren't configured yet.

**Fix:**
1. Access the dashboard: `http://your-ip:1344`
2. Complete the Setup Wizard
3. Credentials are saved automatically - no restart needed!

### Can't Access Dashboard

**Check:**
1. Container running: `docker-compose ps`
2. Port not blocked: `curl http://localhost:1344`
3. Firewall allows port 1344

### "Permission Denied" on NAS

**Fix:**
```bash
./set-uid-gid.sh
```

---

## 🚀 Next Steps

After successful installation:

1. **✅ Access dashboard** at http://your-ip:1344
2. **✅ Complete Setup Wizard** - Enter your Aruba Central API credentials
3. **✅ Verify connection** - Setup Wizard tests credentials automatically
4. **✅ Explore features** - see [FEATURES.md](dashboard/FEATURES.md)
5. **✅ Set up monitoring** - see [MONITORING_FEATURES.md](dashboard/MONITORING_FEATURES.md)

---

## 📖 Development Setup

For developers who want to customize or contribute:

```bash
# Clone and setup
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal

# Backend setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt

# Frontend setup
cd dashboard/frontend
npm install
npm run dev  # Development server

# Run tests
pytest
black .
ruff check .
```

See [CLAUDE.md](CLAUDE.md) for development guidelines.

---

## 🤝 Contributing

We welcome contributions! See:
- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [_ARCHIVE/unused/qa_reports/QA_REPORT.md](_ARCHIVE/unused/qa_reports/QA_REPORT.md) - Quality standards

---

## 📞 Getting Help

### Documentation
1. Check [START_HERE.md](START_HERE.md) (this file)
2. See relevant guide from [Navigation](#-quick-navigation)
3. Run `./debug-setup.sh` for diagnostics

### Community
- GitHub Issues: Report bugs or request features
- Discussions: Ask questions, share ideas

### Support Priority
1. ✅ Documentation (check guides first)
2. ✅ GitHub Issues (bug reports)
3. ✅ Discussions (questions)

---

## 📊 Project Status

| Component | Status | Docs |
|-----------|--------|------|
| Docker Deployment | ✅ Production Ready | [Guide](DOCKER_DEPLOYMENT.md) |
| Web Dashboard | ✅ Production Ready | [Features](dashboard/FEATURES.md) |
| Python Scripts | ✅ Production Ready | [README](README.md) |
| API Coverage | ✅ 40+ Endpoints | [Architecture](dashboard/ARCHITECTURE.md) |
| Documentation | ✅ Comprehensive | [All Docs](#-documentation-overview) |
| Testing | ⚠️ In Progress | [QA Report](_ARCHIVE/unused/qa_reports/QA_REPORT.md) |

**Overall Rating:** ⭐⭐⭐⭐⭐ (95/100) - See [Verification Report](_ARCHIVE/unused/qa_reports/CUSTOMER_VERIFICATION_REPORT.md)

---

## 🎯 Quick Links

- **[🏠 Main README](README.md)** - Technical documentation
- **[🐳 Docker Setup](DOCKER_DEPLOYMENT.md)** - Container deployment
- **[🔧 Configuration](docs/CONFIGURATION.md)** - Advanced config
- **[📊 Features](dashboard/FEATURES.md)** - What it can do
- **[🐛 Troubleshooting](UPDATE_DOCKER_CONTAINER.md#troubleshooting)** - Fix problems
- **[📝 Change Log](#)** - What's new
- **[📄 License](LICENSE)** - MIT License

---

**Ready to get started? Pick your method above and you'll be up in 5 minutes!** 🚀

**Questions?** Check the relevant guide or run `./debug-setup.sh` for help.
