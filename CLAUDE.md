# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python-based automation framework for Aruba Central API. It provides reusable utilities and organized scripts for network management, device operations, monitoring, and reporting tasks.

## Architecture

### Core Components

**ArubaClient** (`utils/api_client.py`):
- Handles OAuth2 authentication with Aruba Central
- Provides HTTP methods (get, post, put, delete) with automatic token refresh
- Manages session state and authorization headers
- Base URL is region-specific; common endpoints: `/monitoring/v1/`, `/configuration/v1/`, `/platform/`

**Configuration Management** (`utils/config.py`):
- Loads config from `config.yaml` with environment variable overrides
- Environment variables take precedence over config file
- Required vars: `ARUBA_CLIENT_ID`, `ARUBA_CLIENT_SECRET`, `ARUBA_CUSTOMER_ID`
- Supports both client credentials and password grant OAuth2 flows

### Script Organization

Scripts are organized by domain in `scripts/`:
- `network/`: VLAN, WLAN, site configurations
- `devices/`: Provisioning, inventory, firmware management
- `monitoring/`: Health checks, alerts, connectivity tests
- `reports/`: Data extraction, analytics, audit reports

All scripts follow the pattern:
```python
from utils import ArubaClient, load_config
config = load_config()
client = ArubaClient(**config["aruba_central"])
# Authentication happens automatically on first API call - no explicit call needed
devices = client.get("/monitoring/v1/devices")
```

## Development Commands

### Environment Setup
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env  # Then edit .env with credentials
```

### Testing
```bash
pytest                    # Run all tests
pytest tests/test_config.py  # Run specific test
pytest --cov=scripts --cov=utils  # With coverage
```

### Code Quality
```bash
black .                   # Format all code
ruff check .             # Lint (includes security checks)
mypy scripts/ utils/     # Type checking
```

### Running Scripts
```bash
python scripts/example_script.py
python scripts/devices/provision_device.py
```

## Important Patterns

### Token Caching (CRITICAL)
Aruba Central has a **strict rate limit: 1 access token per 30 minutes**. The project uses two separate token caching systems:

**Legacy Scripts** (`utils/api_client.py`):
- Uses OAuth2 3-step authorization code flow (username + password)
- Caches tokens to `.token_cache_legacy.json`
- Tokens are valid for 2 hours (7200 seconds)
- Cache includes 5-minute buffer to prevent expiry during use
- **Never call `client.authenticate()` explicitly** - let `_request()` handle it automatically
- The client loads cached tokens on initialization
- Automatic retry with exponential backoff on 429 rate limit errors

**Dashboard** (`dashboard/backend/token_manager.py`):
- Uses OAuth2 client credentials flow (client_id + client_secret)
- Caches tokens to `.token_cache_central.json`
- Used for service-to-service authentication with HPE SSO
- Automatic token refresh before expiry

**Correct pattern:**
```python
client = ArubaClient(...)  # Loads cached token automatically
response = client.get("/monitoring/v1/devices")  # Uses cache or auto-authenticates
```

**Incorrect pattern (causes rate limit errors):**
```python
client = ArubaClient(...)
client.authenticate()  # DON'T DO THIS - forces new auth even if cache exists
```

### Error Handling
API calls raise `requests.HTTPError` on failure. The API client automatically handles some errors:
- **401**: Attempts token refresh automatically once
- **429**: Automatic retry with exponential backoff (3 retries, 60s → 90s → 135s delays)
- **404**: Resource not found - no retry
- **403**: Authorization failure (insufficient permissions) - no retry
- **500+**: Server errors - scripts should implement retry logic

Scripts should catch and handle errors appropriately:
```python
from requests.exceptions import HTTPError

try:
    devices = client.get("/monitoring/v1/devices")
except HTTPError as e:
    if e.response.status_code == 403:
        console.print("[red]Insufficient permissions[/red]")
    elif e.response.status_code == 404:
        console.print("[yellow]Resource not found[/yellow]")
    else:
        console.print(f"[red]API Error: {e}[/red]")
```

### Authentication Flow
The client auto-authenticates on first API call. Manual auth is optional:
```python
client = ArubaClient(...)
# client.authenticate()  # Optional - happens automatically on first request
response = client.get("/monitoring/v1/devices")  # Auth happens here if needed
```

### Rich Console Output
Use `rich` library for formatted output (already in dependencies):
```python
from rich.console import Console
from rich.table import Table
console = Console()
console.print("[green]Success![/green]")
```

## API Endpoint Patterns

Aruba Central API follows REST conventions:
- Device inventory: `/monitoring/v1/devices`
- Device details: `/monitoring/v1/devices/{serial}`
- Configuration: `/configuration/v1/{path}`
- Template management: `/configuration/v1/templates`
- Site management: `/central/v2/sites`

Always check [Aruba Central API docs](https://developer.arubanetworks.com/aruba-central/docs) for current endpoints.

## Security Considerations

- Never commit `.env` or `config.local.yaml`
- Credentials should only be in environment variables or `.env`
- Use least-privilege OAuth2 scopes when generating API credentials
- Store sensitive data (passwords, tokens) securely outside the repository
- Rotate API credentials regularly

## Testing New Scripts

When creating scripts, add corresponding tests in `tests/`:
1. Mock API responses using `unittest.mock` or `responses` library
2. Test both success and error cases
3. Validate data transformation and output formatting
4. Run tests before committing: `pytest && black . && ruff check .`

## Common Issues

**"401 Unauthorized"**: Check credentials in `.env`, verify they're not expired in Aruba Central portal

**"Module not found"**: Ensure virtual environment is activated and dependencies installed

**Regional API URLs**: Different regions use different base URLs - verify correct URL in `.env` matches your Aruba Central instance region
