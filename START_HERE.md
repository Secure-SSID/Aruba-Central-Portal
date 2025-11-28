# Start Here - Aruba Central Portal

**Welcome!** This guide will get you up and running in 5 minutes.

---

## Quick Navigation

### New Users
- **[Quick Start Guide](#quick-start)** - Start here
- **[Getting Credentials](#getting-credentials)** - Get your API keys

### Docker Users
- **[Docker Deployment](DOCKER_DEPLOYMENT.md)** - Full Docker guide
- **[Update Container](UPDATE_DOCKER_CONTAINER.md)** - How to update

### Developers
- **[Development Setup](#development-setup)** - Python/Node environment
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines

### Troubleshooting
- **[Common Issues](#common-issues)** - Solutions to frequent problems

---

## Quick Start

### What is this?
A web dashboard and automation toolkit for managing Aruba Central networks.

### What do I need?
- Docker (recommended) or Python 3.10+
- Aruba Central API credentials ([Get them here](#getting-credentials))
- 10 minutes of your time

### Installation

#### Method 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd aruba-central-portal

# Start with Docker
docker-compose up -d

# Access dashboard
# Open: http://localhost:1344
```

The Setup Wizard will guide you through entering your Aruba Central credentials.

#### Method 2: Python Development

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

---

## Getting Credentials

You need 3 things from Aruba Central:

1. **Log into Aruba Central** at https://central.arubanetworks.com
2. **Go to:** Account Home → API Gateway → System Apps & Tokens
3. **Create new token** and copy:
   - Client ID
   - Client Secret
   - Customer ID

Use the Setup Wizard at http://localhost:1344 to enter these credentials.

**Regional Base URLs:**
- US East: `https://apigw-prod2.central.arubanetworks.com`
- US West: `https://apigw-uswest4.central.arubanetworks.com`
- EU: `https://apigw-eucentral3.central.arubanetworks.com`
- APAC: `https://apigw-apeast1.central.arubanetworks.com`

---

## Documentation Overview

### Setup Guides
| Document | When to Use |
|----------|-------------|
| [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) | Docker production setup |
| [DOCKER_DESKTOP_INSTALL.md](DOCKER_DESKTOP_INSTALL.md) | Docker Desktop (Windows/Mac) |
| [DEV_SETUP.md](DEV_SETUP.md) | Development environment |

### Configuration
| Document | Purpose |
|----------|---------|
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Detailed configuration |
| [docs/ENV_VARIABLES.md](docs/ENV_VARIABLES.md) | Environment variables |

### Features & Reference
| Document | Content |
|----------|---------|
| [dashboard/FEATURES.md](dashboard/FEATURES.md) | Dashboard features |
| [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | System architecture |

### Maintenance
| Document | Purpose |
|----------|---------|
| [UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md) | Update your container |

---

## Verify Installation

After installation, verify everything works:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Access dashboard
# Open browser: http://your-ip:1344
```

---

## Common Issues

### Container Won't Start

**Check logs:**
```bash
docker-compose logs aruba-central-portal
```

**Port already in use:**
```bash
docker-compose down
docker-compose up -d
```

### "Token refresh failed 400"

This is NORMAL if credentials aren't configured yet.

**Fix:**
1. Access the dashboard: `http://your-ip:1344`
2. Complete the Setup Wizard
3. Credentials are saved automatically

### Can't Access Dashboard

**Check:**
1. Container running: `docker-compose ps`
2. Port not blocked: `curl http://localhost:1344`
3. Firewall allows port 1344

---

## Development Setup

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
```

See [CLAUDE.md](CLAUDE.md) for development guidelines.

---

## Project Structure

```
aruba-central-portal/
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

## Next Steps

After successful installation:

1. **Access dashboard** at http://your-ip:1344
2. **Complete Setup Wizard** - Enter your Aruba Central API credentials
3. **Explore features** - see [dashboard/FEATURES.md](dashboard/FEATURES.md)

---

## Getting Help

**Documentation:**
1. Check this file (START_HERE.md)
2. See relevant guide from [Documentation Overview](#documentation-overview)
3. Run `./debug-setup.sh` for diagnostics

**Support:**
- GitHub Issues: Report bugs or request features

---

## Quick Links

- **[README.md](README.md)** - Technical documentation
- **[Docker Setup](DOCKER_DEPLOYMENT.md)** - Container deployment
- **[Configuration](docs/CONFIGURATION.md)** - Advanced config
- **[Features](dashboard/FEATURES.md)** - What it can do

---

**Ready to get started? Pick your installation method above!**
