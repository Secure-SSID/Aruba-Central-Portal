#!/bin/bash
# Force rebuild Docker container with latest code changes
# Use this after adding new features to ensure they're in the container

set -e

echo "================================================"
echo "Aruba Central Portal - Force Update & Rebuild"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="/volume1/docker/central-portal"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found!"
    echo "Run this script from: $INSTALL_DIR"
    exit 1
fi

echo "Current directory: $(pwd)"
echo ""

# Backup .env file
if [ -f ".env" ]; then
    echo "Backing up .env file..."
    cp .env .env.backup
    echo -e "${GREEN}✓${NC} .env backed up to .env.backup"
fi

echo ""
echo "Step 1: Stopping current container..."
docker compose down
echo -e "${GREEN}✓${NC} Container stopped"

echo ""
echo "Step 2: Removing old images to force rebuild..."
docker compose down --rmi local 2>/dev/null || true
echo -e "${GREEN}✓${NC} Old images removed"

echo ""
echo "Step 3: Building fresh container (this may take 5-10 minutes)..."
echo -e "${YELLOW}Note: Using --no-cache to ensure all changes are picked up${NC}"
docker compose build --no-cache

echo ""
echo "Step 4: Starting updated container..."
docker compose up -d

echo ""
echo "Step 5: Waiting for container to be healthy..."
sleep 5

# Check container status
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Container is running!"
else
    echo "Warning: Container may not be running properly"
    echo "Check logs with: docker compose logs -f"
fi

echo ""
echo "================================================"
echo "Update Complete!"
echo "================================================"
echo ""
echo "Your new features should now be active."
echo ""
echo "Next steps:"
echo "1. Check logs: docker compose logs -f"
echo "2. Access dashboard: http://your-nas-ip:1344"
echo "3. Test your new features"
echo ""
echo "If something went wrong, restore .env:"
echo "  cp .env.backup .env"
echo "================================================"
