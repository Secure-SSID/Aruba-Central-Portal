# Quick Start for NAS (Without Git)

If your NAS doesn't have git installed, here are the easiest ways to get started.

## Method 1: Download ZIP (Recommended)

### On Your Computer:

1. **Download the project**:
   - Go to https://github.com/secure-ssid/aruba-central-portal
   - Click the green "Code" button
   - Select "Download ZIP"
   - Extract the ZIP file

### On Your NAS:

2. **Upload via File Manager**:
   - Open NAS web interface
   - Go to File Manager
   - Navigate to `/volume1/docker/`
   - Create a new folder called `central-portal`
   - Upload ALL extracted files into this folder

3. **Via SFTP (Alternative)**:
   - Use WinSCP (Windows), Cyberduck (Mac), or FileZilla
   - Connect to your NAS via SFTP (port 22)
   - Upload the project folder to `/volume1/docker/central-portal`

---

## Method 2: Using wget

If your NAS has `wget`, SSH in and run:

```bash
cd /volume1/docker/

# Download the repository
wget https://github.com/secure-ssid/aruba-central-portal/archive/refs/heads/main.zip -O repo.zip

# Extract
unzip repo.zip

# Rename the folder
mv aruba-central-portal-main central-portal

# Clean up
rm repo.zip
```

---

## After Getting the Files

### 1. Create Your Configuration

```bash
cd /volume1/docker/central-portal
cp .env.example .env
nano .env
```

### 2. Add Your Credentials

Edit the `.env` file:

```env
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_actual_client_id
ARUBA_CLIENT_SECRET=your_actual_client_secret
ARUBA_CUSTOMER_ID=your_actual_customer_id
```

**To get these credentials:**
1. Log in to https://central.arubanetworks.com
2. Go to Account Home → API Gateway → System Apps & Tokens
3. Click "Generate App Credentials"
4. Copy the Client ID, Client Secret, and Customer ID

**Choose the correct Base URL for your region:**
- US East: `https://apigw-prod2.central.arubanetworks.com`
- US West: `https://apigw-uswest4.central.arubanetworks.com`
- EU: `https://apigw-eucentral3.central.arubanetworks.com`
- APAC: `https://apigw-apeast1.central.arubanetworks.com`

### 3. Deploy the Container

```bash
docker-compose up -d
```

### 4. Check the Logs

```bash
docker-compose logs -f
```

Press `Ctrl+C` to exit logs.

### 5. Access the Dashboard

Open your web browser and go to:
```
http://your-nas-ip:1344
```

Use the Setup Wizard to verify and update your credentials.

---

## Troubleshooting

### "unzip: command not found"

Try using `tar` if available, or extract the ZIP on your computer before uploading.

### "docker-compose: command not found"

Try using `docker compose` (without the dash):
```bash
docker compose up -d
```

### "Dockerfile not found"

Make sure you're in the correct directory:
```bash
cd /volume1/docker/central-portal
pwd    # Should show /volume1/docker/central-portal
ls -la # Should show Dockerfile, docker-compose.yml, etc.
```

### Permission denied

```bash
sudo chown -R $(whoami):$(whoami) /volume1/docker/central-portal
```

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
```

---

## Need More Help?

- Full documentation: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- Environment variables: [docs/ENV_VARIABLES.md](docs/ENV_VARIABLES.md)
- Update guide: [UPDATE_DOCKER_CONTAINER.md](UPDATE_DOCKER_CONTAINER.md)
