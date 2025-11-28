# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python-based automation framework for Aruba Central API. It provides reusable utilities and organized scripts for network management, device operations, monitoring, and reporting tasks.

## Architecture

### Core Components

**CentralAPIClient** (`utils/central_api_client.py`):
- Handles Bearer token authentication with Aruba Central
- Provides HTTP methods (get, post, put, patch, delete) with automatic token refresh
- Includes automatic retry with exponential backoff on 429 rate limit errors
- Manages session state and authorization headers
- Base URL is region-specific; common endpoints: `/monitoring/v1/`, `/configuration/v1/`, `/platform/`

**TokenManager** (`utils/token_manager.py`):
- Uses OAuth2 client credentials flow (client_id + client_secret) with HPE SSO
- Caches tokens to `.token_cache_central.json`
- Automatic token refresh before expiry (5-minute buffer)
- Tokens are valid for 2 hours (7200 seconds)

**Configuration Management** (`utils/config.py`):
- Loads config from `config.yaml` with environment variable overrides
- Environment variables take precedence over config file
- Required vars: `ARUBA_CLIENT_ID`, `ARUBA_CLIENT_SECRET`, `ARUBA_CUSTOMER_ID`

### Script Organization

Scripts are organized by domain in `scripts/`:
```
scripts/
├── discovery/       # API exploration, device discovery (explore_api.py, list_tenants.py)
├── network/
│   └── wlan/        # WLAN management (cleanup, create, debug, extract VLANs)
├── users/           # User management (user_management.py, export_users_csv.py)
├── tenants/         # MSP/tenant operations (check_msp_info.py, msp_dashboard.py)
├── monitoring/      # Health checks, audits (user_audit.py, msp_user_audit.py)
├── utilities/       # Standalone tools (coming soon)
├── wlan-testing/    # WLAN CLI tools (wlan_cli.py, scope_cli.py, test_utils.py)
└── archive/         # Deprecated scripts (preserved for reference)
```

Test files are in `tests/` and `scripts/testing/`:
```
tests/
├── conftest.py          # Pytest fixtures
└── test_*.py            # Unit tests (run with `make test`)

scripts/testing/         # Manual integration test scripts (require live API)
└── test_*.py            # Run directly: ./venv/bin/python scripts/testing/test_api.py
```

All scripts follow this pattern:
```python
from utils import CentralAPIClient, TokenManager, load_config
config = load_config()
aruba_config = config["aruba_central"]

# Initialize token manager for automatic token refresh
token_manager = TokenManager(
    client_id=aruba_config["client_id"],
    client_secret=aruba_config["client_secret"],
)

# Initialize API client with token manager
client = CentralAPIClient(
    base_url=aruba_config["base_url"],
    token_manager=token_manager,
)

# Authentication happens automatically via TokenManager
devices = client.get("/monitoring/v1/devices")
```

## Development Commands

Use the Makefile for common operations (requires virtual environment):

### Quick Reference
```bash
make help        # Show all available commands
make test        # Run all tests
make test-cov    # Run tests with coverage report
make lint        # Check code with ruff
make format      # Format code with black
make type-check  # Run mypy type checking
make all         # Run format, lint, type-check, test
make clean       # Remove cache files
```

