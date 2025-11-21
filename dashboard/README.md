# Aruba Central Dashboard

An interactive web dashboard for HPE Aruba Networking Central Configuration APIs. This application provides a modern, secure, and user-friendly interface to manage and monitor your Aruba Central network infrastructure.

![Dashboard Version](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.9+-green)
![Node](https://img.shields.io/badge/node-18+-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### Core Functionality
- **Real-time Network Monitoring**: View device statistics, network health, and status
- **Device Management**: Browse and manage all network devices (switches, access points, etc.)
- **Configuration Management**: View and manage sites, groups, and templates
- **User Management**: View user accounts, roles, and permissions
- **API Explorer**: Interactive tool to test and explore API endpoints
- **Secure Authentication**: Backend-managed OAuth 2.0 flow with session management

### Security Features
- **Backend API Proxy**: Credentials never exposed to frontend
- **Session-based Authentication**: Secure token management
- **Input Validation**: Sanitized inputs on both frontend and backend
- **Content Security Policy**: Configured CSP headers
- **Rate Limiting Ready**: Architecture supports rate limiting implementation
- **HTTPS Support**: Production-ready with TLS configuration

### User Experience
- **Modern Dark Theme**: Professional HPE Aruba-branded interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Auto-refresh capability for monitoring
- **Interactive Tables**: Searchable, sortable device and user lists
- **Syntax Highlighting**: JSON response formatting in API Explorer
- **Error Handling**: User-friendly error messages and alerts

## Architecture

### Technology Stack

**Backend:**
- Flask (Python web framework)
- Flask-CORS (Cross-Origin Resource Sharing)
- Requests (HTTP library)
- Existing Aruba Central API client (utils/)

**Frontend:**
- React 18
- Material-UI (MUI) for components
- Axios for HTTP requests
- React Router for navigation
- Recharts for data visualization
- Vite for build tooling

**Authentication:**
- OAuth 2.0 with client_id/client_secret
- Session-based token management
- Automatic token refresh

### Project Structure

```
dashboard/
├── backend/
│   ├── app.py                 # Flask application (API proxy)
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopBar.jsx
│   │   ├── pages/            # Page components
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DevicesPage.jsx
│   │   │   ├── ConfigurationPage.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   └── APIExplorerPage.jsx
│   │   ├── services/         # API service layer
│   │   │   └── api.js
│   │   ├── styles/           # CSS styles
│   │   │   └── index.css
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx          # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## Installation & Setup

### Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher
- npm or yarn
- Aruba Central API credentials (client_id, client_secret, customer_id)

### Step 1: Configure Backend Credentials

The dashboard uses the existing Aruba Central API configuration. Make sure your credentials are configured in the parent directory:

```bash
cd /path/to/Aruba-Central-Portal

# If .env doesn't exist, copy from example
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Configure the following variables in `.env`:

```env
# Required
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_client_id_here
ARUBA_CLIENT_SECRET=your_client_secret_here
ARUBA_CUSTOMER_ID=your_customer_id_here

# Optional (for password grant authentication)
ARUBA_USERNAME=your_username
ARUBA_PASSWORD=your_password
```

**Important Security Notes:**
- Never commit `.env` to version control
- Keep `client_secret` confidential
- Use environment-specific credentials for development/production
- Rotate credentials regularly

### Step 2: Install Backend Dependencies

```bash
cd /path/to/Aruba-Central-Portal/dashboard/backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Install Frontend Dependencies

```bash
cd /path/to/Aruba-Central-Portal/dashboard/frontend

# Install npm packages
npm install
```

### Step 4: Run the Application

You need to run both backend and frontend servers.

**Terminal 1 - Backend Server:**

```bash
cd /path/to/Aruba-Central-Portal/dashboard/backend
source venv/bin/activate  # If using virtual environment
python app.py
```

Backend will start on `http://localhost:1344`

**Terminal 2 - Frontend Development Server:**

```bash
cd /path/to/Aruba-Central-Portal/dashboard/frontend
npm run dev
```

Frontend will start on `http://localhost:3000`

### Step 5: Access the Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

Click "Connect to Aruba Central" to authenticate and access the dashboard.

## Usage Guide

### Dashboard Overview
- View real-time statistics for devices, switches, access points, and users
- Monitor network health and system status
- Auto-refreshes every 30 seconds

### Device Management
- Browse all network devices with filtering
- View devices by category (All, Switches, Access Points)
- Search by name, serial number, model, or MAC address
- View device status and IP addresses

### Configuration Management
- View and manage sites
- Browse configuration groups
- List configuration templates
- Filter by type and search

### User Management
- View all user accounts
- Search by name, username, or email
- See user roles and application access
- Monitor user status

### API Explorer
- Test any Aruba Central API endpoint
- Support for GET, POST, PUT, DELETE methods
- JSON syntax highlighting for responses
- Quick access to common endpoints
- Add query parameters and request body

## Production Deployment

### Build for Production

```bash
# Build frontend
cd /path/to/Aruba-Central-Portal/dashboard/frontend
npm run build

# This creates a 'build' directory with optimized static files
```

### Run Production Server

For production, use Gunicorn instead of Flask's development server:

```bash
cd /path/to/Aruba-Central-Portal/dashboard/backend

# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Nginx Configuration (Recommended)

Example Nginx configuration for reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend static files
    location / {
        root /path/to/Aruba-Central-Portal/dashboard/frontend/build;
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

### Environment Variables for Production

Create a production `.env` file:

```env
FLASK_ENV=production
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_production_client_id
ARUBA_CLIENT_SECRET=your_production_client_secret
ARUBA_CUSTOMER_ID=your_production_customer_id
```

## Security Considerations

### Implemented Security Measures

1. **Credential Protection**
   - Credentials stored in environment variables
   - Never exposed to frontend code
   - Backend acts as secure proxy

2. **Authentication**
   - Session-based authentication with timeout
   - Automatic session expiry (1 hour)
   - Secure session ID generation

3. **API Security**
   - All API requests authenticated
   - Session validation on every request
   - Request/response validation

4. **Frontend Security**
   - Content Security Policy headers
   - Input sanitization
   - XSS protection via React
   - No inline scripts

5. **Network Security**
   - CORS properly configured
   - HTTPS recommended for production
   - Secure headers

### Security Best Practices

1. **Use HTTPS in Production**: Always deploy with TLS/SSL
2. **Rotate Credentials**: Regularly update API credentials
3. **Monitor Access**: Log all API requests and authentication attempts
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Firewall**: Restrict backend access to trusted IPs only
6. **Updates**: Keep dependencies updated for security patches
7. **Secrets Management**: Use proper secrets management (e.g., AWS Secrets Manager, HashiCorp Vault)

### Recommended Security Enhancements

For production deployments, consider:

- **Database-backed sessions**: Replace in-memory sessions with Redis or database
- **Rate limiting**: Use Flask-Limiter to prevent abuse
- **Audit logging**: Log all configuration changes
- **2FA**: Implement two-factor authentication
- **IP whitelisting**: Restrict access to known IPs
- **WAF**: Deploy behind Web Application Firewall
- **Security headers**: Add additional security headers (HSTS, X-Frame-Options, etc.)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Create session
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/status` - Check authentication status

### Devices
- `GET /api/devices` - Get all devices
- `GET /api/devices/<serial>` - Get device by serial
- `GET /api/switches` - Get all switches
- `GET /api/aps` - Get all access points

### Configuration
- `GET /api/sites` - Get all sites
- `GET /api/groups` - Get configuration groups
- `GET /api/templates` - Get configuration templates

### Users
- `GET /api/users` - Get all users

### Monitoring
- `GET /api/monitoring/network-health` - Get network health metrics

### Explorer
- `POST /api/explore` - Execute custom API request

### System
- `GET /api/health` - Health check

## Troubleshooting

### Backend Won't Start

**Issue**: "Missing required configuration"
```bash
# Solution: Check your .env file has all required variables
cat /path/to/Aruba-Central-Portal/.env
```

**Issue**: "Module not found"
```bash
# Solution: Install dependencies
pip install -r requirements.txt
```

### Frontend Won't Start

**Issue**: "Cannot find module"
```bash
# Solution: Install dependencies
npm install
```

**Issue**: "Port 3000 already in use"
```bash
# Solution: Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Authentication Issues

**Issue**: "Invalid or expired session"
- Session timeout is 1 hour
- Click "Connect to Aruba Central" to re-authenticate

**Issue**: "Server configuration error"
- Verify backend credentials in `.env`
- Check that client_id, client_secret, and customer_id are correct
- Ensure base_url matches your region

### API Errors

**Issue**: "Failed to fetch devices"
- Check Aruba Central API permissions
- Verify network connectivity
- Check backend logs for details

**Issue**: "Rate limit exceeded"
- Aruba Central has API rate limits
- Token generation limited to 1 per 30 minutes
- Wait before retrying

### Connection Issues

**Issue**: "Network error"
```bash
# Check if backend is running
curl http://localhost:1344/api/health

# Check if frontend can reach backend
# In browser console:
fetch('http://localhost:1344/api/health').then(r => r.json()).then(console.log)
```

## Development

### Running Tests

Backend tests:
```bash
cd /path/to/Aruba-Central-Portal
pytest dashboard/backend/
```

### Code Formatting

Backend:
```bash
black dashboard/backend/
ruff check dashboard/backend/
```

Frontend:
```bash
cd dashboard/frontend
npm run lint
```

### Adding New Features

1. **Backend**: Add endpoints in `backend/app.py`
2. **API Service**: Add functions in `frontend/src/services/api.js`
3. **UI Component**: Create component in `frontend/src/components/` or page in `frontend/src/pages/`
4. **Routing**: Update routes in `frontend/src/App.jsx`

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Ensure security best practices

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Support

For issues related to:
- **Dashboard**: Open an issue in this repository
- **Aruba Central API**: Refer to [Aruba Central API Documentation](https://developer.arubanetworks.com/aruba-central/docs)
- **HPE Support**: Contact HPE Aruba Networking support

## Acknowledgments

- Built with HPE Aruba Networking Central APIs
- Powered by Flask and React
- UI components from Material-UI

---

**Version**: 2.0.0
**Last Updated**: November 2025
