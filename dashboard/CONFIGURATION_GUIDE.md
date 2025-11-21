# Configuration Guide

This guide provides detailed information on configuring the Aruba Central Dashboard for different environments and use cases.

## Table of Contents

1. [Authentication Configuration](#authentication-configuration)
2. [Environment Variables](#environment-variables)
3. [Regional Endpoints](#regional-endpoints)
4. [Backend Configuration](#backend-configuration)
5. [Frontend Configuration](#frontend-configuration)
6. [Security Configuration](#security-configuration)
7. [Production Configuration](#production-configuration)

## Authentication Configuration

### OAuth 2.0 Client Credentials

The dashboard uses OAuth 2.0 with client credentials flow. You need to obtain API credentials from Aruba Central:

#### Step 1: Create API Gateway Credentials

1. Log in to Aruba Central UI
2. Navigate to **Maintain** → **Organization** → **Platform Integration** → **REST API Gateway**
3. Click **Add Credentials**
4. Fill in the details:
   - **Application Name**: e.g., "Dashboard Application"
   - **Client ID**: Will be auto-generated
   - **Client Secret**: Will be auto-generated
5. Save and copy the credentials

#### Step 2: Configure Permissions

Ensure your API credentials have the following permissions:
- **Monitoring**: Read access
- **Configuration**: Read access (Write if modifying configs)
- **Platform**: Read access for users and RBAC
- **Device Management**: Read access

### Authentication Flow

```
Frontend → Backend (Flask)
            ↓
        Generate OAuth Token
            ↓
        Store in Token Cache
            ↓
        Create Session
            ↓
        Return Session ID
            ↓
Frontend stores Session ID
            ↓
All API requests include Session ID
```

## Environment Variables

### Required Variables

Create a `.env` file in `/path/to/project/Aruba-Central-Portal/`:

```bash
# API Base URL (region-specific)
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com

# OAuth2 Credentials (Required)
ARUBA_CLIENT_ID=your_client_id_here
ARUBA_CLIENT_SECRET=your_client_secret_here
ARUBA_CUSTOMER_ID=your_customer_id_here
```

### Optional Variables

```bash
# For password grant type (alternative authentication)
ARUBA_USERNAME=your_username
ARUBA_PASSWORD=your_password

# Backend Configuration
FLASK_ENV=development  # or 'production'
FLASK_DEBUG=True       # Set to False in production
SESSION_TIMEOUT=3600   # Session timeout in seconds (default: 1 hour)

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:1344/api
```

### Variable Descriptions

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ARUBA_BASE_URL` | Aruba Central API endpoint for your region | Yes | - |
| `ARUBA_CLIENT_ID` | OAuth 2.0 client ID | Yes | - |
| `ARUBA_CLIENT_SECRET` | OAuth 2.0 client secret | Yes | - |
| `ARUBA_CUSTOMER_ID` | Your Aruba Central customer ID | Yes | - |
| `ARUBA_USERNAME` | Username for password grant | No | - |
| `ARUBA_PASSWORD` | Password for password grant | No | - |
| `FLASK_ENV` | Flask environment mode | No | `development` |
| `SESSION_TIMEOUT` | Session expiry time (seconds) | No | `3600` |

## Regional Endpoints

Aruba Central has different API endpoints for different regions. Use the correct `ARUBA_BASE_URL` for your region:

### Production Endpoints

| Region | Base URL |
|--------|----------|
| **US East** | `https://apigw-prod2.central.arubanetworks.com` |
| **US West** | `https://apigw-uswest4.central.arubanetworks.com` |
| **Europe (Germany)** | `https://apigw-eucentral3.central.arubanetworks.com` |
| **Asia Pacific (Singapore)** | `https://apigw-apeast1.central.arubanetworks.com` |
| **Canada** | `https://apigw-ca-toronto1.central.arubanetworks.com` |
| **China** | `https://apigw-apeast2.central.arubanetworks.com` |

### Determining Your Region

1. Log in to Aruba Central
2. Check the URL in your browser:
   - `app.central.arubanetworks.com` → US East
   - `app-uswest4.central.arubanetworks.com` → US West
   - `app-eucentral3.central.arubanetworks.com` → Europe
   - etc.

## Backend Configuration

### Flask Application Settings

Edit `dashboard/backend/app.py` to customize:

```python
# Session timeout (in seconds)
SESSION_TIMEOUT = 3600  # 1 hour

# CORS origins (for production)
CORS(app, origins=['https://your-domain.com'])

# Logging level
logging.basicConfig(level=logging.INFO)  # Change to logging.DEBUG for verbose logs
```

### Token Caching

The backend uses the existing token cache from `utils/token_cache.py`:

- **Cache file**: `.token_cache.json` in the project root
- **Expiry**: 2 hours with 5-minute buffer
- **Auto-refresh**: Automatic token refresh on expiry

**Important**: Never commit `.token_cache.json` to version control.

### Custom API Endpoints

To add custom API endpoints, edit `dashboard/backend/app.py`:

```python
@app.route('/api/custom-endpoint', methods=['GET'])
@require_session
def custom_endpoint():
    """Your custom endpoint."""
    try:
        response = aruba_client.get('/your/api/path')
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
```

## Frontend Configuration

### Vite Configuration

Edit `dashboard/frontend/vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:1344',  // Backend URL
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build',
    sourcemap: false,  // Set to true for debugging
  }
})
```

### Environment Variables

Create `dashboard/frontend/.env.local`:

```bash
# Backend API URL (development)
VITE_API_BASE_URL=http://localhost:1344/api
```

For production:

```bash
# Backend API URL (production)
VITE_API_BASE_URL=https://your-domain.com/api
```

### Theme Customization

Edit `dashboard/frontend/src/App.jsx` to customize the theme:

```javascript
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#01a982',  // HPE Aruba green
    },
    secondary: {
      main: '#ff6c00',  // Aruba orange
    },
    background: {
      default: '#0a0e27',
      paper: '#151b3d',
    },
  },
  // ... other theme settings
});
```

## Security Configuration

### Content Security Policy

The CSP is configured in `dashboard/frontend/index.html`:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               font-src 'self' data:;
               connect-src 'self' http://localhost:1344;" />
```

For production, update to:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self';
               img-src 'self' data: https:;
               font-src 'self';
               connect-src 'self' https://your-domain.com;" />
```

### CORS Configuration

Backend CORS settings in `dashboard/backend/app.py`:

```python
# Development
CORS(app, origins=['http://localhost:3000', 'http://localhost:1344'])

# Production
CORS(app, origins=['https://your-domain.com'])
```

### Session Security

Configure session security in `dashboard/backend/app.py`:

```python
# Session timeout
SESSION_TIMEOUT = 3600  # 1 hour

# For production, use secure session storage
# Consider Redis or database-backed sessions
```

## Production Configuration

### Environment Setup

1. **Use Production Environment Variables**

```bash
# .env.production
FLASK_ENV=production
FLASK_DEBUG=False
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=production_client_id
ARUBA_CLIENT_SECRET=production_client_secret
ARUBA_CUSTOMER_ID=production_customer_id
```

2. **Build Frontend**

```bash
cd dashboard/frontend
npm run build
```

3. **Use Production Server**

```bash
cd dashboard/backend
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Gunicorn Configuration

Create `dashboard/backend/gunicorn.conf.py`:

```python
import multiprocessing

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
errorlog = "/var/log/gunicorn/error.log"
accesslog = "/var/log/gunicorn/access.log"
loglevel = "info"

# Process naming
proc_name = "aruba-dashboard"
```

Run with:

```bash
gunicorn -c gunicorn.conf.py app:app
```

### Systemd Service

Create `/etc/systemd/system/aruba-dashboard.service`:

```ini
[Unit]
Description=Aruba Central Dashboard
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/path/to/project/Aruba-Central-Portal/dashboard/backend
Environment="PATH=/path/to/project/Aruba-Central-Portal/dashboard/backend/venv/bin"
ExecStart=/path/to/project/Aruba-Central-Portal/dashboard/backend/venv/bin/gunicorn -c gunicorn.conf.py app:app
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable aruba-dashboard
sudo systemctl start aruba-dashboard
sudo systemctl status aruba-dashboard
```

### HTTPS with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured by default
```

### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Other security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        root /path/to/project/Aruba-Central-Portal/dashboard/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Backend Logging

Configure in `dashboard/backend/app.py`:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/aruba-dashboard/app.log'),
        logging.StreamHandler()
    ]
)
```

### Application Monitoring

Consider integrating:
- **Sentry**: For error tracking
- **Prometheus**: For metrics
- **Grafana**: For visualization
- **ELK Stack**: For log aggregation

## Backup and Recovery

### Configuration Backup

```bash
# Backup .env file
cp /path/to/project/Aruba-Central-Portal/.env /backup/location/.env.backup

# Backup token cache (if needed)
cp /path/to/project/Aruba-Central-Portal/.token_cache.json /backup/location/
```

### Recovery Procedure

1. Restore `.env` file
2. Reinstall dependencies
3. Rebuild frontend
4. Restart services

---

For additional support, refer to the main [README.md](README.md) or [Aruba Central API Documentation](https://developer.arubanetworks.com/aruba-central/docs).
