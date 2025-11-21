#!/bin/bash
# Deployment verification script for Aruba Central Portal on Ugreen NAS
# This script checks that all required files are present before deployment

set -e

echo "================================================"
echo "Aruba Central Portal - Deployment Verification"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if all checks pass
ALL_CHECKS_PASSED=true

# Check if we're in the correct directory
echo "Checking required files..."
echo ""

# Check Dockerfile
if [ -f "Dockerfile" ]; then
    echo -e "${GREEN}✓${NC} Dockerfile found"
else
    echo -e "${RED}✗${NC} Dockerfile NOT found"
    ALL_CHECKS_PASSED=false
fi

# Check docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✓${NC} docker-compose.yml found"
else
    echo -e "${RED}✗${NC} docker-compose.yml NOT found"
    ALL_CHECKS_PASSED=false
fi

# Check .dockerignore
if [ -f ".dockerignore" ]; then
    echo -e "${GREEN}✓${NC} .dockerignore found"
else
    echo -e "${YELLOW}⚠${NC} .dockerignore not found (optional but recommended)"
fi

# Check .env file
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file found"

    # Check for required environment variables
    echo ""
    echo "Checking environment variables in .env file..."

    if grep -q "^ARUBA_BASE_URL=" .env && ! grep -q "^ARUBA_BASE_URL=.*your_.*" .env; then
        echo -e "${GREEN}✓${NC} ARUBA_BASE_URL is set"
    else
        echo -e "${RED}✗${NC} ARUBA_BASE_URL is not set or still has placeholder value"
        ALL_CHECKS_PASSED=false
    fi

    if grep -q "^ARUBA_CLIENT_ID=" .env && ! grep -q "^ARUBA_CLIENT_ID=.*your_.*" .env; then
        echo -e "${GREEN}✓${NC} ARUBA_CLIENT_ID is set"
    else
        echo -e "${RED}✗${NC} ARUBA_CLIENT_ID is not set or still has placeholder value"
        ALL_CHECKS_PASSED=false
    fi

    if grep -q "^ARUBA_CLIENT_SECRET=" .env && ! grep -q "^ARUBA_CLIENT_SECRET=.*your_.*" .env; then
        echo -e "${GREEN}✓${NC} ARUBA_CLIENT_SECRET is set"
    else
        echo -e "${RED}✗${NC} ARUBA_CLIENT_SECRET is not set or still has placeholder value"
        ALL_CHECKS_PASSED=false
    fi

    if grep -q "^ARUBA_CUSTOMER_ID=" .env && ! grep -q "^ARUBA_CUSTOMER_ID=.*your_.*" .env; then
        echo -e "${GREEN}✓${NC} ARUBA_CUSTOMER_ID is set"
    else
        echo -e "${RED}✗${NC} ARUBA_CUSTOMER_ID is not set or still has placeholder value"
        ALL_CHECKS_PASSED=false
    fi
else
    echo -e "${RED}✗${NC} .env file NOT found"
    echo -e "${YELLOW}  → Run: cp .env.example .env${NC}"
    echo -e "${YELLOW}  → Then edit .env with your Aruba Central credentials${NC}"
    ALL_CHECKS_PASSED=false
fi

# Check dashboard directory
echo ""
echo "Checking application structure..."
if [ -d "dashboard" ]; then
    echo -e "${GREEN}✓${NC} dashboard directory found"

    if [ -d "dashboard/backend" ]; then
        echo -e "${GREEN}✓${NC} dashboard/backend directory found"
    else
        echo -e "${RED}✗${NC} dashboard/backend directory NOT found"
        ALL_CHECKS_PASSED=false
    fi

    if [ -d "dashboard/frontend" ]; then
        echo -e "${GREEN}✓${NC} dashboard/frontend directory found"
    else
        echo -e "${RED}✗${NC} dashboard/frontend directory NOT found"
        ALL_CHECKS_PASSED=false
    fi
else
    echo -e "${RED}✗${NC} dashboard directory NOT found"
    ALL_CHECKS_PASSED=false
fi

# Check Docker
echo ""
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker is installed"
    docker --version
else
    echo -e "${RED}✗${NC} Docker is NOT installed"
    ALL_CHECKS_PASSED=false
fi

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker Compose is available"
else
    echo -e "${RED}✗${NC} Docker Compose is NOT available"
    ALL_CHECKS_PASSED=false
fi

# Final summary
echo ""
echo "================================================"
if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    echo "You're ready to deploy. Run:"
    echo "  docker-compose up -d"
    echo ""
    echo "Then access the dashboard at:"
    echo "  http://<your-nas-ip>:1344"
    echo "================================================"
    exit 0
else
    echo -e "${RED}Some checks failed!${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    echo ""
    echo "Common fixes:"
    echo "  1. Make sure you're in the project root directory"
    echo "  2. Create .env file: cp .env.example .env"
    echo "  3. Edit .env with your Aruba Central credentials"
    echo "  4. Ensure all project files are uploaded to your NAS"
    echo ""
    echo "For help, see:"
    echo "  - DOCKER_DEPLOYMENT.md"
    echo "  - ENV_VARIABLES.md"
    echo "================================================"
    exit 1
fi
