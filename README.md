# Aruba Central Portal

> **Web dashboard and automation toolkit for Aruba Central network management**

[![Production Ready](https://img.shields.io/badge/status-production%20ready-brightgreen)](_ARCHIVE/unused/qa_reports/CUSTOMER_VERIFICATION_REPORT.md)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](DOCKER_DESKTOP_INSTALL.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 👋 New Here? **[→ Start Here](START_HERE.md)** ⭐

**5-minute setup** | **40+ API endpoints** | **Full-featured dashboard** | **Docker ready**

> **⚠️ Important:** Configure credentials through the Setup Wizard web interface at `http://your-ip:1344`
> **Do NOT manually edit `.env` files** - the wizard handles everything automatically!

---

## 🚀 Quick Start

Choose your installation method:

### 1️⃣ Docker Desktop (Recommended)
```bash
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal

# Run setup script to create .env file
./setup.sh

# Start the containers
docker compose up -d --build

# Access http://localhost:1344 and use Setup Wizard to configure
```

### 2️⃣ Python/Development
```bash
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

**📖 Installation Guides:**
- **[Docker Desktop Install Guide](DOCKER_DESKTOP_INSTALL.md)** - Complete Docker Desktop setup (Windows/macOS/Linux)
- **[START_HERE.md](START_HERE.md)** - General setup guide

---

## 📚 Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| **[START_HERE.md](START_HERE.md)** | Complete getting started guide | Everyone ⭐ |
| **[DOCKER_DESKTOP_INSTALL.md](DOCKER_DESKTOP_INSTALL.md)** | Docker Desktop setup guide | Docker users ⭐ |
| **[QUICK_START_NO_GIT.md](QUICK_START_NO_GIT.md)** | Setup without Git | NAS users |
| **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** | Production Docker guide | DevOps |
| **[UGREEN_NAS_SETUP.md](UGREEN_NAS_SETUP.md)** | Ugreen NAS guide | NAS users |
| **[UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)** | Update guide | Operations |
| **[CONFIGURATION.md](docs/CONFIGURATION.md)** | Configuration reference | Advanced users |
| **[FEATURES.md](dashboard/FEATURES.md)** | Feature list | Everyone |

---

## ✨ What's Included

### 🖥️ Web Dashboard
- **Real-time monitoring** - Network health, device status, client tracking
- **Device management** - Inventory, configuration, firmware updates
- **Analytics** - Bandwidth, usage, performance metrics
- **Troubleshooting** - Ping, logs, diagnostics
- **Bulk operations** - Configure multiple devices at once

### 🤖 Python Automation
- **User management** - Automated user/role operations
- **MSP operations** - Multi-tenant management
- **Reporting** - Export data to CSV/JSON
- **Custom scripts** - Extend with your own automation

### 🐳 Production Ready
- **Docker deployment** - One-command deployment
- **Auto-updates** - Built-in update scripts
- **Monitoring** - Health checks and logging
- **Security** - Token caching, rate limiting

---

## 📊 Features at a Glance

| Feature | Status | Documentation |
|---------|--------|---------------|
| Web Dashboard | ✅ 18 pages | [FEATURES.md](dashboard/FEATURES.md) |
| API Coverage | ✅ 40+ endpoints | [ARCHITECTURE.md](dashboard/ARCHITECTURE.md) |
| Docker | ✅ Production ready | [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) |
| Monitoring | ✅ Real-time | [MONITORING_FEATURES.md](dashboard/MONITORING_FEATURES.md) |
| Scripts | ✅ 15+ scripts | [README.md](README.md) |
| Documentation | ✅ 20+ guides | [START_HERE.md](START_HERE.md) |

**Quality Rating:** ⭐⭐⭐⭐⭐ (95/100) - [Verification Report](CUSTOMER_VERIFICATION_REPORT.md)

---

## 🎯 Common Tasks

### Update Your Container
```bash
cd /volume1/docker/central-portal
docker-compose down && git pull && docker-compose up -d --build
```
**Detailed guide:** [UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)

### View Logs
```bash
docker-compose logs -f aruba-central-portal
```

### Configure Credentials
Access the Setup Wizard at `http://your-ip:1344` and enter your Aruba Central API credentials.
The wizard saves them automatically - no manual editing or restart needed!

### Check Status
```bash
docker-compose ps
./debug-setup.sh
```

---

## 🛠️ Project Structure

```
Aruba-Central-Portal/
├── START_HERE.md           ⭐ Start here!
├── dashboard/              🖥️ Web application
│   ├── backend/           Python Flask API
│   └── frontend/          React dashboard
├── scripts/               🤖 Automation scripts
│   ├── monitoring/        Health checks, audits
│   ├── network/           VLAN, WLAN management
│   └── devices/           Device operations
├── utils/                 🔧 Shared utilities
├── docs/                  📚 Additional documentation
└── *.sh                   🚀 Helper scripts
```

---

## 🔧 Troubleshooting

### Container Won't Start
```bash
docker-compose logs aruba-central-portal  # Check logs
docker-compose down && docker-compose up -d --build  # Rebuild
```

### "Token Error 400"
This is normal if credentials aren't configured. Use the Setup Wizard at `http://your-ip:1344` to configure your Aruba Central credentials.

### Port Already in Use
```bash
docker-compose down
lsof -i :1344  # See what's using port 1344
```

### More Help
- Run: `./debug-setup.sh`
- See: [UPDATE_DOCKER_CONTAINER.md#troubleshooting](UPDATE_DOCKER_CONTAINER.md#troubleshooting)
- Check: [GitHub Issues](https://github.com/secure-ssid/aruba-central-portal/issues)

---

## 💻 For Developers

### Setup Development Environment
```bash
# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt

# Frontend
cd dashboard/frontend
npm install
npm run dev
```

### Run Tests
```bash
pytest
black .
ruff check .
```

### Guidelines
- See [CLAUDE.md](CLAUDE.md) for development guidelines
- See [QA_REPORT.md](QA_REPORT.md) for quality standards
- Follow [ARCHITECTURE.md](dashboard/ARCHITECTURE.md) for structure

---

## 📞 Support & Contributing

### Getting Help
1. **Check documentation** - [START_HERE.md](START_HERE.md)
2. **Run diagnostics** - `./debug-setup.sh`
3. **Search issues** - [GitHub Issues](https://github.com/secure-ssid/aruba-central-portal/issues)
4. **Create issue** - Use issue templates

### Contributing
We welcome contributions! Please:
1. Read [CLAUDE.md](CLAUDE.md)
2. Follow code standards
3. Add tests
4. Update documentation

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

---

## 🌟 Quick Links

- **[🏠 START_HERE.md](START_HERE.md)** - Complete getting started guide
- **[🐳 DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Docker setup
- **[🔄 UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)** - How to update
- **[📊 FEATURES.md](dashboard/FEATURES.md)** - Feature overview
- **[🔧 CONFIGURATION.md](CONFIGURATION.md)** - Configuration guide
- **[🐛 Debug Guide](UPDATE_DOCKER_CONTAINER.md#troubleshooting)** - Fix issues
- **[✅ QA Report](QA_REPORT.md)** - Quality assessment

---

**Ready to start?** → [START_HERE.md](START_HERE.md) ⭐
