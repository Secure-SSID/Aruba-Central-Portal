# Aruba Central Portal

> **Web dashboard and automation toolkit for Aruba Central network management**

[![Production Ready](https://img.shields.io/badge/status-production%20ready-brightgreen)](docs/project/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](DOCKER_DEPLOYMENT.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## New Here? **[Start Here](START_HERE.md)**

**5-minute setup** | **40+ API endpoints** | **Full-featured dashboard** | **Docker ready**

---

## Quick Start

### Docker (Recommended)

```bash
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal
docker-compose up -d

# Access http://localhost:1344 and use Setup Wizard to configure
```

### Python Development

```bash
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

**Installation Guides:**
- **[START_HERE.md](START_HERE.md)** - General setup guide
- **[DOCKER_DESKTOP_INSTALL.md](DOCKER_DESKTOP_INSTALL.md)** - Docker Desktop setup

---

## Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| **[START_HERE.md](START_HERE.md)** | Complete getting started guide | Everyone |
| **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** | Production Docker guide | DevOps |
| **[QUICK_START_DEV.md](QUICK_START_DEV.md)** | Development environment | Developers |
| **[UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)** | Update guide | Operations |
| **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** | Configuration reference | Advanced users |
| **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)** | System architecture | Developers |
| **[dashboard/FEATURES.md](dashboard/FEATURES.md)** | Feature list | Everyone |
| **[CLAUDE.md](CLAUDE.md)** | Development guidelines | Developers |

---

## What's Included

### Web Dashboard
- **Real-time monitoring** - Network health, device status, client tracking
- **Device management** - Inventory, configuration, firmware updates
- **WLAN Wizard** - Create WLANs with guided workflow
- **Analytics** - Bandwidth, usage, performance metrics
- **Bulk operations** - Configure multiple devices at once

### Python Automation
- **User management** - Automated user/role operations
- **MSP operations** - Multi-tenant management
- **Reporting** - Export data to CSV/JSON
- **Custom scripts** - Extend with your own automation

### Production Ready
- **Docker deployment** - One-command deployment
- **Auto-updates** - Built-in update scripts
- **Monitoring** - Health checks and logging
- **Security** - Token caching, rate limiting

---

## Project Structure

```
aruba-central-portal/
├── START_HERE.md           # Start here!
├── dashboard/              # Web application
│   ├── backend/           # Python Flask API
│   └── frontend/          # React dashboard
├── scripts/               # Automation scripts
│   ├── discovery/         # API exploration
│   ├── network/wlan/      # WLAN management
│   ├── users/             # User management
│   ├── monitoring/        # Health checks
│   ├── tenants/           # MSP operations
│   └── testing/           # Integration tests
├── utils/                 # Shared utilities
├── tests/                 # Unit tests
└── docs/                  # Documentation
```

---

## Common Tasks

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

### Run Tests

```bash
pytest                    # Unit tests
pytest --cov=utils       # With coverage
```

---

## Troubleshooting

### Container Won't Start

```bash
docker-compose logs aruba-central-portal  # Check logs
docker-compose down && docker-compose up -d --build  # Rebuild
```

### "Token Error 400"

This is normal if credentials aren't configured. Use the Setup Wizard at `http://your-ip:1344`.

### More Help

- Run: `./debug-setup.sh`
- See: [UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)
- Check: [GitHub Issues](https://github.com/secure-ssid/aruba-central-portal/issues)

---

## For Developers

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

### Code Quality

```bash
pytest          # Tests
black .         # Format
ruff check .    # Lint
```

### Guidelines

- See [CLAUDE.md](CLAUDE.md) for development guidelines
- See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for architecture

---

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

---

## Quick Links

- **[START_HERE.md](START_HERE.md)** - Getting started guide
- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Docker setup
- **[UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)** - How to update
- **[dashboard/FEATURES.md](dashboard/FEATURES.md)** - Feature overview
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines

---

**Ready to start?** [START_HERE.md](START_HERE.md)
