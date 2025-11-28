# Configuration Guide

This document provides detailed information about configuring the Aruba Central API automation framework.

## Configuration Overview

The framework uses a two-tier configuration system:

1. **config.yaml** - Base configuration file for application settings
2. **Environment variables** - Override config.yaml values (takes precedence)

Environment variables always take precedence over config.yaml settings, making it easy to adjust configuration for different environments without modifying files.

## Environment Variables

### Required Variables

These variables are **required** for the application to function:

| Variable | Description | Example |
|----------|-------------|---------|
| `ARUBA_CLIENT_ID` | OAuth2 client ID from Aruba Central | `abc123def456` |
| `ARUBA_CLIENT_SECRET` | OAuth2 client secret from Aruba Central | `xyz789uvw012` |
| `ARUBA_CUSTOMER_ID` | Your Aruba Central customer ID | `customer123` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ARUBA_BASE_URL` | API base URL for your region | `https://apigw-prod2.central.arubanetworks.com` |
| `ARUBA_ACCESS_TOKEN` | Pre-existing access token (bypasses OAuth2) | None |
| `ARUBA_USERNAME` | Username for password grant OAuth2 flow | None |
| `ARUBA_PASSWORD` | Password for password grant OAuth2 flow | None |

### Setting Up Environment Variables

#### Method 1: .env File (Recommended)

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:
```bash
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_client_id_here
ARUBA_CLIENT_SECRET=your_client_secret_here
ARUBA_CUSTOMER_ID=your_customer_id_here
```

3. The `.env` file is automatically loaded by the application

**Security Note**: Never commit `.env` to version control. It's already in `.gitignore`.

#### Method 2: System Environment Variables

Set environment variables in your shell:

```bash
# Linux/macOS
export ARUBA_CLIENT_ID="your_client_id"
export ARUBA_CLIENT_SECRET="your_client_secret"
export ARUBA_CUSTOMER_ID="your_customer_id"

# Windows (Command Prompt)
set ARUBA_CLIENT_ID=your_client_id
set ARUBA_CLIENT_SECRET=your_client_secret
set ARUBA_CUSTOMER_ID=your_customer_id

# Windows (PowerShell)
$env:ARUBA_CLIENT_ID="your_client_id"
$env:ARUBA_CLIENT_SECRET="your_client_secret"
$env:ARUBA_CUSTOMER_ID="your_customer_id"
```

## Regional API Endpoints

Choose the appropriate `ARUBA_BASE_URL` based on your Aruba Central cluster region:

| Region | Base URL |
|--------|----------|
| **US East** | `https://apigw-prod2.central.arubanetworks.com` |
| **US West** | `https://apigw-uswest4.central.arubanetworks.com` |
| **Europe** | `https://apigw-eucentral3.central.arubanetworks.com` |
| **APAC** | `https://apigw-apeast1.central.arubanetworks.com` |

**Important**: Using the wrong region endpoint will result in authentication failures. Verify your region in the Aruba Central portal.

## config.yaml Structure

The `config.yaml` file provides default settings that can be overridden by environment variables.

### Example config.yaml

```yaml
# Aruba Central API Configuration
aruba_central:
  base_url: "https://apigw-prod2.central.arubanetworks.com"
  # client_id, client_secret, customer_id should be set in .env

# Logging configuration
logging:
  level: "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Script-specific settings
scripts:
  device_inventory:
    export_format: "json"  # json, csv, xlsx
    include_offline: true

  monitoring:
    check_interval: 300  # seconds
    alert_threshold: 90  # percentage
```

### Configuration Hierarchy

Settings are loaded in this order (later overrides earlier):

1. Default values in code
2. `config.yaml` file
3. Environment variables (highest priority)

Example:
- If `config.yaml` has `base_url: "https://example.com"`
- And `.env` has `ARUBA_BASE_URL=https://production.com`
- The application will use `https://production.com`

## Authentication Methods

The framework supports two OAuth2 authentication flows:

### 1. Client Credentials Flow (Recommended)

