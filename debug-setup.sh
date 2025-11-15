#!/bin/bash
# Debug script to check Setup Wizard issues

echo "========================================"
echo "  Setup Wizard Debug Helper"
echo "========================================"
echo ""

cd /volume1/docker/central-portal 2>/dev/null || cd "$(dirname "$0")"

echo "1. Checking .env file permissions..."
ls -la .env
if command -v lsattr &> /dev/null; then
    lsattr .env
fi
echo ""

echo "2. Checking .env file content..."
echo "--- Content ---"
cat .env 2>/dev/null || echo "(empty or cannot read)"
echo "--- End ---"
echo ""

echo "3. Checking container status..."
docker compose ps
echo ""

echo "4. Checking recent container logs (last 50 lines)..."
echo "--- Logs ---"
docker compose logs --tail=50 aruba-central-portal 2>&1 | grep -A 3 -B 3 -i "setup\|configure\|error\|traceback" || docker compose logs --tail=50 aruba-central-portal
echo "--- End ---"
echo ""

echo "5. Testing .env write permissions from inside container..."
docker compose exec aruba-central-portal sh -c 'echo "# Test write" >> /app/.env && echo "✓ Can write to .env" || echo "✗ Cannot write to .env"' 2>&1
echo ""

echo "6. Checking if updated app.py is loaded..."
docker compose exec aruba-central-portal grep -n "load_dotenv(env_path, override=True)" /app/dashboard/backend/app.py 2>&1 | head -5 || echo "✗ Updated code not found in container"
echo ""

echo "7. Checking backend health..."
curl -s http://localhost:1344/api/health 2>&1 || echo "Cannot reach backend"
echo ""

echo "8. Testing setup endpoint..."
curl -s -X POST http://localhost:1344/api/setup/configure \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test123","client_secret":"test456","customer_id":"test789","base_url":"https://internal.api.central.arubanetworks.com"}' 2>&1
echo ""
echo ""

echo "========================================"
echo "To view full logs: docker compose logs -f"
echo "To restart: docker compose restart"
echo "To check browser errors: F12 → Console tab"
echo "========================================"
