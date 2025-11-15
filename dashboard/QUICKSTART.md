# Quick Start Guide

Get the Aruba Central Dashboard up and running in 5 minutes!

## Prerequisites

- Python 3.9+
- Node.js 18+
- Aruba Central API credentials

## 1. Configure Credentials

```bash
cd /path/to/project/Aruba-Central-Portal

# Copy environment template if needed
cp .env.example .env

# Edit with your credentials
nano .env
```

Add your credentials:
```env
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_client_id_here
ARUBA_CLIENT_SECRET=your_client_secret_here
ARUBA_CUSTOMER_ID=your_customer_id_here
```

## 2. Start Backend

```bash
cd /path/to/project/Aruba-Central-Portal/dashboard/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python app.py
```

Backend runs on: `http://localhost:1344`

## 3. Start Frontend

Open a new terminal:

```bash
cd /path/to/project/Aruba-Central-Portal/dashboard/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on: `http://localhost:3000`

## 4. Access Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

Click "Connect to Aruba Central" to log in.

## What's Next?

- Explore the **Dashboard** for network overview
- Browse **Devices** to see all network equipment
- Check **Configuration** for sites, groups, and templates
- View **Users** to manage access
- Try **API Explorer** to test endpoints

## Troubleshooting

### Backend won't start
```bash
# Check if credentials are set
cat /path/to/project/Aruba-Central-Portal/.env

# Verify Python version
python3 --version  # Should be 3.9+
```

### Frontend won't start
```bash
# Check Node version
node --version  # Should be 18+

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Can't connect to Aruba Central
- Verify credentials in `.env`
- Check that `ARUBA_BASE_URL` matches your region
- Ensure API credentials have proper permissions

## Production Deployment

See [README.md](README.md) for production deployment instructions.

## Support

- [Full Documentation](README.md)
- [Configuration Guide](CONFIGURATION_GUIDE.md)
- [Security Assessment](SECURITY_ASSESSMENT.md)
- [Aruba Central API Docs](https://developer.arubanetworks.com/aruba-central/docs)
