# GitHub Container Registry (GHCR) Setup Guide

Complete guide for building and publishing Docker images to GitHub Container Registry.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup GitHub Repository](#setup-github-repository)
4. [Manual Build & Push](#manual-build--push)
5. [Automated Builds with GitHub Actions](#automated-builds-with-github-actions)
6. [Pulling Images](#pulling-images)
7. [Troubleshooting](#troubleshooting)

---

## Overview

GitHub Container Registry (GHCR) allows you to store and manage Docker images alongside your code. Benefits:

- ✅ **Free for public repositories**
- ✅ **Unlimited bandwidth for public images**
- ✅ **Integrated with GitHub Actions**
- ✅ **Automatic versioning with Git tags**
- ✅ **No separate account needed**

**Your image will be published at:**
```
ghcr.io/secure-ssid/aruba-central-portal:latest
ghcr.io/secure-ssid/aruba-central-portal:v1.0.0
```

---

## Prerequisites

### Required Tools

1. **Docker Desktop** (installed and running)
   - See [DOCKER_DESKTOP_INSTALL.md](DOCKER_DESKTOP_INSTALL.md)

2. **GitHub Account**
   - Repository created: `https://github.com/secure-ssid/aruba-central-portal`

3. **Git** (installed locally)
   ```bash
   git --version
   ```

### Repository Setup

```bash
# 1. Initialize git (if not already done)
git init

# 2. Add remote
git remote add origin https://github.com/secure-ssid/aruba-central-portal.git

# 3. Commit your code
git add .
git commit -m "Initial commit"
git push -u origin main
```

---

## Setup GitHub Repository

### 1. Enable GitHub Packages

GitHub Packages (GHCR) is automatically enabled for all repositories.

### 2. Make Images Public (Optional)

By default, container images are private. To make them public:

1. **After first push**, go to:
   ```
   https://github.com/secure-ssid?tab=packages
   ```

2. **Click your package aruba-central-portal`)

3. **Package Settings → Danger Zone**
   - Click "Change visibility"
   - Select "Public"
   - Confirm

### 3. Create Personal Access Token (PAT)

**For manual pushes:**

1. **Go to:** https://github.com/settings/tokens
2. **Click:** "Generate new token" → "Generate new token (classic)"
3. **Settings:**
   - Note: `GHCR Docker Push`
   - Expiration: `No expiration` (or custom)
   - Scopes: Check these:
     - ✅ `write:packages`
     - ✅ `read:packages`
     - ✅ `delete:packages`
     - ✅ `repo` (if private repository)
4. **Generate token**
5. **Copy token** (save it securely, you won't see it again)

**For GitHub Actions:**

GitHub Actions automatically uses `GITHUB_TOKEN` - no manual setup needed!

---

## Manual Build & Push

### Method 1: Using Provided Scripts

We've created helper scripts for easy building and pushing:

```bash
# 1. Make scripts executable
chmod +x docker-build-and-push.sh

# 2. Set your GitHub username
export GITHUB_USERNAME=secure-ssid

# 3. Build and push
./docker-build-and-push.sh
```

The script will:
- Build the Docker image
- Tag it with `latest` and version from git tag
- Log in to GHCR
- Push the images

### Method 2: Manual Commands

**Step 1: Build the image**

```bash
# Set your GitHub username
export GITHUB_USERNAME=secure-ssid

# Build the image
docker build -t ghcr.io/$GITHUB_USERNAME/aruba-central-portal:latest .

# Optionally tag with version
docker tag ghcr.io/$GITHUB_USERNAME/aruba-central-portal:latest \
           ghcr.io/$GITHUB_USERNAME/aruba-central-portal:v1.0.0
```

**Step 2: Login to GHCR**

```bash
# Login with PAT (you'll be prompted for password - paste your PAT)
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Or interactive login
docker login ghcr.io -u $GITHUB_USERNAME
# Password: [paste your PAT]
```

**Step 3: Push the image**

```bash
# Push latest
docker push ghcr.io/$GITHUB_USERNAME/aruba-central-portal:latest

# Push version tag (if created)
docker push ghcr.io/$GITHUB_USERNAME/aruba-central-portal:v1.0.0
```

**Step 4: Verify**

Visit: `https://github.com/secure-ssid?tab=packages`

---

## Automated Builds with GitHub Actions

### Overview

GitHub Actions can automatically build and push images when you:
- Push to main branch
- Create a release/tag
- Manually trigger

### Setup

The GitHub Actions workflow is already created at `.github/workflows/docker-publish.yml`

**No additional setup needed!** It will automatically:
- Build on every push to `main`
- Tag with `latest` for main branch
- Tag with version for git tags (e.g., `v1.0.0`)
- Use `GITHUB_TOKEN` (automatically provided)

### Trigger Automated Build

**Method 1: Push to main**
```bash
git add .
git commit -m "Update application"
git push origin main
```

**Method 2: Create a release**
```bash
# Create and push a tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

**Method 3: Manual trigger**
1. Go to: `https://github.com/secure-ssid/aruba-central-portal/actions`
2. Select "Docker Build and Push"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

### Monitor Build

1. **Go to Actions tab:**
   ```
   https://github.com/secure-ssid/aruba-central-portal/actions
   ```

2. **Click on the running workflow**

3. **View build logs**

### Build Status

Builds typically take 5-10 minutes depending on:
- Docker layer caching
- Network speed
- Frontend build time

---

## Pulling Images

### Public Images (No Authentication)

```bash
# Pull latest
docker pull ghcr.io/secure-ssid/aruba-central-portal:latest

# Pull specific version
docker pull ghcr.io/secure-ssid/aruba-central-portal:v1.0.0

# Run the container
docker run -d \
  --name aruba-central-portal \
  -p 1344:1344 \
  --env-file .env \
  ghcr.io/secure-ssid/aruba-central-portal:latest
```

### Using docker-compose

Use the provided `docker-compose.ghcr.yml`:

```bash
# Pull and run
docker compose -f docker-compose.ghcr.yml up -d

# Update to latest
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

### Private Images (Authentication Required)

```bash
# Login first
docker login ghcr.io -u secure-ssid

# Then pull
docker pull ghcr.io/secure-ssid/aruba-central-portal:latest
```

---

## Troubleshooting

### Authentication Failed

**Error:** `unauthorized: authentication required`

**Solutions:**

1. **Verify PAT has correct permissions:**
   - `write:packages`, `read:packages`

2. **Re-login:**
   ```bash
   docker logout ghcr.io
   docker login ghcr.io -u secure-ssid
   ```

3. **Check token expiration:**
   - Go to https://github.com/settings/tokens
   - Regenerate if expired

### Build Failed in GitHub Actions

**Check logs:**

1. Go to Actions tab
2. Click failed workflow
3. Click failed job
4. View error messages

**Common issues:**

- **Out of disk space:** Clean up old images
- **Network timeout:** Retry the build
- **Invalid Dockerfile:** Test build locally first

### Image Not Found

**Error:** `manifest unknown`

**Solutions:**

1. **Check image name:**
   ```bash
   # Correct format
   ghcr.io/secure-ssid/aruba-central-portal:latest

   # NOT
   ghcr.io/aruba-central-portal:latest
   ```

2. **Verify image exists:**
   ```
   https://github.com/secure-ssid?tab=packages
   ```

3. **Check visibility:** Make sure it's public or you're authenticated

### Rate Limiting

GHCR has generous rate limits:
- **Authenticated:** Unlimited pulls for public images
- **Unauthenticated:** 1000 pulls per IP per hour

If rate limited, authenticate:
```bash
docker login ghcr.io
```

### Large Image Size

**Check image size:**
```bash
docker images ghcr.io/secure-ssid/aruba-central-portal
```

**Optimize:**

1. **Use multi-stage builds** (already implemented in Dockerfile)
2. **Clean up build cache:**
   ```bash
   docker builder prune
   ```
3. **Minimize layers:**
   - Combine RUN commands
   - Remove unnecessary files

---

## Advanced Usage

### Multi-platform Builds

Build for multiple architectures (AMD64, ARM64):

```bash
# Create buildx builder
docker buildx create --name multiplatform --use

# Build and push for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/$GITHUB_USERNAME/aruba-central-portal:latest \
  --push \
  .
```

### Tagging Strategy

**Recommended tags:**

```bash
# Latest (main branch)
ghcr.io/secure-ssid/aruba-central-portal:latest

# Semantic version
ghcr.io/secure-ssid/aruba-central-portal:v1.0.0
ghcr.io/secure-ssid/aruba-central-portal:v1.0
ghcr.io/secure-ssid/aruba-central-portal:v1

# Git commit SHA (for debugging)
ghcr.io/secure-ssid/aruba-central-portal:sha-abc123

# Branch name (for testing)
ghcr.io/secure-ssid/aruba-central-portal:dev
```

### Cleanup Old Images

GitHub automatically retains:
- All tagged images
- Untagged images for 14 days

**Manual cleanup:**

1. Go to package settings
2. Versions tab
3. Delete old versions

**Automated cleanup** (already in GitHub Actions):
- Deletes untagged images older than 7 days
- Keeps all tagged versions

---

## Image Verification

### Inspect Image

```bash
# View image details
docker inspect ghcr.io/secure-ssid/aruba-central-portal:latest

# View image history
docker history ghcr.io/secure-ssid/aruba-central-portal:latest

# View image layers
docker image inspect ghcr.io/secure-ssid/aruba-central-portal:latest --format='{{.RootFS.Layers}}'
```

### Security Scanning

```bash
# Scan with Docker Scout (built into Docker Desktop)
docker scout cves ghcr.io/secure-ssid/aruba-central-portal:latest

# Scan with Trivy
docker run aquasec/trivy image ghcr.io/secure-ssid/aruba-central-portal:latest
```

---

## Cost & Limits

### GitHub Container Registry Limits

**Free tier (public repositories):**
- ✅ Unlimited storage
- ✅ Unlimited bandwidth
- ✅ Unlimited pulls

**Free tier (private repositories):**
- ✅ 500 MB storage
- ✅ 1 GB bandwidth/month
- 💰 Additional usage charged

**For this project (public):** Completely free!

---

## Next Steps

- ✅ Images published to GHCR
- 🔄 Automated builds on every push
- 🚀 Users can pull with `docker pull ghcr.io/secure-ssid/aruba-central-portal:latest`
- 📦 Add badge to README: ![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue)

---

## Support

- 📚 Docker Documentation: https://docs.docker.com
- 🐙 GitHub Packages Docs: https://docs.github.com/packages
- 💬 Issues: [GitHub Issues](https://github.com/secure-ssid/aruba-central-portal/issues)