### Environment Setup
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
make install-dev          # Install all dependencies
cp .env.example .env      # Then edit .env with credentials
```

### Testing
```bash
make test                              # Run all 45+ tests
make test-cov                          # With coverage (HTML report in htmlcov/)
./venv/bin/python -m pytest tests/ -x -q  # Quick smoke test
```

**Current test coverage:**
- `utils/central_api_client.py`: 91%
- `utils/token_manager.py`: 90%
- `utils/config.py`: 88%

### Code Quality
```bash
make format      # Format with black
make lint        # Lint with ruff
make type-check  # Type check with mypy
```

### Running Scripts
```bash
./venv/bin/python scripts/example_script.py
./venv/bin/python scripts/devices/provision_device.py
```

## CLI Tools

Consolidated CLI tools for common operations:

### WLAN CLI (`scripts/wlan-testing/wlan_cli.py`)
```bash
./venv/bin/python scripts/wlan-testing/wlan_cli.py list           # List all WLANs
./venv/bin/python scripts/wlan-testing/wlan_cli.py get <name>     # Get WLAN details
./venv/bin/python scripts/wlan-testing/wlan_cli.py create <name> -p "password"  # Create WLAN
./venv/bin/python scripts/wlan-testing/wlan_cli.py delete <name>  # Delete WLAN
./venv/bin/python scripts/wlan-testing/wlan_cli.py check <name>   # Health check
```

### Scope CLI (`scripts/wlan-testing/scope_cli.py`)
```bash
./venv/bin/python scripts/wlan-testing/scope_cli.py sites         # List sites
./venv/bin/python scripts/wlan-testing/scope_cli.py get <name>    # Get site details
./venv/bin/python scripts/wlan-testing/scope_cli.py maps          # View scope maps
./venv/bin/python scripts/wlan-testing/scope_cli.py wlans <site>  # List WLANs at site
./venv/bin/python scripts/wlan-testing/scope_cli.py roles         # List roles
```

## Important Patterns

### Token Caching (CRITICAL)
Aruba Central has a **strict rate limit: 1 access token per 30 minutes**. The project uses TokenManager for automatic token handling:

**TokenManager** (`utils/token_manager.py`):
- Uses OAuth2 client credentials flow (client_id + client_secret) via HPE SSO
- Caches tokens to `.token_cache_central.json`
- Tokens are valid for 2 hours (7200 seconds)
- Cache includes 5-minute buffer to prevent expiry during use
- Automatic token refresh before expiry
- CentralAPIClient automatically uses TokenManager for all requests

**CentralAPIClient** (`utils/central_api_client.py`):
- Automatic retry with exponential backoff on 429 rate limit errors (60s → 90s → 135s)
- Refreshes token via TokenManager before each request if needed
- No manual authentication calls needed

**Correct pattern:**
```python
token_manager = TokenManager(client_id=..., client_secret=...)
client = CentralAPIClient(base_url=..., token_manager=token_manager)
response = client.get("/monitoring/v1/devices")  # Token handled automatically
```

**Legacy scripts archived:**
The legacy `ArubaClient` (3-step OAuth2 flow) has been archived to `scripts/archive/`.
Use `CentralAPIClient` + `TokenManager` for all new scripts.

**Incorrect pattern (DON'T DO THIS):**
```python
# Don't use static tokens - use TokenManager instead
client = CentralAPIClient(base_url=..., access_token="hardcoded_token")
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
The client auto-authenticates on first API call via TokenManager:
```python
token_manager = TokenManager(client_id=..., client_secret=...)
client = CentralAPIClient(base_url=..., token_manager=token_manager)
response = client.get("/monitoring/v1/devices")  # Token injected automatically
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

## Local Documentation (Search Before Web)

**ALWAYS search local docs before web searching.** This project has comprehensive documentation.

### Documentation Hierarchy

1. **API Endpoint Docs** (`docs/api/aruba-api-docs/`)
   - `configuration-apis/` - Provisioning endpoints (WLAN, VLAN, sites, security)
   - `mrt-apis/` - Monitoring endpoints (gateways, devices, clients)
   - `cnxconfig-specs/` - OpenAPI specs (JSON)

2. **GreenLake API Docs** (`docs/greenlake/aruba-api-docs/`)
   - Authentication, Identity, Authorization APIs
   - Device management, Workspace APIs
   - HPE GreenLake platform integration

3. **Solution Guides** (`docs/solution-guide/`)
   - HPE validated configuration guides
   - Central On-Premises deployment guides
   - Policy configuration examples
   - Real-world deployment patterns

4. **Existing Scripts** (`scripts/`)
   - `scripts/wlan-testing/` - WLAN test/utility scripts
   - `scripts/monitoring/` - User audit scripts
   - Root-level scripts - API exploration, tenant listing, UUID discovery

5. **Project Docs** (`docs/`)
   - `HOW_IT_WORKS.md` - System architecture
   - `CONFIGURATION.md` - Config management
   - `ENV_VARIABLES.md` - Environment reference

### Domain-to-Path Mapping

| Domain | API Docs | Solution Guides | Example Scripts |
|--------|----------|-----------------|-----------------|
| **WLAN** | `configuration-apis/wireless/wlan/`, `mrt-apis/monitoring/access-points/` | `solution-guide/policy-*.md` | `scripts/wlan-testing/` |
| **Gateway** | `mrt-apis/monitoring/gateways/` | `solution-guide/` | `scripts/network/wlan/debug_gateway_vlans.py` |
| **VLAN** | `configuration-apis/vlans-networks/vlan/` | | `scripts/network/wlan/extract_vlans_from_wlans.py` |
| **Sites** | `configuration-apis/scope-management/sites/` | | `scripts/wlan-testing/scope_cli.py` |
| **Devices** | `mrt-apis/monitoring/devices/` | `solution-guide/central-*.md` | `scripts/discovery/explore_api.py` |
| **Switches** | `mrt-apis/monitoring/switch/`, `configuration-apis/interfaces/` | | |
| **NAC/Auth** | `configuration-apis/central-nac/`, `configuration-apis/security/` | `solution-guide/policy-*.md` | |
| **Firmware** | `mrt-apis/services/firmware/` | `solution-guide/central-*.md` | |
| **Routing/VPN** | `configuration-apis/routing-overlays/` (BGP, OSPF, VRF, tunnels) | | |
| **GreenLake** | `docs/greenlake/aruba-api-docs/` (auth, identity, devices, workspace) | `docs/GREENLAKE_ROLES.md` | |

### Search Pattern

1. Identify domain from task
2. Search API docs: `docs/api/aruba-api-docs/{domain-path}/*.md`
3. Check solution guides: `docs/solution-guide/*.md`
4. Find example scripts: `scripts/**/*.py` with relevant keywords
5. Only web search if local docs don't cover the topic

## Question-Asking Requirements

**Before implementing API tasks, ALWAYS ask clarifying questions.**

### Required Questions by Task Type

#### WLAN Tasks
- WLAN name and SSID?
- Security type: WPA2, WPA3, WPA2/WPA3, Enhanced Open, Enterprise?
- Forward mode: Bridge or Tunnel?
- If Tunnel: Which gateway? Which VLAN? (discover if unknown)
- Scope: Global or site-specific?

#### Gateway Tasks
- Which gateway(s)? (list available if unknown)
- Cluster or standalone?
- Which interfaces/VLANs to configure?

#### Site/Scope Tasks
- Site hierarchy level?
- Inherit from parent or custom config?

#### General API Tasks
- Scope: Global, site, or device group?
- Which optional parameters to include?
- Error handling preferences?

## API Variable Discovery

**If a required value is unknown, discover it first.**

### Discovery Endpoints

| Need | Discovery Endpoint | Example Script |
|------|-------------------|----------------|
| Gateway serial | `GET /network-monitoring/v1alpha1/gateways` | `scripts/discovery/explore_api.py` |
| Gateway VLANs | `GET /network-monitoring/v1alpha1/gateways/{serial}/vlans` | `scripts/network/wlan/debug_gateway_vlans.py` |
| Sites | `GET /network-config/v1alpha1/sites` | `scripts/wlan-testing/scope_cli.py` |
| WLANs | `GET /network-config/v1alpha1/wlan-ssids` | `scripts/wlan-testing/wlan_cli.py` |
| Devices | `GET /network-monitoring/v1alpha1/devices` | `scripts/discovery/explore_api.py` |

### Discovery Workflow

1. Check if user provided the value
2. Search local docs for the discovery endpoint
3. Tell user: "I need to discover available [X]..."
4. Run the GET/list endpoint
5. Present options if multiple valid choices
6. Proceed with discovered value

## Claude Code Integration

This project includes Claude Code slash commands and hooks for workflow optimization.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/test` | Run project tests with optional coverage |
| `/wlan` | WLAN operations using wlan_cli.py |
| `/scope` | Site/scope operations using scope_cli.py |
| `/lint` | Run code quality checks |
| `/api` | API exploration and discovery |

### Hooks

Located in `.claude/hooks/`:

- **check-local-docs.md**: Reminds to search local docs before web searching
- **session-start.md**: Project reminders at session start
- **remind-update-claude-md.md**: Prompts to update CLAUDE.md after changes
- **check-credentials.md**: Prevents writing hardcoded credentials
- **use-central-api-client.md**: Enforces CentralAPIClient pattern
- **run-tests-reminder.md**: Reminds to run tests after code changes

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Runs on push to main/develop and PRs
- Tests against Python 3.10, 3.11, 3.12
- Runs linting (black, ruff) and type checking (mypy)
- Coverage uploads to Codecov

Pre-commit hooks (`.pre-commit-config.yaml`):
- Trailing whitespace, end-of-file fixes
- Black formatting, ruff linting
- Pytest on push

## Keeping CLAUDE.md Current

**Update this file when you discover new patterns.**

### Update Triggers

- New working API endpoints discovered
- New discovery patterns identified
- New script utilities created
- Common issues resolved

### Update Rules

- Add to existing sections (don't create new unless necessary)
- Keep formatting consistent
- Don't remove working patterns
- Don't modify authentication/token docs without testing
