# How to Update Your Docker Container

## Quick Update (Recommended)

```bash
cd /volume1/docker/central-portal

# Stop, pull, rebuild, start
docker-compose down
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose logs -f
```

Press `Ctrl+C` to exit logs when you see the server running.

---

## Update Methods

### Method 1: Update Script (Automated)

```bash
cd /volume1/docker/central-portal
./update-portal.sh
```

This script automatically backs up config, pulls code, rebuilds, and restarts.

### Method 2: Force Update (If Git Issues)

```bash
cd /volume1/docker/central-portal
./force-update.sh
```

Use this if you have git conflicts or local changes.

### Method 3: Complete Refresh

```bash
cd /volume1/docker/central-portal

# Backup config
cp .env .env.backup

# Remove everything and rebuild
docker-compose down --rmi local
docker-compose build --no-cache
docker-compose up -d
```

---

## Verify Update Worked

```bash
# Check container is running
docker-compose ps

# You should see:
# aruba-central-portal   Up   0.0.0.0:1344->1344/tcp

# Check logs
docker-compose logs aruba-central-portal | tail -30
```

**Success:** You should see Flask/gunicorn startup messages.

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker-compose logs aruba-central-portal
```

### "bind: address already in use"

```bash
docker-compose down
docker-compose up -d
```

### "Token refresh failed 400"

This is NORMAL if credentials aren't configured.

**Fix:**
1. Access dashboard: `http://your-ip:1344`
2. Complete the Setup Wizard
3. Or edit `.env` directly:
   ```bash
   nano .env
   docker-compose restart
   ```

### Git Pull Fails

**"Your local changes would be overwritten":**
```bash
git stash
git pull origin main
git stash pop
```

**Or reset to latest:**
```bash
git fetch origin
git reset --hard origin/main
```

### Build Uses Cached Layers

Force fresh build:
```bash
docker-compose build --no-cache --pull
```

---

## Command Reference

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start container in background |
| `docker-compose down` | Stop container |
| `docker-compose logs -f` | Watch live logs |
| `docker-compose restart` | Restart container |
| `docker-compose ps` | Check container status |
| `docker-compose build --no-cache` | Rebuild from scratch |
| `docker system prune -a` | Clean up unused Docker data |

---

## After Update

1. **Access the dashboard:** http://YOUR_NAS_IP:1344
2. **Verify connection:** Test in the web interface
3. **Check new features:** See release notes

---

## Need Help?

```bash
# View logs
docker-compose logs -f aruba-central-portal

# Check debug info
./debug-setup.sh

# Validate deployment
./deploy-check.sh
```
