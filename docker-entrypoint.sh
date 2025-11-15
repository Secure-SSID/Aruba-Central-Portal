#!/bin/bash
set -e

echo "Starting Aruba Central Portal..."
echo "Current directory: $(pwd)"
echo "Contents of /app:"
ls -la /app/

if [ -d "/app/dashboard/backend" ]; then
    echo "✓ Backend directory exists"
    cd /app/dashboard/backend
    echo "Changed to: $(pwd)"
    exec gunicorn --bind 0.0.0.0:1344 --workers 1 --timeout 120 --access-logfile - --error-logfile - app:app
else
    echo "✗ ERROR: /app/dashboard/backend does not exist!"
    echo "Contents of /app/dashboard:"
    ls -la /app/dashboard/ || echo "dashboard directory missing"
    exit 1
fi
