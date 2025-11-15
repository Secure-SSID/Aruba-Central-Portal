#!/bin/bash
# Helper script to detect and set UID/GID for Docker

echo "===================================="
echo "  Docker UID/GID Configuration"
echo "===================================="
echo ""

# Get current user's UID and GID
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
CURRENT_USER=$(whoami)

echo "Current user: $CURRENT_USER"
echo "Current UID:  $CURRENT_UID"
echo "Current GID:  $CURRENT_GID"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        touch .env
    fi
fi

# Check if PUID/PGID already set
if grep -q "^PUID=" .env 2>/dev/null; then
    EXISTING_PUID=$(grep "^PUID=" .env | cut -d'=' -f2)
    EXISTING_PGID=$(grep "^PGID=" .env | cut -d'=' -f2)
    echo "Current .env settings:"
    echo "  PUID=$EXISTING_PUID"
    echo "  PGID=$EXISTING_PGID"
    echo ""
fi

# Recommendation
echo "Recommendations:"
echo ""
echo "1. Run as current user (RECOMMENDED for security):"
echo "   PUID=$CURRENT_UID"
echo "   PGID=$CURRENT_GID"
echo "   → Best for security, may need file ownership fixes"
echo ""
echo "2. Run as root (easier permissions, less secure):"
echo "   PUID=0"
echo "   PGID=0"
echo "   → Easiest for NAS permission issues"
echo ""
echo "3. Run as common user (1000:1000):"
echo "   PUID=1000"
echo "   PGID=1000"
echo "   → Good balance for most systems"
echo ""

read -p "Choose option (1/2/3) or 'q' to quit: " choice

case $choice in
    1)
        SELECTED_UID=$CURRENT_UID
        SELECTED_GID=$CURRENT_GID
        echo "Setting to current user ($CURRENT_USER)"
        ;;
    2)
        SELECTED_UID=0
        SELECTED_GID=0
        echo "Setting to root (0:0)"
        ;;
    3)
        SELECTED_UID=1000
        SELECTED_GID=1000
        echo "Setting to common user (1000:1000)"
        ;;
    q|Q)
        echo "Exiting without changes"
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "Updating .env file..."

# Remove existing PUID/PGID lines
sed -i.bak '/^PUID=/d' .env 2>/dev/null || true
sed -i.bak '/^PGID=/d' .env 2>/dev/null || true

# Add new PUID/PGID at the top
{
    echo "# Docker User Configuration"
    echo "PUID=$SELECTED_UID"
    echo "PGID=$SELECTED_GID"
    echo ""
    cat .env
} > .env.tmp && mv .env.tmp .env

echo "✓ .env updated with:"
echo "  PUID=$SELECTED_UID"
echo "  PGID=$SELECTED_GID"
echo ""

# Fix file permissions for selected user
if [ "$SELECTED_UID" != "0" ]; then
    echo "Fixing file ownership..."
    sudo chown -R $SELECTED_UID:$SELECTED_GID . 2>/dev/null || \
        echo "⚠ Could not change ownership. You may need to run: sudo chown -R $SELECTED_UID:$SELECTED_GID ."
    echo ""
fi

echo "Next steps:"
echo "1. Rebuild container: docker compose build"
echo "2. Restart container: docker compose up -d"
echo "3. Or run: ./update-portal.sh"
echo ""
