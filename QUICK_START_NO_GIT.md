# Quick Start for Ugreen NAS (Without Git)

Since your NAS doesn't have git installed, here are the easiest ways to get started.

## Method 1: One-Line Installer (Easiest!)

SSH into your Ugreen NAS and run this single command:

```bash
curl -L https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/download-to-nas.sh | bash
```

This will:
- ✓ Download all files
- ✓ Extract them to `/volume1/docker/central-portal/`
- ✓ Create the `.env` file for you
- ✓ Set up everything automatically

Then just:
1. Edit your credentials: `nano /volume1/docker/central-portal/.env`
2. Deploy: `cd /volume1/docker/central-portal && docker-compose up -d`
3. Access: `http://your-nas-ip:1344`

---

## Method 2: Manual Download (Most Reliable)

### On Your Computer:

1. **Download the project**:
   - Go to https://github.com/secure-ssid/aruba-central-portal
   - Click the green "Code" button
   - Select "Download ZIP"
   - Save and extract the ZIP file

### On Your Ugreen NAS:

2. **Upload via File Manager**:
   - Open Ugreen NAS web interface
   - Go to File Manager
   - Navigate to `/volume1/docker/`
   - Create a new folder called `central-portal`
   - Upload ALL extracted files into this folder

3. **Via SFTP (Alternative)**:
   - Use WinSCP (Windows), Cyberduck (Mac), or FileZilla (Any OS)
   - Connect to your NAS:
     - Host: `your-nas-ip`
     - Port: `22`
     - Protocol: `SFTP`
     - Username: `your-admin-username`
     - Password: `your-admin-password`
   - Navigate to `/volume1/docker/`
   - Upload the entire project folder and rename it to `central-portal`

---

## Method 3: Using wget

If your NAS has `wget` (most do), SSH in and run:

```bash
# Navigate to docker directory
cd /volume1/docker/

# Download the repository
wget https://github.com/secure-ssid/aruba-central-portal/archive/refs/heads/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc.zip -O repo.zip

# Extract
unzip repo.zip

# Rename the folder (the name will be long)
mv Aruba-Central-Portal-claude-docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc central-portal

# Clean up
rm repo.zip
```

---

## After Getting the Files

Regardless of which method you used, follow these steps:

### 1. Create Your Configuration

```bash
cd /volume1/docker/central-portal
cp .env.example .env
nano .env
```

### 2. Add Your Credentials

Edit the `.env` file and add your Aruba Central credentials:

```env
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_actual_client_id
ARUBA_CLIENT_SECRET=your_actual_client_secret
ARUBA_CUSTOMER_ID=your_actual_customer_id
```

**To get these credentials:**
1. Log in to https://central.arubanetworks.com
2. Go to Account Home → System Apps & Tokens
3. Click "Generate App Credentials"
4. Copy the Client ID, Client Secret, and Customer ID

**Choose the correct Base URL for your region:**
- US East: `https://apigw-prod2.central.arubanetworks.com`
- US West: `https://apigw-uswest4.central.arubanetworks.com`
- EU: `https://apigw-eucentral3.central.arubanetworks.com`
- APAC: `https://apigw-apeast1.central.arubanetworks.com`

### 3. Verify Everything is Ready

```bash
bash deploy-check.sh
```

This will check that all files are present and your credentials are set.

### 4. Deploy the Container

```bash
docker-compose up -d
```

### 5. Check the Logs

```bash
docker-compose logs -f
```

Press `Ctrl+C` to exit logs.

### 6. Access the Dashboard

Open your web browser and go to:
```
http://your-nas-ip:1344
```

Click "Connect to Aruba Central" to log in.

---

## Troubleshooting

### "curl: command not found"

Try using `wget` instead:

```bash
wget https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/download-to-nas.sh
bash download-to-nas.sh
```

### "wget: command not found"

Use **Method 2** (Manual Download) above.

### "unzip: command not found"

Install unzip:
```bash
opkg update
opkg install unzip
```

Or use **Method 2** (Manual Download) and extract the ZIP on your computer.

### "docker-compose: command not found"

Try using `docker compose` (without the dash):
```bash
docker compose up -d
```

### Files uploaded but still getting "Dockerfile not found"

Make sure you're in the correct directory:
```bash
cd /volume1/docker/central-portal
pwd    # Should show /volume1/docker/central-portal
ls -la # Should show Dockerfile, docker-compose.yml, etc.
```

### Permission denied

Make sure you have write access:
```bash
sudo chown -R $(whoami):$(whoami) /volume1/docker/central-portal
chmod +x deploy-check.sh
```

---

## What You Should See

After successful deployment:

```bash
$ docker-compose ps
NAME                      STATUS
aruba-central-portal      Up (healthy)
```

And you can access the dashboard at `http://your-nas-ip:1344`

---

## Quick Command Reference

```bash
# View logs
docker-compose logs -f

# Stop container
docker-compose down

# Restart container
docker-compose restart

# Rebuild and restart
docker-compose up -d --build

# Check status
docker-compose ps

# Check health
curl http://localhost:1344/api/health
```

---

## Need More Help?

- Full documentation: `DOCKER_DEPLOYMENT.md`
- Environment variables: `ENV_VARIABLES.md`
- Troubleshooting: `UGREEN_NAS_SETUP.md`
