# Ugreen NAS Quick Setup Guide

## The Problem You're Facing

You're getting this error:
```
failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

This means Docker can't find the Dockerfile in the directory where you're running `docker-compose up`.

## Quick Fix

### Step 1: Verify Your File Structure

SSH into your Ugreen NAS and run:

```bash
cd /volume1/docker/central-portal
ls -la
```

You should see these files:
```
.dockerignore
.env
.env.example
docker-compose.yml
Dockerfile
config.yaml
dashboard/
requirements.txt
scripts/
utils/
```

**If you DON'T see `Dockerfile`**, you need to upload it.

### Step 2: Run the Deployment Checker

```bash
cd /volume1/docker/central-portal
bash deploy-check.sh
```

This script will tell you exactly what's missing.

### Step 3: Upload Missing Files

If files are missing, you need to upload the entire project to your NAS:

**Option A: Using Download Script (Easiest - No Git Required)**

```bash
# SSH into your Ugreen NAS
cd /tmp

# Download the installation script
curl -O https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/download-to-nas.sh

# Make it executable
chmod +x download-to-nas.sh

# Run the installer
bash download-to-nas.sh
```

This will automatically download and set up everything for you!

**Option B: Manual Download & Upload**

1. **On your computer**, download the project:
   - Go to: https://github.com/secure-ssid/aruba-central-portal
   - Click "Code" → "Download ZIP"
   - Extract the ZIP file

2. **Upload to your NAS**:
   - Use WinSCP (Windows), Cyberduck (Mac), or FileZilla
   - Connect to your NAS via SFTP
   - Upload the extracted folder to `/volume1/docker/central-portal/`

**Option C: Using wget (if available)**

```bash
# SSH into your Ugreen NAS
cd /volume1/docker/

# Download the repository as ZIP
wget https://github.com/secure-ssid/aruba-central-portal/archive/refs/heads/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc.zip -O repo.zip

# Extract
unzip repo.zip

# Rename to central-portal
mv Aruba-Central-Portal-claude-docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc central-portal
```

**Option D: Using Git (if you want to install it)**

```bash
# Install git (if your NAS supports opkg)
opkg update
opkg install git

# Then clone
cd /volume1/docker/
git clone https://github.com/secure-ssid/aruba-central-portal.git central-portal
cd central-portal
git checkout claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc
```

**Option E: Manual Upload via SFTP/SCP**

1. Download the entire project folder from GitHub
2. Upload it to your NAS at `/volume1/docker/central-portal/`
3. Make sure ALL files are uploaded, including:
   - Dockerfile
   - docker-compose.yml
   - .dockerignore
   - dashboard/ folder
   - requirements.txt
   - All other project files

### Step 4: Create .env File

```bash
cd /volume1/docker/central-portal
cp .env.example .env
nano .env
```

Edit and add your credentials:
```env
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_actual_client_id
ARUBA_CLIENT_SECRET=your_actual_client_secret
ARUBA_CUSTOMER_ID=your_actual_customer_id
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 5: Deploy

```bash
cd /volume1/docker/central-portal
docker-compose up -d
```

## Alternative: Using Ugreen Container Manager GUI

If you prefer using the web interface:

### 1. Upload Project Files

1. Open Ugreen NAS File Manager
2. Navigate to `/docker/`
3. Create folder `central-portal`
4. Upload ALL project files into this folder

### 2. Create .env File

1. In File Manager, right-click in `central-portal` folder
2. Create new file named `.env`
3. Edit and paste your credentials:
   ```env
   ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
   ARUBA_CLIENT_ID=your_actual_client_id
   ARUBA_CLIENT_SECRET=your_actual_client_secret
   ARUBA_CUSTOMER_ID=your_actual_customer_id
   ```

### 3. Build Container

1. Open Container Manager in Ugreen NAS
2. Go to "Project" tab
3. Click "Create"
4. Name: `aruba-central-portal`
5. Path: `/volume1/docker/central-portal`
6. Select the `docker-compose.yml` file
7. Click "Create"

## Troubleshooting

### Error: "Dockerfile not found"

**Cause**: Dockerfile is not in the directory where docker-compose is running.

**Fix**:
```bash
cd /volume1/docker/central-portal
ls Dockerfile  # Should show the file
pwd            # Should show /volume1/docker/central-portal
```

If `Dockerfile` doesn't exist, you need to upload it.

### Error: "version is obsolete"

**Cause**: Using newer Docker Compose version.

**Fix**: Already fixed! The updated `docker-compose.yml` no longer includes the version field.

### Error: "no configuration file provided"

**Cause**: docker-compose.yml is not in the current directory.

**Fix**:
```bash
cd /volume1/docker/central-portal
ls docker-compose.yml  # Should show the file
```

### Error: Can't connect to Docker daemon

**Cause**: Docker service not running or permission issue.

**Fix**:
```bash
# Check Docker status
systemctl status docker

# Start Docker if needed
sudo systemctl start docker

# Add your user to docker group (then logout/login)
sudo usermod -aG docker $USER
```

## Correct Directory Structure

Your NAS should have this structure:

```
/volume1/docker/central-portal/
├── .dockerignore
├── .env                    # Your credentials (create this!)
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── config.yaml
├── requirements.txt
├── requirements-dev.txt
├── DOCKER_DEPLOYMENT.md
├── ENV_VARIABLES.md
├── README.md
├── deploy-check.sh
├── dashboard/
│   ├── backend/
│   │   ├── app.py
│   │   ├── central_api_client.py
│   │   ├── token_manager.py
│   │   └── requirements.txt
│   └── frontend/
│       ├── package.json
│       ├── src/
│       └── ...
├── scripts/
├── utils/
└── tests/
```

## Step-by-Step Deployment (Complete)

```bash
# 1. SSH into your Ugreen NAS
ssh admin@your-nas-ip

# 2. Navigate to docker directory
cd /volume1/docker/

# 3. Clone the repository
git clone https://github.com/secure-ssid/aruba-central-portal.git central-portal
cd central-portal

# 4. Switch to the Docker deployment branch
git checkout claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc

# 5. Create .env file
cp .env.example .env
nano .env
# Add your credentials and save

# 6. Run deployment check
bash deploy-check.sh

# 7. Build and start
docker-compose up -d

# 8. Check logs
docker-compose logs -f

# 9. Access dashboard
# Open browser: http://your-nas-ip:1344
```

## Need More Help?

Run the deployment checker:
```bash
bash deploy-check.sh
```

This will tell you exactly what's wrong and how to fix it.

## Documentation

- **Full deployment guide**: `DOCKER_DEPLOYMENT.md`
- **Environment variables**: `ENV_VARIABLES.md`
- **Application docs**: `README.md`
