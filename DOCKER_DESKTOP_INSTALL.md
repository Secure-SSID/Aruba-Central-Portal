# Docker Desktop Installation Guide

Complete guide for installing and running Aruba Central Portal on Docker Desktop (Windows, macOS, Linux).

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install Docker Desktop](#install-docker-desktop)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Options](#advanced-options)

---

## Prerequisites

### System Requirements

**Minimum:**
- 4 GB RAM
- 2 CPU cores
- 10 GB free disk space
- Internet connection

**Recommended:**
- 8 GB RAM or more
- 4 CPU cores or more
- 20 GB free disk space
- SSD storage

### Operating System

- **Windows:** Windows 10/11 64-bit (Pro, Enterprise, or Education)
- **macOS:** macOS 10.15 (Catalina) or newer
- **Linux:** Ubuntu 20.04+, Debian 10+, Fedora 34+

---

## Install Docker Desktop

### Windows

1. **Download Docker Desktop:**
   - Visit https://www.docker.com/products/docker-desktop
   - Click "Download for Windows"

2. **Install Docker Desktop:**
   ```powershell
   # Run the installer (Docker Desktop Installer.exe)
   # Enable WSL 2 when prompted (recommended)
   ```

3. **Enable WSL 2 (Windows Subsystem for Linux):**
   ```powershell
   # Open PowerShell as Administrator
   wsl --install
   wsl --set-default-version 2
   ```

4. **Restart your computer**

5. **Verify Installation:**
   ```powershell
   docker --version
   docker-compose --version
   ```

### macOS

1. **Download Docker Desktop:**
   - Visit https://www.docker.com/products/docker-desktop
   - Choose your chip:
     - **Intel Chip:** Download for Mac with Intel chip
     - **Apple Silicon (M1/M2/M3):** Download for Mac with Apple chip

2. **Install Docker Desktop:**
   ```bash
   # Drag Docker.app to Applications folder
   # Open Docker from Applications
   # Grant necessary permissions
   ```

3. **Verify Installation:**
   ```bash
   docker --version
   docker-compose --version
   ```

### Linux

1. **Install Docker Engine:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y ca-certificates curl gnupg lsb-release

   # Add Docker's official GPG key
   sudo mkdir -p /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

   # Set up repository
   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
     $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   # Install Docker Engine
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   ```

2. **Add your user to docker group:**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **Verify Installation:**
   ```bash
   docker --version
   docker compose version
   ```

---

## Quick Start

### Method 1: Building from Source

```bash
# 1. Clone the repository
git clone https://github.com/secure-ssid/aruba-central-portal.git
cd Aruba-Central-Portal

# 2. Copy environment file
cp .env.example .env

# 3. Build and start
docker compose up -d --build

# 4. Access the Setup Wizard
# Open browser to: http://localhost:1344
```

---

## Configuration

### Using the Setup Wizard (Recommended)

1. **Access the Setup Wizard:**
   ```
   http://localhost:1344
   ```

2. **Configure API Credentials:**
   - The wizard will guide you through:
     - Selecting your Aruba Central region
     - Entering API credentials (Client ID, Secret, Customer ID)
     - Testing the connection
     - Saving configuration

3. **The wizard automatically updates your `.env` file**

### Manual Configuration

Edit `.env` file:

```bash
# Open .env in your favorite editor
notepad .env       # Windows
open -e .env       # macOS
nano .env          # Linux
```

Required values:
```env
ARUBA_BASE_URL=https://internal.api.central.arubanetworks.com
ARUBA_CLIENT_ID=your_client_id_here
ARUBA_CLIENT_SECRET=your_client_secret_here
ARUBA_CUSTOMER_ID=your_customer_id_here
```

Restart the container:
```bash
docker compose restart
```

### Getting API Credentials

1. **Log in to Aruba Central:**
   - https://central.arubanetworks.com

2. **Navigate to API Gateway:**
   - Account Home → API Gateway → System Apps & Tokens

3. **Create New App:**
   - Click "Add Apps & Tokens"
   - Choose "Add System App"
   - Name: `Aruba Central Portal`
   - Select required permissions:
     - Monitoring (Read)
     - Configuration (Read/Write)
     - Network Operations (Read/Write)
   - Click "Create"

4. **Copy Credentials:**
   - Client ID
   - Client Secret
   - Customer ID (from Account Home)

---

## Troubleshooting

### Port Already in Use

**Error:** `Bind for 0.0.0.0:1344 failed: port is already allocated`

**Solution:**
```bash
# Option 1: Change port in docker-compose.yml
ports:
  - "5002:1344"  # Use port 5002 instead

# Option 2: Stop conflicting service
# Windows
netstat -ano | findstr :1344
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:1344 | xargs kill -9
```

### Container Won't Start

**Check logs:**
```bash
docker compose logs -f aruba-central-portal
```

**Common fixes:**
```bash
# Rebuild the image
docker compose down
docker compose up -d --build --force-recreate

# Clean Docker cache
docker system prune -a
```

### API Connection Failed

1. **Verify credentials in `.env`**
2. **Check network connectivity:**
   ```bash
   docker compose exec aruba-central-portal ping central.arubanetworks.com
   ```
3. **Check API endpoint region matches your Aruba Central instance**

### Permission Issues (Linux)

**Error:** `Permission denied` when accessing files

**Solution:**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Or run with proper PUID/PGID in .env
PUID=1000
PGID=1000
```

### Memory Issues

**Increase Docker Desktop resources:**

**Windows/macOS:**
1. Docker Desktop → Settings → Resources
2. Increase Memory to 4GB+
3. Increase CPUs to 2+
4. Click "Apply & Restart"

**Linux:**
```bash
# Check available memory
docker stats

# If needed, increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Advanced Options

### Running in Development Mode

```bash
# Start with live code reloading
docker compose up -d --profile dev

# Access dev container
docker compose exec aruba-dev /bin/bash

# Run scripts inside container
python scripts/test_api.py
```

### Custom Network Configuration

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  aruba-central-portal:
    networks:
      - my-custom-network

networks:
  my-custom-network:
    external: true
```

### Persistent Data Volumes

Data is automatically persisted in Docker volumes:

```bash
# List volumes
docker volume ls

# Backup token cache
docker run --rm -v Aruba-Central-Portal_token-cache:/data -v $(pwd):/backup alpine tar czf /backup/token-cache-backup.tar.gz -C /data .

# Restore token cache
docker run --rm -v Aruba-Central-Portal_token-cache:/data -v $(pwd):/backup alpine tar xzf /backup/token-cache-backup.tar.gz -C /data
```

### Health Checks

```bash
# Check container health
docker compose ps

# Manual health check
curl http://localhost:1344/api/health
```

### Viewing Logs

```bash
# Follow all logs
docker compose logs -f

# Follow specific service
docker compose logs -f aruba-central-portal

# View last 100 lines
docker compose logs --tail=100

# Export logs to file
docker compose logs > logs.txt
```

### Updating the Application

```bash
# Pull latest changes and rebuild
git pull
docker compose up -d --build
```

### Stopping and Removing

```bash
# Stop containers (keeps data)
docker compose stop

# Stop and remove containers (keeps data)
docker compose down

# Remove everything including volumes (DESTRUCTIVE)
docker compose down -v
```

---

## Next Steps

- ✅ Application is running at http://localhost:1344
- 📖 Read the [Configuration Guide](dashboard/CONFIGURATION_GUIDE.md)
- 🔧 Explore the [API Explorer](http://localhost:1344/api-explorer)
- 📊 View the [Dashboard](http://localhost:1344/dashboard)

---

## Support

- 📚 Documentation: [README.md](README.md)
- 🐛 Issues: [GitHub Issues](https://github.com/secure-ssid/aruba-central-portal/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/secure-ssid/aruba-central-portal/discussions)

---

## Docker Desktop Tips

### Enable Kubernetes (Optional)

Docker Desktop → Settings → Kubernetes → Enable Kubernetes

### Resource Monitoring

```bash
# Real-time resource usage
docker stats

# Disk usage
docker system df
```

### Clean Up Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```
