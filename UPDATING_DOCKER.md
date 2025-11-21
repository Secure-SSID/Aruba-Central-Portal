# How to Update Docker with New Features

This guide explains how to ensure new features are included in your Docker container.

## Quick Update (After Code Changes)

If you've added new features to the code, run this on your NAS:

```bash
cd /volume1/docker/central-portal

# Download the update script
sudo curl -L -o force-update.sh https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/force-update.sh

# Make it executable
sudo chmod +x force-update.sh

# Run it
sudo ./force-update.sh
```

This will:
1. ✓ Stop the current container
2. ✓ Remove old Docker images
3. ✓ Rebuild from scratch with `--no-cache`
4. ✓ Start the updated container

---

## Manual Update Process

### Step 1: Get Latest Code

**Option A: Re-download Everything**
```bash
cd /volume1/docker/
sudo rm -rf central-portal
curl -L https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/download-to-nas.sh | sudo bash
cd central-portal
```

**Option B: Download Specific Files** (if you know what changed)
```bash
cd /volume1/docker/central-portal

# Example: Update backend app.py
sudo curl -L -o dashboard/backend/app.py \
  https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/dashboard/backend/app.py

# Example: Update frontend
sudo curl -L -o dashboard/frontend/src/App.js \
  https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/dashboard/frontend/src/App.js
```

### Step 2: Backup Your Config

```bash
cd /volume1/docker/central-portal
sudo cp .env .env.backup
```

### Step 3: Force Rebuild

```bash
# Stop and remove everything
sudo docker compose down --rmi local

# Rebuild with no cache (important!)
sudo docker compose build --no-cache

# Start the updated container
sudo docker compose up -d
```

### Step 4: Verify Update

```bash
# Check container is running
sudo docker compose ps

# View logs for any errors
sudo docker compose logs -f

# Test the health endpoint
curl http://localhost:1344/api/health
```

---

## Understanding Docker Build Process

### What Gets Included in Docker Build

The Dockerfile copies these directories into the container:

```dockerfile
COPY . /app/                          # Everything in project root
COPY dashboard/backend/ /app/dashboard/backend/
COPY dashboard/frontend/ /app/dashboard/frontend/
```

So any files in `/volume1/docker/central-portal/` will be copied into the Docker image during build.

### When to Use `--no-cache`

Use `--no-cache` when:
- ✓ You've added new Python dependencies
- ✓ You've added new npm packages
- ✓ You want to ensure 100% fresh build
- ✓ You're troubleshooting build issues

Use regular build (faster) when:
- ✓ Only code changed (no dependencies)
- ✓ Quick iteration during development

---

## Verifying Your New Features

### 1. Check File Timestamps

```bash
# See when files were last modified
ls -lah /volume1/docker/central-portal/dashboard/backend/app.py
```

### 2. Check Inside Running Container

```bash
# Access the running container
sudo docker compose exec aruba-central-portal bash

# Check file inside container
cat /app/dashboard/backend/app.py | head -20

# Exit container
exit
```

### 3. Check Logs for New Features

```bash
# Look for initialization messages
sudo docker compose logs | grep -i "feature"
sudo docker compose logs | grep -i "endpoint"
```

---

## Common Issues

### "Changes Not Appearing"

**Problem**: You updated code but don't see changes in the app.

**Solution**:
```bash
# Use --no-cache to force fresh build
sudo docker compose build --no-cache
sudo docker compose up -d
```

### "Old Version Still Running"

**Problem**: Container shows old version after rebuild.

**Solution**:
```bash
# Remove all containers and images
sudo docker compose down --rmi all --volumes

# Fresh build
sudo docker compose up -d --build
```

### "Build Uses Cached Layers"

**Problem**: Docker says "CACHED" for steps that should rebuild.

**Solution**:
```bash
# This forces every step to run fresh
sudo docker compose build --no-cache --pull
```

---

## Development Workflow

If you're actively developing new features:

### 1. Make Changes Locally
```bash
cd /volume1/docker/central-portal
sudo nano dashboard/backend/app.py  # or whatever file
```

### 2. Quick Test (Fast Build)
```bash
sudo docker compose build
sudo docker compose up -d
sudo docker compose logs -f
```

### 3. Production Update (Full Rebuild)
```bash
sudo docker compose build --no-cache
sudo docker compose up -d
```

---

## Update Checklist

Before updating:
- [ ] Backup `.env` file
- [ ] Note current working features
- [ ] Document what's changing

During update:
- [ ] Stop container: `docker compose down`
- [ ] Get latest code
- [ ] Rebuild: `docker compose build --no-cache`
- [ ] Start: `docker compose up -d`

After update:
- [ ] Check logs: `docker compose logs -f`
- [ ] Test health: `curl http://localhost:1344/api/health`
- [ ] Test new features in browser
- [ ] Verify existing features still work

---

## Quick Commands Reference

```bash
# Full rebuild (ensures all changes included)
cd /volume1/docker/central-portal
sudo docker compose down
sudo docker compose build --no-cache
sudo docker compose up -d

# Quick rebuild (faster, uses cache)
sudo docker compose up -d --build

# Force complete refresh
sudo docker compose down --rmi all
sudo docker compose up -d --build

# View what's running
sudo docker compose ps
sudo docker compose logs -f

# Check specific file in container
sudo docker compose exec aruba-central-portal cat /app/dashboard/backend/app.py
```

---

## Need Help?

If your new features aren't showing up after following these steps:

1. Check the logs:
   ```bash
   sudo docker compose logs -f
   ```

2. Verify files on disk:
   ```bash
   ls -lah /volume1/docker/central-portal/
   ```

3. Check inside container:
   ```bash
   sudo docker compose exec aruba-central-portal ls -la /app/
   ```

4. Try complete rebuild:
   ```bash
   sudo docker compose down --rmi all --volumes
   sudo docker compose up -d --build
   ```
