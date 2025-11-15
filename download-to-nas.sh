#!/bin/bash
# Download Aruba Central Portal to Ugreen NAS without git
# Run this on your NAS via SSH

set -e

BRANCH="main"
REPO_URL="https://github.com/secure-ssid/aruba-central-portal"
ZIP_URL="${REPO_URL}/archive/refs/heads/${BRANCH}.zip"
TEMP_DIR="/tmp/aruba-portal-download"
INSTALL_DIR="/volume1/docker/central-portal"

echo "================================================"
echo "Aruba Central Portal - Download & Setup"
echo "================================================"
echo ""

# Check if curl or wget is available
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -L -o"
    echo "Using curl for download..."
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -O"
    echo "Using wget for download..."
else
    echo "ERROR: Neither curl nor wget found!"
    echo "Please install one of them or use manual upload method."
    echo "See UGREEN_NAS_SETUP.md for manual upload instructions."
    exit 1
fi

# Check if unzip is available
if ! command -v unzip &> /dev/null; then
    echo "ERROR: unzip command not found!"
    echo "Please install unzip or use manual upload method."
    echo ""
    echo "To install unzip:"
    echo "  opkg update"
    echo "  opkg install unzip"
    exit 1
fi

# Create temp directory
echo "Creating temporary directory..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download the repository
echo ""
echo "Downloading repository from GitHub..."
echo "URL: $ZIP_URL"
echo ""

if [[ $DOWNLOAD_CMD == curl* ]]; then
    curl -L -o repo.zip "$ZIP_URL"
else
    wget -O repo.zip "$ZIP_URL"
fi

if [ ! -f "repo.zip" ]; then
    echo "ERROR: Download failed!"
    exit 1
fi

echo ""
echo "Download complete! Extracting files..."

# Extract the archive (overwrite without prompting)
unzip -o -q repo.zip

# Find the extracted directory (it will have the branch name)
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "Aruba-Central-Portal-*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERROR: Could not find extracted directory!"
    exit 1
fi

# Create installation directory if it doesn't exist
echo ""
echo "Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Copy files to installation directory
echo "Copying files to $INSTALL_DIR..."
cp -r "$EXTRACTED_DIR"/* "$INSTALL_DIR/"

# Create empty .env file
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo ""
    echo "Creating .env file..."
    touch "$INSTALL_DIR/.env"
    chmod 666 "$INSTALL_DIR/.env"
fi

# Clean up
echo ""
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

# Make scripts executable
chmod +x "$INSTALL_DIR/deploy-check.sh" 2>/dev/null || true

echo ""
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Deploy the container:"
echo "   cd $INSTALL_DIR"
echo "   docker-compose up -d"
echo ""
echo "2. Access the dashboard:"
echo "   http://your-nas-ip:1344"
echo ""
echo "3. Complete Setup Wizard:"
echo "   - Open the URL above in your browser"
echo "   - Follow the Setup Wizard to enter your credentials"
echo "   - Credentials are saved automatically - no manual editing needed!"
echo ""
echo "   You'll need:"
echo "   - ARUBA_BASE_URL (your region)"
echo "   - ARUBA_CLIENT_ID"
echo "   - ARUBA_CLIENT_SECRET"
echo "   - ARUBA_CUSTOMER_ID"
echo ""
echo "================================================"
