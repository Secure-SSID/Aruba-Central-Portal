# Docker Push to GitHub - Complete Guide

> **Note:** GitHub automatically provides free Docker image hosting for all repositories at `ghcr.io` (GitHub Container Registry). This is built into GitHub - no external service needed!

---

## 📋 What You'll Accomplish

After following this guide, your Docker image will be:
- ✅ Stored directly in your GitHub repository
- ✅ Viewable at: `https://github.com/secure-ssid?tab=packages`
- ✅ Pullable with: `docker pull ghcr.io/secure-ssid/aruba-central-portal:latest`
- ✅ Automatically built on every git push

**ghcr.io** = GitHub Container Registry (it's GitHub, not a third-party service!)

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Push Your Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create repository on GitHub, then:
git remote add origin https://github.com/secure-ssid/aruba-central-portal.git
git push -u origin main
```

### Step 2: GitHub Actions Builds Automatically

That's it! GitHub Actions (already configured in `.github/workflows/docker-publish.yml`) will automatically:
1. Build your Docker image
2. Push to GitHub Container Registry
3. Make it available at `ghcr.io/secure-ssid/aruba-central-portal:latest`

**Check build status:**
- Go to: `https://github.com/secure-ssid/aruba-central-portal/actions`

### Step 3: Make Your Image Public (Optional)

After the first build completes:

1. **Go to your packages:**
   ```
   https://github.com/secure-ssid?tab=packages
   ```

2. **Click your package aruba-central-portal)

3. **Package Settings** (right sidebar) → **Danger Zone**
   - Click "Change visibility"
   - Select "Public"
   - Confirm

Now anyone can pull your image without authentication!

---

## 🎯 Using Your Published Image

### Pull from GitHub
```bash
# Pull your image from GitHub
docker pull ghcr.io/secure-ssid/aruba-central-portal:latest

# Run it
docker run -d -p 1344:1344 \
  --name aruba-central-portal \
  --env-file .env \
  ghcr.io/secure-ssid/aruba-central-portal:latest
```

### Share with Others
```bash
# Others can pull your image directly from GitHub
docker pull ghcr.io/secure-ssid/aruba-central-portal:latest
```

---

## 🔄 Automatic Builds

The GitHub Actions workflow builds automatically when you:

### Push to Main Branch
```bash
git add .
git commit -m "Update application"
git push origin main
```
→ Builds and tags as `latest`

### Create a Release Tag
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```
→ Builds and tags as `v1.0.0`, `v1.0`, and `v1`

---

## 📦 Where Are Images Stored?

All images are stored in GitHub:

**Your Packages Page:**
```
https://github.com/secure-ssid?tab=packages
```

**Your Specific Package:**
```
https://github.com/secure-ssid/aruba-central-portal/pkgs/container/Aruba-Central-Portal
```

**Pull URLs:**
```bash
# Latest version
ghcr.io/secure-ssid/aruba-central-portal:latest

# Specific version
ghcr.io/secure-ssid/aruba-central-portal:v1.0.0

# Specific commit
ghcr.io/secure-ssid/aruba-central-portal:sha-abc123
```

---

## 🛠️ Manual Build & Push (Optional)

If you want to build and push manually instead of using GitHub Actions:

### Create GitHub Personal Access Token

1. **Go to:** https://github.com/settings/tokens
2. **Generate new token (classic)**
3. **Select scopes:**
   - ✅ `write:packages`
   - ✅ `read:packages`
   - ✅ `delete:packages`
4. **Copy the token** (save it securely)

### Build and Push

```bash
# Set your GitHub username
export GITHUB_USERNAME=your_username
export GITHUB_TOKEN=your_personal_access_token

# Login to GitHub's Docker registry
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Build the image
docker build -t ghcr.io/$GITHUB_USERNAME/aruba-central-portal:latest .

# Push to GitHub
docker push ghcr.io/$GITHUB_USERNAME/aruba-central-portal:latest
```

**Or use the provided script:**
```bash
export GITHUB_USERNAME=your_username
./docker-build-and-push.sh
```

---

## 📊 Verify Your Image

### Check on GitHub
1. Go to: `https://github.com/secure-ssid?tab=packages`
2. You should see `Aruba-Central-Portal`
3. Click it to see all versions/tags

### Pull and Test
```bash
# Pull your image
docker pull ghcr.io/secure-ssid/aruba-central-portal:latest

# Verify it pulled successfully
docker images | grep aruba-central-portal

# Test run
docker run --rm ghcr.io/secure-ssid/aruba-central-portal:latest python --version
```

