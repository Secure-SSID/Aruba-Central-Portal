#!/bin/bash
# Automated Update Script for Aruba Central Portal
# Works for both git and non-git deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Aruba Central Portal - Automated Update${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if running as root (not recommended but handle it)
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}⚠ Warning: Running as root. Consider running as regular user.${NC}"
fi

# Detect installation directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}📁 Working directory: $SCRIPT_DIR${NC}"
echo ""

# Step 1: Detect if this is a git repository
echo -e "${BLUE}Step 1: Checking repository type...${NC}"
if [ -d ".git" ]; then
    echo -e "${GREEN}✓ Git repository detected${NC}"
    IS_GIT=true
else
    echo -e "${YELLOW}⚠ Not a git repository (manual deployment)${NC}"
    IS_GIT=false
fi
echo ""

# Step 2: Update files
echo -e "${BLUE}Step 2: Updating files...${NC}"

if [ "$IS_GIT" = true ]; then
    # Git-based update
    echo "Fetching latest changes from git..."
    git fetch origin

    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "Current branch: $CURRENT_BRANCH"

    # Pull from main branch
    echo "Pulling latest changes from main..."
    git pull origin main

    echo -e "${GREEN}✓ Git update complete${NC}"
else
    # Non-git update - update files directly from main branch
    BRANCH="main"
    BASE_URL="https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/${BRANCH}"

    echo "Backing up current files..."
    [ -f Dockerfile ] && cp Dockerfile Dockerfile.backup.$(date +%Y%m%d_%H%M%S)
    [ -f docker-compose.yml ] && cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

    echo "Downloading latest Dockerfile..."
    curl -fsSL "${BASE_URL}/Dockerfile" -o Dockerfile.new

    echo "Downloading latest docker-compose.yml..."
    curl -fsSL "${BASE_URL}/docker-compose.yml" -o docker-compose.yml.new

    echo "Downloading latest backend app.py..."
    mkdir -p dashboard/backend
    curl -fsSL "${BASE_URL}/dashboard/backend/app.py" -o dashboard/backend/app.py.new

    echo "Downloading latest SetupWizard..."
    mkdir -p dashboard/frontend/src/pages
    curl -fsSL "${BASE_URL}/dashboard/frontend/src/pages/SetupWizard.jsx" -o dashboard/frontend/src/pages/SetupWizard.jsx.new

    # Move new files into place
    [ -f Dockerfile.new ] && mv Dockerfile.new Dockerfile
    [ -f docker-compose.yml.new ] && mv docker-compose.yml.new docker-compose.yml
    [ -f dashboard/backend/app.py.new ] && mv dashboard/backend/app.py.new dashboard/backend/app.py
    [ -f dashboard/frontend/src/pages/SetupWizard.jsx.new ] && mv dashboard/frontend/src/pages/SetupWizard.jsx.new dashboard/frontend/src/pages/SetupWizard.jsx

    echo -e "${GREEN}✓ Files updated from ${BRANCH} branch${NC}"
fi
echo ""

# Step 3: Create/fix .env file permissions
echo -e "${BLUE}Step 3: Setting up .env file...${NC}"

# Check if .env exists
if [ -f .env ]; then
    echo "Found existing .env file"

    # Remove immutable flag if present (common on NAS systems)
    if command -v lsattr &> /dev/null && command -v chattr &> /dev/null; then
        ATTRS=$(lsattr .env 2>/dev/null | awk '{print $1}' || echo "")
        if [[ $ATTRS == *"i"* ]]; then
            echo "Removing immutable flag..."
            sudo chattr -i .env 2>/dev/null || chattr -i .env 2>/dev/null || true
        fi
        # Remove any other special attributes
        sudo chattr -aisu .env 2>/dev/null || chattr -aisu .env 2>/dev/null || true
    fi

    # Backup existing content
    if [ -s .env ]; then
        echo "Backing up existing .env..."
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || sudo cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    fi
else
    echo "Creating new .env file..."
    touch .env 2>/dev/null || sudo touch .env
fi

# Set permissions (try without sudo first, then with)
echo "Setting permissions..."
chmod 666 .env 2>/dev/null || sudo chmod 666 .env

echo -e "${GREEN}✓ .env file ready (permissions: 666)${NC}"
ls -la .env 2>/dev/null | grep "\.env" || echo "  (created successfully)"
echo ""

# Step 4: Check Docker
echo -e "${BLUE}Step 4: Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found!${NC}"
    echo "Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found!${NC}"
    echo "Please install Docker Compose first."
    exit 1
fi

# Use docker compose or docker-compose depending on what's available
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}✓ Docker ready (using: $COMPOSE_CMD)${NC}"
echo ""

# Step 5: Stop current container
echo -e "${BLUE}Step 5: Stopping current container...${NC}"
$COMPOSE_CMD down
echo -e "${GREEN}✓ Container stopped${NC}"
echo ""

# Step 6: Rebuild container
echo -e "${BLUE}Step 6: Rebuilding container...${NC}"
echo -e "${YELLOW}⏱  This may take 5-10 minutes...${NC}"
echo ""
$COMPOSE_CMD build --no-cache
echo ""
echo -e "${GREEN}✓ Container rebuilt${NC}"
echo ""

# Step 7: Start container
echo -e "${BLUE}Step 7: Starting container...${NC}"
$COMPOSE_CMD up -d
echo -e "${GREEN}✓ Container started${NC}"
echo ""

# Step 8: Wait for container to be healthy
echo -e "${BLUE}Step 8: Waiting for container to be healthy...${NC}"
sleep 5

# Check if container is running
if $COMPOSE_CMD ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Container is running!${NC}"
else
    echo -e "${RED}✗ Container may not be running properly${NC}"
    echo "Check logs with: $COMPOSE_CMD logs -f"
fi
echo ""

# Get IP address
IP_ADDR=$(hostname -I | awk '{print $1}')

# Final summary
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}           Update Complete! 🎉${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Access your dashboard:${NC}"
echo -e "  ${GREEN}http://${IP_ADDR}:1344${NC}"
echo ""
echo -e "${BLUE}What's new:${NC}"
echo "  ✓ All 13 API Gateway regions available"
echo "  ✓ Setup Wizard can now save credentials"
echo "  ✓ Environment variables reload automatically"
echo "  ✓ Proper file permissions for .env"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Open the dashboard URL above"
echo "  2. Complete Setup Wizard if first time"
echo "  3. Select your region from dropdown"
echo "  4. Enter API credentials"
echo "  5. Start managing your network!"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:    $COMPOSE_CMD logs -f"
echo "  Restart:      $COMPOSE_CMD restart"
echo "  Stop:         $COMPOSE_CMD down"
echo "  Status:       $COMPOSE_CMD ps"
echo ""
echo -e "${BLUE}Support:${NC}"
echo "  Report issues: https://github.com/secure-ssid/aruba-central-portal/issues"
echo ""
echo -e "${GREEN}================================================${NC}"