Best for service-to-service authentication. Requires:
- `ARUBA_CLIENT_ID`
- `ARUBA_CLIENT_SECRET`
- `ARUBA_CUSTOMER_ID`

```python
from utils import CentralAPIClient, TokenManager, load_config

config = load_config()
aruba_config = config["aruba_central"]

token_manager = TokenManager(
    client_id=aruba_config["client_id"],
    client_secret=aruba_config["client_secret"],
)
client = CentralAPIClient(
    base_url=aruba_config["base_url"],
    token_manager=token_manager,
)
# Authentication happens automatically via TokenManager
response = client.get("/monitoring/v1/devices")
```

### 2. Password Grant Flow

For user-based authentication. Requires:
- `ARUBA_CLIENT_ID`
- `ARUBA_CLIENT_SECRET`
- `ARUBA_CUSTOMER_ID`
- `ARUBA_USERNAME`
- `ARUBA_PASSWORD`

The client automatically detects which flow to use based on provided credentials.

### 3. Pre-existing Access Token

If you already have a valid access token:

```bash
ARUBA_ACCESS_TOKEN=your_existing_token
```

This bypasses OAuth2 authentication entirely.

## Token Caching

### Important: Rate Limiting

**Aruba Central enforces strict rate limits: 1 new access token per 30 minutes.**

To prevent hitting rate limits, the framework implements automatic token caching:

### How Token Caching Works

1. **First Authentication**: Requests new token, saves to `.token_cache.json`
2. **Subsequent Requests**: Loads cached token automatically
3. **Token Expiry**: Cached tokens are valid for 2 hours (7200 seconds)
4. **Auto-refresh**: Automatically requests new token when cache expires
5. **Safety Buffer**: 5-minute buffer prevents expiry during long operations

### Token Cache File

Location: `.token_cache.json` (in project root)

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_at": 1699564800.123,
  "token_type": "Bearer"
}
```

**Security Note**: `.token_cache.json` is in `.gitignore`. Keep it secure as it contains valid access tokens.

### Best Practices

**Let TokenManager handle authentication automatically:**

```python
# ✅ CORRECT - TokenManager handles token refresh automatically
token_manager = TokenManager(client_id=..., client_secret=...)
client = CentralAPIClient(base_url=..., token_manager=token_manager)
response = client.get("/monitoring/v1/devices")  # Token injected automatically
```

### Troubleshooting Token Issues

If you encounter authentication errors:

1. **Check token cache**:
```bash
cat .token_cache.json
```

2. **Delete corrupted cache**:
```bash
rm .token_cache.json
```

3. **Verify credentials** in `.env`

4. **Check rate limiting**: Wait 30 minutes if you've recently generated multiple tokens

## Obtaining API Credentials

### Step 1: Access Aruba Central

1. Log in to [Aruba Central](https://central.arubanetworks.com)
2. Navigate to **Account Home** → **Platform Integration** → **API Gateway**

### Step 2: Create API Client

1. Click **System Apps & Tokens**
2. Click **Add Apps & Tokens**
3. Select **System App** (for service accounts)
4. Configure:
   - **App Name**: Descriptive name (e.g., "Automation Framework")
   - **App Type**: System
   - **Scope**: Select required permissions (e.g., "Network operations", "Monitoring")

### Step 3: Retrieve Credentials

After creation, Aruba Central displays:
- **Client ID**: Copy to `ARUBA_CLIENT_ID`
- **Client Secret**: Copy to `ARUBA_CLIENT_SECRET` (shown only once!)
- **Customer ID**: Found in **Account Home**

**Important**: Client secrets are shown only once. Store securely.

### Recommended API Scopes

For full framework functionality, enable these scopes:
- ✅ Network Operations (all)
- ✅ Monitoring (read)
- ✅ Configuration Management (all)
- ✅ Device Management (all)

Use least-privilege principle: only enable scopes your scripts require.

## Security Best Practices

### Credential Storage

1. **Never commit credentials** to version control
2. **Use environment variables** or `.env` file
3. **Rotate credentials regularly** (every 90 days recommended)
4. **Use separate credentials** for development, staging, and production
5. **Audit API usage** regularly in Aruba Central portal

### File Permissions

Ensure sensitive files have restricted permissions:

```bash
chmod 600 .env
chmod 600 .token_cache.json
```

### Access Control

- **Create dedicated service accounts** for automation (don't use personal accounts)
- **Enable IP allowlisting** in Aruba Central if possible
- **Monitor API logs** for suspicious activity
- **Set up alerts** for failed authentication attempts

## Validation

### Verify Configuration

Run this command to validate your configuration:

```python
from utils import load_config
config = load_config()
print(config)
```

### Test Authentication

```python
from utils import CentralAPIClient, TokenManager, load_config

