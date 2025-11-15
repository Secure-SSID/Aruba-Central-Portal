# How to Update Your Docker Container

## Quick Update (Recommended)

SSH into your Ugreen NAS and run these commands:

```bash
# Navigate to your project directory
cd /volume1/docker/central-portal

# Stop the container
docker-compose down

# Pull the latest code with the fix
git pull origin main

# Rebuild the container with the new code
docker-compose build --no-cache

# Start the container
docker-compose up -d

# Watch the logs to verify it starts correctly
docker-compose logs -f aruba-central-portal
```

Press `Ctrl+C` to exit the logs when you see the server running successfully.

---

## Alternative Methods

### Method 1: Use the Update Script (Automated)

```bash
cd /volume1/docker/central-portal
./update-portal.sh
```

This script automatically:
- Backs up your configuration
- Pulls latest code
- Rebuilds container
- Restarts services

### Method 2: Force Update (If Git Issues)

```bash
cd /volume1/docker/central-portal
./force-update.sh
```

Use this if you have git conflicts or local changes.

### Method 3: Manual Step-by-Step

```bash
# 1. Navigate to directory
cd /volume1/docker/central-portal

# 2. Stop running container
docker-compose down

# 3. Pull latest changes
git fetch origin
git pull origin main

# 4. Remove old image (optional but recommended)
docker-compose rm -f aruba-central-portal

# 5. Rebuild from scratch
docker-compose build --no-cache --pull

# 6. Start container
docker-compose up -d

# 7. Check logs
docker-compose logs -f
```

---

## Verify the Fix Worked

After updating, check the logs:

```bash
docker-compose logs aruba-central-portal | tail -30
```

**✅ SUCCESS - You should see:**
```
[INFO] Starting gunicorn
[INFO] Listening at: http://0.0.0.0:1344
[INFO] Booting worker
```

**❌ OLD ERROR (should be GONE):**
```
AssertionError: View function mapping is overwriting an existing endpoint function: get_applications
```

---

## Check Container Status

```bash
# See if container is running
docker-compose ps

# You should see:
# aruba-central-portal   Up   0.0.0.0:1344->1344/tcp
```

---

## Access the Web Interface

After successful update:
1. Open browser
2. Go to: `http://YOUR_NAS_IP:1344`
3. You should see the login page

---

## Troubleshooting

### If Container Won't Start

**Check what's wrong:**
```bash
docker-compose logs aruba-central-portal
```

**Common issues:**

1. **"bind: address already in use"**
   ```bash
   # Port 1344 is in use, stop existing container
   docker-compose down
   docker-compose up -d
   ```

2. **"Token refresh failed 400"**
   - This is NORMAL if you haven't configured credentials yet
   - Edit `.env` file with real Aruba Central credentials
   ```bash
   nano .env
   # Add real credentials, then:
   docker-compose restart
   ```

3. **"No such file or directory"**
   ```bash
   # You're in the wrong directory
   cd /volume1/docker/central-portal
   ```

### If Git Pull Fails

**Error: "Your local changes would be overwritten"**
```bash
# Stash your changes
git stash
git pull origin main
git stash pop
```

**OR reset to latest:**
```bash
git fetch origin
git reset --hard origin/main
```

### If Build Fails

**Clear everything and start fresh:**
```bash
docker-compose down -v
docker system prune -a
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

---

## Quick Command Reference

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

Once the container is running successfully:

1. **Access the dashboard:** http://YOUR_NAS_IP:1344
2. **Configure credentials** (if not done already):
   ```bash
   nano /volume1/docker/central-portal/.env
   ```
   Add your Aruba Central API credentials

3. **Restart to apply credentials:**
   ```bash
   docker-compose restart
   ```

4. **Test the connection** using the Setup Wizard in the web interface

---

## Need Help?

**See logs:**
```bash
docker-compose logs -f aruba-central-portal
```

**Check debug info:**
```bash
./debug-setup.sh
```

**Validate deployment:**
```bash
./deploy-check.sh
```
