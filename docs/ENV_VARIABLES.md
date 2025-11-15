# Environment Variables for Docker Deployment

## Required Variables

These environment variables **MUST** be set for the application to work:

| Variable | Description | Example |
|----------|-------------|---------|
| `ARUBA_BASE_URL` | Aruba Central API endpoint URL for your region | `https://apigw-prod2.central.arubanetworks.com` |
| `ARUBA_CLIENT_ID` | OAuth2 Client ID from Aruba Central | `abc123def456...` |
| `ARUBA_CLIENT_SECRET` | OAuth2 Client Secret from Aruba Central | `xyz789uvw012...` |
| `ARUBA_CUSTOMER_ID` | Your Aruba Central Customer/Tenant ID | `cust_abc123...` |

## Regional Base URLs

Choose the correct base URL for your Aruba Central region:

- **US West**: `https://apigw-uswest4.central.arubanetworks.com`
- **US East**: `https://apigw-prod2.central.arubanetworks.com`
- **EU (Germany)**: `https://apigw-eucentral3.central.arubanetworks.com`
- **APAC (Singapore)**: `https://apigw-apeast1.central.arubanetworks.com`

## Optional Variables

These variables are optional but may be useful in certain configurations:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ARUBA_USERNAME` | Username for password grant OAuth2 flow | Not set | `admin@example.com` |
| `ARUBA_PASSWORD` | Password for password grant OAuth2 flow | Not set | `SecurePassword123!` |
| `LOG_LEVEL` | Logging verbosity level | `INFO` | `DEBUG` |
| `FLASK_ENV` | Flask environment mode | `production` | `production` |

## How to Get Aruba Central Credentials

1. Log in to your Aruba Central account: https://central.arubanetworks.com
2. Navigate to: **Account Home** → **System Apps & Tokens**
3. Click **Generate App Credentials**
4. Configure API permissions:
   - **Read**: For monitoring and viewing data
   - **Write**: For making configuration changes
5. Copy the generated credentials:
   - Client ID
   - Client Secret
   - Customer ID
6. Store them securely in your `.env` file

## Example .env File

```env
# Aruba Central API Configuration
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_actual_client_id_here
ARUBA_CLIENT_SECRET=your_actual_client_secret_here
ARUBA_CUSTOMER_ID=your_actual_customer_id_here

# Optional: Logging
LOG_LEVEL=INFO
```

## Setting Environment Variables in Docker

### Method 1: Using .env file (Recommended)

Create a `.env` file in the same directory as `docker-compose.yml`:

```bash
cp .env.example .env
nano .env
```

Then run:
```bash
docker-compose up -d
```

### Method 2: Using docker-compose.yml

Edit `docker-compose.yml` and replace `${VARIABLE}` with actual values:

```yaml
environment:
  - ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
  - ARUBA_CLIENT_ID=your_client_id
  - ARUBA_CLIENT_SECRET=your_client_secret
  - ARUBA_CUSTOMER_ID=your_customer_id
```

### Method 3: Using Docker CLI

Pass environment variables directly when running the container:

```bash
docker run -d \
  --name aruba-central-portal \
  -p 1344:1344 \
  -e ARUBA_BASE_URL="https://apigw-prod2.central.arubanetworks.com" \
  -e ARUBA_CLIENT_ID="your_client_id" \
  -e ARUBA_CLIENT_SECRET="your_client_secret" \
  -e ARUBA_CUSTOMER_ID="your_customer_id" \
  -v aruba-token-cache:/app/data \
  aruba-central-portal:latest
```

### Method 4: Ugreen NAS Container Manager

When creating the container in Ugreen NAS web interface:

1. Go to **Container Manager**
2. Create new container from image
3. In **Environment Variables** section, add:
   - Key: `ARUBA_BASE_URL`, Value: `https://apigw-prod2.central.arubanetworks.com`
   - Key: `ARUBA_CLIENT_ID`, Value: `your_client_id`
   - Key: `ARUBA_CLIENT_SECRET`, Value: `your_client_secret`
   - Key: `ARUBA_CUSTOMER_ID`, Value: `your_customer_id`

## Security Notes

⚠️ **IMPORTANT SECURITY WARNINGS:**

1. **Never commit `.env` file to git** - It contains sensitive credentials
2. **Never share your client secret publicly**
3. **Rotate credentials regularly** (every 90 days recommended)
4. **Use read-only credentials** if you don't need write access
5. **Restrict network access** to the Docker container
6. **Enable HTTPS** using a reverse proxy in production

## Troubleshooting

### "401 Unauthorized" Error
- Check that credentials are correct
- Verify credentials haven't expired in Aruba Central portal
- Ensure the base URL matches your region

### "Connection Refused" Error
- Verify the base URL is correct for your region
- Check network connectivity from your NAS to Aruba Central
- Ensure firewall allows outbound HTTPS (port 443)

### "Rate Limit" Error
- Aruba Central allows only 1 new access token per 30 minutes
- The application caches tokens automatically
- Wait 30 minutes before requesting a new token
- Check that the token cache volume is properly mounted

## Need Help?

- See `DOCKER_DEPLOYMENT.md` for full deployment guide
- See `README.md` for application documentation
- See Aruba Central API documentation: https://developer.arubanetworks.com/aruba-central/docs