config = load_config()
aruba_config = config["aruba_central"]

token_manager = TokenManager(
    client_id=aruba_config["client_id"],
    client_secret=aruba_config["client_secret"],
)
client = CentralAPIClient(
    base_url=aruba_config["base_url"],
    token_manager=token_manager,
)

# Test API call
try:
    response = client.get("/network-monitoring/v1alpha1/devices")
    print("Authentication successful!")
    print(f"Devices found: {response.get('count', 0)}")
except Exception as e:
    print(f"Authentication failed: {e}")
```

## Common Issues

### Error: "401 Unauthorized"

**Causes:**
- Invalid credentials
- Expired token (shouldn't happen with caching)
- Wrong region endpoint
- Insufficient API scopes

**Solutions:**
1. Verify credentials in `.env`
2. Delete `.token_cache.json` and retry
3. Check `ARUBA_BASE_URL` matches your region
4. Verify API scopes in Aruba Central portal

### Error: "429 Too Many Requests"

**Cause:** Rate limiting (1 token per 30 minutes exceeded)

**Solution:**
1. Wait 30 minutes before retrying
2. Ensure you're not calling `authenticate()` explicitly
3. Verify token caching is working

### Error: "Module not found"

**Cause:** Virtual environment not activated or dependencies not installed

**Solution:**
```bash
source venv/bin/activate  # Activate venv
pip install -r requirements.txt  # Install dependencies
```

### Configuration Not Loading

**Cause:** `.env` file not found or python-dotenv not installed

**Solution:**
```bash
# Ensure .env exists
ls -la .env

# Reinstall python-dotenv
pip install python-dotenv
```

## Environment-Specific Configuration

### Development Environment

Create `.env.development`:
```bash
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=dev_client_id
ARUBA_CLIENT_SECRET=dev_secret
ARUBA_CUSTOMER_ID=dev_customer
```

Load with:
```python
from dotenv import load_dotenv
load_dotenv(".env.development")
```

### Production Environment

Use system environment variables (not `.env` files):
```bash
# In production server
export ARUBA_CLIENT_ID="prod_client_id"
export ARUBA_CLIENT_SECRET="prod_secret"
export ARUBA_CUSTOMER_ID="prod_customer"
```

### CI/CD Pipelines

Set environment variables in your CI/CD platform:
- **GitHub Actions**: Repository Secrets
- **GitLab CI**: CI/CD Variables
- **Jenkins**: Credentials Manager
- **AWS**: Parameter Store or Secrets Manager

## Additional Resources

- [Aruba Central API Documentation](https://developer.arubanetworks.com/aruba-central/docs)
- [OAuth2 Client Credentials Flow](https://oauth.net/2/grant-types/client-credentials/)
- [Aruba Central API Rate Limits](https://developer.arubanetworks.com/aruba-central/docs/api-rate-limiting)
- [CLAUDE.md](./CLAUDE.md) - Developer guidance for Claude Code

## Support

For issues with this framework:
- Check [CLAUDE.md](./CLAUDE.md) for development patterns
- Review [README.md](./README.md) for setup instructions
- Verify credentials in Aruba Central portal

For Aruba Central API issues:
- Contact Aruba support
- Check [Aruba Central documentation](https://help.central.arubanetworks.com/)
