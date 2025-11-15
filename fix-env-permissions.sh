#!/bin/bash
# Fix .env file permissions - handles immutable flags

set -e

echo "Fixing .env file permissions..."
echo ""

cd /volume1/docker/central-portal || cd "$(dirname "$0")"

# Check if .env exists
if [ -f .env ]; then
    echo "Found existing .env file"

    # Check for immutable attribute
    if command -v lsattr &> /dev/null; then
        echo "Checking for immutable flag..."
        ATTRS=$(lsattr .env 2>/dev/null | awk '{print $1}')
        if [[ $ATTRS == *"i"* ]]; then
            echo "Immutable flag detected - removing..."
            sudo chattr -i .env
        fi
    fi

    # Try to remove any other special attributes
    sudo chattr -aisu .env 2>/dev/null || true

    # Backup and recreate
    echo "Backing up existing .env..."
    sudo cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

    # Save content
    ENV_CONTENT=$(sudo cat .env)

    echo "Recreating .env file..."
    sudo rm -f .env
    sudo touch .env

    # Write content back if there was any
    if [ ! -z "$ENV_CONTENT" ]; then
        echo "$ENV_CONTENT" | sudo tee .env > /dev/null
    fi
else
    echo "Creating new .env file..."
    sudo touch .env
fi

# Set proper permissions
echo "Setting permissions..."
sudo chmod 666 .env
sudo chown $(whoami):$(whoami) .env 2>/dev/null || sudo chown 1000:1000 .env

# Verify
echo ""
echo "Verification:"
ls -la .env
if command -v lsattr &> /dev/null; then
    lsattr .env
fi

echo ""
echo "✓ .env file is now writable!"
echo ""
echo "You can now run: ./update-portal.sh"
