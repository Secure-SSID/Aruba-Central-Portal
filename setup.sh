#!/bin/bash
# Setup script for Aruba Central Portal
# This script prepares the environment for first-time setup

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Aruba Central Portal - Initial Setup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠${NC}  .env file already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file"
    else
        echo -e "${BLUE}ℹ${NC}  Creating .env file from template..."
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env file"
    fi
else
    echo -e "${BLUE}ℹ${NC}  Creating .env file from template..."
    cp .env.example .env
    echo -e "${GREEN}✓${NC} Created .env file"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the containers:"
echo -e "     ${BLUE}docker compose up -d --build${NC}"
echo ""
echo "  2. Wait 30-60 seconds for the container to start"
echo ""
echo "  3. Open your browser to:"
echo -e "     ${BLUE}http://localhost:1344${NC}"
echo -e "     or ${BLUE}http://YOUR_NAS_IP:1344${NC}"
echo ""
echo "  4. Use the Setup Wizard to configure your Aruba Central credentials"
echo ""
echo -e "${YELLOW}Note:${NC} You don't need to manually edit the .env file."
echo "      All configuration is done through the web interface!"
echo ""