---

## 🔍 Understanding the Setup

### What is ghcr.io?

**ghcr.io = GitHub Container Registry**

It's GitHub's built-in Docker image hosting service:
- Integrated with GitHub repositories
- Free for public images
- Unlimited bandwidth
- Same authentication as GitHub

Think of it like:
- `github.com` = stores your code
- `ghcr.io` = stores your Docker images

### File Structure

```
your-repo/
├── .github/
│   └── workflows/
│       └── docker-publish.yml    # Auto-builds on push
├── Dockerfile                     # How to build image
├── docker-compose.yml             # Build from source
├── docker-compose.ghcr.yml        # Pull from GitHub
└── docker-build-and-push.sh       # Manual push script
```

---

## 🎓 Common Questions

### Q: Do I need to create an account on ghcr.io?
**A:** No! It's automatically available with your GitHub account.

### Q: Where do I see my Docker images?
**A:** On GitHub at `https://github.com/secure-ssid?tab=packages`

### Q: Is this free?
**A:** Yes! Free unlimited storage and bandwidth for public images.

### Q: Can I use Docker Hub instead?
**A:** Yes, but GitHub Container Registry is recommended because:
- Built into GitHub (no separate account)
- Free unlimited bandwidth
- Integrated with GitHub Actions
- Same permissions as your repo

### Q: What happens when I push code?
**A:** GitHub Actions automatically:
1. Detects the push
2. Builds your Docker image
3. Pushes to ghcr.io/secure-ssid/aruba-central-portal
4. Available within 5-10 minutes

### Q: How do I update the image?
**A:** Just push new code to GitHub - Actions rebuilds automatically!

---

## 🚨 Troubleshooting

### Build Failed in GitHub Actions

**Check the logs:**
1. Go to `https://github.com/secure-ssid/aruba-central-portal/actions`
2. Click the failed workflow
3. Click the failed job
4. Read error messages

**Common fixes:**
- Build works locally? `docker build -t test .`
- Check Dockerfile syntax
- Verify all files are committed
- Re-run the workflow (sometimes temporary failures)

### Can't Find Package

**After first push, go to:**
```
https://github.com/secure-ssid?tab=packages
```

**If it's not there:**
1. Check Actions succeeded
2. Wait a few minutes (can take 5-10 min)
3. Verify workflow ran: `https://github.com/secure-ssid/aruba-central-portal/actions`

### Authentication Failed When Pulling

**For public images:**
```bash
# Should work without login
docker pull ghcr.io/secure-ssid/aruba-central-portal:latest
```

**If private or getting auth errors:**
```bash
# Login to GitHub's Docker registry
docker login ghcr.io -u secure-ssid
# Password: use your GitHub token, not your GitHub password
```

---

## ✅ Success Checklist

After setup, verify:

- [ ] Code is on GitHub: `https://github.com/secure-ssid/aruba-central-portal`
- [ ] Actions workflow ran: `https://github.com/secure-ssid/aruba-central-portal/actions`
- [ ] Package is visible: `https://github.com/secure-ssid?tab=packages`
- [ ] Can pull image: `docker pull ghcr.io/secure-ssid/aruba-central-portal:latest`
- [ ] Image is public (if desired)
- [ ] README badges updated with your username

---

## 🎯 Next Steps

1. **Replace `Secure-SSID`** in all documentation:
   ```bash
   find . -type f \( -name "*.md" -o -name "*.yml" \) \
     -exec sed -i 's/Secure-SSID/actual_username/g' {} \;
   ```

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Docker setup"
   git push origin main
   ```

3. **Wait for Actions to build** (~5-10 minutes)

4. **Make package public** (if desired)

5. **Share with users:**
   ```bash
   docker pull ghcr.io/secure-ssid/aruba-central-portal:latest
   ```

---

## 📚 Related Documentation

- **[DOCKER_DESKTOP_INSTALL.md](DOCKER_DESKTOP_INSTALL.md)** - Installing Docker Desktop
- **[Docker Documentation](https://docs.docker.com)** - Official Docker reference
- **[README.md](README.md)** - Main project documentation

---

## 🆘 Need Help?

- **GitHub Actions Issues:** Check `.github/workflows/docker-publish.yml`
- **Build Issues:** Run `docker build -t test .` locally first
- **Questions:** Open an issue on GitHub

Your Docker images are stored in GitHub and will auto-build on every push! 🚀
