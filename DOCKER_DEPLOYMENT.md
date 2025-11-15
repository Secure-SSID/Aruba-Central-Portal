# Docker Deployment Guide for Ugreen NAS

This guide provides instructions for deploying the Aruba Central Portal on your Ugreen NAS using Docker.

> **⚠️ Important:** Use the Setup Wizard!
> After starting the container, configure credentials through the web interface at `http://your-ip:1344`
> **Do NOT manually edit `.env` files** - the Setup Wizard handles everything automatically!

## Quick Start

### 1. Prerequisites

- Docker installed on your Ugreen NAS
- Docker Compose installed (usually comes with Docker)
- Aruba Central API credentials ([Get them here](#getting-Aruba-Central-Portal-credentials))

### 2. Deploy Container

No configuration needed - credentials are configured through the web interface!

### 3. Deploy with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 4. Configure Credentials via Setup Wizard

Open your web browser and navigate to:
```
http://<your-nas-ip>:1344
```

The Setup Wizard will guide you through:
1. Entering your Aruba Central API credentials
2. Selecting your region
3. Testing the connection
4. Saving credentials automatically

**That's it!** No manual `.env` editing required.

## Manual Docker Build

If you prefer to build and run the container manually:

```bash
# Build the image
docker build -t aruba-central-portal:latest .

# Run the container
docker run -d \
  --name aruba-central-portal \
  --restart unless-stopped \
  -p 1344:1344 \
  -v aruba-token-cache:/app/data \
  -v $(pwd)/.env:/app/.env:rw \
  aruba-central-portal:latest

# View logs
docker logs -f aruba-central-portal

# Configure via web interface at http://your-ip:1344
```

## Environment Variables Reference

> **Note:** These variables are set automatically by the Setup Wizard.
> This section is for reference only - you don't need to manually configure these!

### Automatically Configured via Setup Wizard

| Variable | Description | Example |
|----------|-------------|---------|
| `ARUBA_BASE_URL` | Aruba Central API endpoint URL for your region | `https://apigw-prod2.central.arubanetworks.com` |
| `ARUBA_CLIENT_ID` | OAuth2 Client ID from Aruba Central | `abc123...` |
| `ARUBA_CLIENT_SECRET` | OAuth2 Client Secret from Aruba Central | `xyz789...` |
| `ARUBA_CUSTOMER_ID` | Your Aruba Central Customer/Tenant ID | `cust123...` |

### Optional (Advanced Users Only)

| Variable | Description | Default |
|----------|-------------|---------|
| `PUID` | User ID for container process | `0` (root) |
| `PGID` | Group ID for container process | `0` (root) |
| `LOG_LEVEL` | Logging verbosity (DEBUG/INFO/WARNING/ERROR) | `INFO` |
| `FLASK_ENV` | Flask environment mode | `production` |

## Getting Aruba Central API Credentials

1. Log in to [Aruba Central](https://central.arubanetworks.com)
2. Navigate to **Account Home** → **System Apps & Tokens**
3. Click **Generate App Credentials**
4. Select the required API permissions:
   - Read permissions for monitoring
   - Write permissions if you need configuration changes
5. Copy the generated:
   - Client ID
   - Client Secret
   - Customer ID

## Volume Mounts

The container uses a named volume to persist the token cache:

- **token-cache** (`/app/data`): Stores OAuth2 access tokens to avoid rate limiting
  - Tokens are valid for 2 hours
  - Aruba Central limits: 1 new token per 30 minutes
  - The cache prevents unnecessary token refreshes

## Port Configuration

- **1344**: Web interface and API endpoints (HTTP)

To change the external port, modify the `docker-compose.yml`:

```yaml
ports:
  - "8080:1344"  # Access on port 8080 instead
```

## Ugreen NAS Specific Instructions

### Using Ugreen Container Manager

1. **Upload Image** (if building locally):
   ```bash
   docker save aruba-central-portal:latest | gzip > aruba-central-portal.tar.gz
   ```
   Upload via Ugreen NAS web interface

2. **Create Container**:
   - Image: `aruba-central-portal:latest`
   - Port Mapping: `1344:1344`
   - Add environment variables from the table above
   - Add volume: `token-cache` → `/app/data`
   - Auto-restart: Yes

3. **Alternative: Docker Compose**:
   - Upload the project folder to your NAS
   - SSH into your NAS
   - Navigate to the project directory
   - Run: `docker-compose up -d`

## Monitoring and Maintenance

### View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service logs
docker logs aruba-central-portal
```

### Restart Container

```bash
# Using docker-compose
docker-compose restart

# Using docker directly
docker restart aruba-central-portal
```

### Update Container

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Or rebuild manually
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Check Health Status

```bash
# Health check endpoint
curl http://localhost:1344/api/health

# Container health status
docker inspect --format='{{.State.Health.Status}}' aruba-central-portal
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker-compose logs

# Verify environment variables
docker-compose config

# Check if port is already in use
netstat -tulpn | grep 1344
```

### Authentication Errors (401)

1. Access the Setup Wizard at `http://your-ip:1344`
2. Verify credentials are correct
3. Ensure credentials are valid in Aruba Central portal
4. Check token expiry: tokens are valid for 2 hours
5. Rate limit: Only 1 new token per 30 minutes allowed

### Connection Refused

- Verify `ARUBA_BASE_URL` matches your Aruba Central region
- Check network connectivity from NAS to Aruba Central
- Verify firewall rules allow outbound HTTPS (443)

### Performance Issues

```bash
# Increase worker processes (edit docker-compose.yml)
# Modify CMD in Dockerfile:
CMD ["gunicorn", "--bind", "0.0.0.0:1344", "--workers", "8", ...]

# Rebuild container
docker-compose up -d --build
```

### Clear Token Cache

```bash
# Remove volume to clear cached tokens
docker-compose down
docker volume rm aruba-central-portal_token-cache
docker-compose up -d
```

## Security Considerations

1. **Never expose your `.env` file publicly**
2. **Use strong, unique API credentials**
3. **Rotate API credentials regularly**
4. **Restrict network access** - Use firewall rules to limit who can access port 1344
5. **Use HTTPS in production** - Set up a reverse proxy (nginx, Traefik) with SSL/TLS
6. **Monitor access logs** - Review who is accessing your dashboard

### Adding HTTPS with Reverse Proxy

For production use, add HTTPS using a reverse proxy:

```yaml
# Example nginx configuration
server {
    listen 443 ssl http2;
    server_name aruba.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:1344;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Resource Requirements

**Minimum:**
- CPU: 1 core
- RAM: 512 MB
- Disk: 1 GB

**Recommended:**
- CPU: 2 cores
- RAM: 1 GB
- Disk: 2 GB

## Backup and Restore

### Backup Token Cache

```bash
docker run --rm -v aruba-central-portal_token-cache:/data -v $(pwd):/backup \
  alpine tar czf /backup/token-cache-backup.tar.gz -C /data .
```

### Restore Token Cache

```bash
docker run --rm -v aruba-central-portal_token-cache:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/token-cache-backup.tar.gz"
```

## Support

- **Documentation**: See `README.md` for feature documentation
- **Configuration**: See `CONFIGURATION_GUIDE.md` for detailed setup
- **Security**: See `SECURITY_ASSESSMENT.md` for security best practices
- **API Reference**: [Aruba Central API Docs](https://developer.arubanetworks.com/aruba-central/docs)

## Uninstallation

```bash
# Stop and remove container
docker-compose down

# Remove volumes (WARNING: This deletes the token cache)
docker-compose down -v

# Remove image
docker rmi aruba-central-portal:latest
```
