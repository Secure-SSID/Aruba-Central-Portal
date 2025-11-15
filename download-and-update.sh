#!/bin/bash
# Quick download and run update script
# This can be run with: curl -fsSL <url> | bash

set -e

echo "Downloading update script..."
curl -fsSL https://raw.githubusercontent.com/secure-ssid/aruba-central-portal/claude/docker-ugreen-nas-deploy-011CUrwKSNuHNBdGyNqj1jNc/update-portal.sh -o /tmp/update-portal.sh

chmod +x /tmp/update-portal.sh

echo "Running update script..."
/tmp/update-portal.sh

rm /tmp/update-portal.sh
