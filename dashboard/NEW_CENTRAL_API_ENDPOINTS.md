# New HPE Aruba Central API (v1alpha1) - Endpoint Reference

**Last Updated**: November 2025
**API Version**: v1alpha1
**Base URL**: `https://internal.api.central.arubanetworks.com`
**Authentication**: OAuth 2.0 Client Credentials (Bearer Token)

## Overview

The New HPE Aruba Central API uses a different architecture than the legacy Central API. Key differences:

- **Base URL**: `internal.api.central.arubanetworks.com` (not `apigw-prod2.central.arubanetworks.com`)
- **Authentication**: Client credentials flow with bearer tokens (not password flow)
- **Token Endpoint**: `https://sso.common.cloud.hpe.com/as/token.oauth2`
- **API Version**: v1alpha1 (not v1 or v2)
- **Token Validity**: 2 hours with automatic refresh support

## Authentication

### Token Acquisition

```bash
POST https://sso.common.cloud.hpe.com/as/token.oauth2
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 7200
}
```

### Using the Token

All API requests require the Bearer token in the Authorization header:

```bash
GET https://internal.api.central.arubanetworks.com/network-monitoring/v1alpha1/devices
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

## Available Endpoints

### ✅ Network Monitoring Endpoints

#### Devices

```bash
GET /network-monitoring/v1alpha1/devices
```
**Description**: Get all network devices
**Status**: ✅ Working
**Response**:
```json
{
  "count": 9,
  "items": [
    {
      "deviceId": "...",
      "deviceName": "switch-01",
      "deviceType": "SWITCH",
      "model": "...",
      "serialNumber": "...",
      "macAddress": "...",
      "status": "Up",
      ...
    }
  ]
}
```

**Note**: Returns all device types. Use `deviceType` field to filter:
- `SWITCH` - Switches
- `AP` - Access Points
- `GATEWAY` - Gateways
- Other device types may exist

---

#### Device Inventory

```bash
GET /network-monitoring/v1alpha1/device-inventory/{serial}
```
**Description**: Get detailed information for a specific device
**Status**: ✅ Working
**Parameters**:
- `serial` - Device serial number

---

#### Access Points

```bash
GET /network-monitoring/v1alpha1/aps
```
**Description**: Get all access points
**Status**: ✅ Working

**Query Parameters**:
- `filter` (string, max 256 chars): OData v4.0 filter with limited functionality
  - Only 'and' conjunction supported (no 'or' or 'not')
  - Supported fields: `clusterId`, `clusterName`, `deployment`, `deviceName`, `model`, `serialNumber`, `siteId`, `status`
  - Operators: `eq` (equals), `in` (in list)
- `sort` (string, max 256 chars): Comma-separated sort expressions
  - Format: `field [asc|desc]`
  - Supported fields: `siteId`, `model`, `status`, `deployment`, `serialNumber`, `deviceName`
- `limit` (int64, 0-100, default 20): Maximum number of APs to return
- `next` (string): Pagination cursor for next page

**Example Queries**:
```bash
# Basic query with limit
GET /network-monitoring/v1alpha1/aps?limit=50

# Filter by site
GET /network-monitoring/v1alpha1/aps?filter=siteId eq '12345'

# Filter by status
GET /network-monitoring/v1alpha1/aps?filter=status eq 'Up'

# Multiple filters
GET /network-monitoring/v1alpha1/aps?filter=status eq 'Up' and siteId eq '12345'

# Filter using 'in' operator
GET /network-monitoring/v1alpha1/aps?filter=serialNumber in ('ABC123', 'DEF456')

# Sort by device name
GET /network-monitoring/v1alpha1/aps?sort=deviceName asc&limit=100

# Complex query
GET /network-monitoring/v1alpha1/aps?filter=status eq 'Up' and model eq '505'&sort=deviceName desc&limit=50
```

**Response**:
```json
{
  "count": 5,
  "items": [
    {
      "deviceId": "...",
      "deviceName": "AP-505-01",
      "model": "505",
      "serialNumber": "...",
      "macAddress": "...",
      "status": "Up",
      "ipAddress": "...",
      "site": "...",
      ...
    }
  ]
}
```

**Error Responses**:
- **400**: Invalid input (malformed filter, invalid field names)
- **401**: Unauthorized (invalid or expired token)
- **403**: Forbidden (insufficient permissions)
- **429**: Rate limit exceeded
- **500**: Internal server error

---

#### WLANs

```bash
GET /network-monitoring/v1alpha1/wlans
```
**Description**: Get all wireless networks (SSIDs)
**Status**: ✅ Working
**Response**:
```json
{
  "count": 5,
  "items": [
    {
      "wlanId": "...",
      "ssid": "Corporate-WiFi",
      "type": "employee",
      "security": "wpa2-enterprise",
      "enabled": true,
      ...
    }
  ]
}
```

---

#### Sites Health

```bash
GET /network-monitoring/v1alpha1/sites-health
```
**Description**: Get health metrics for all sites
**Status**: ✅ Working
**Response**:
```json
{
  "count": 1,
  "items": [
    {
      "siteId": "54819475093",
      "siteName": "Main Office",
      "deviceCount": 9,
      "apCount": 5,
      "switchCount": 3,
      "healthScore": 95,
      ...
    }
  ]
}
```

---

#### Clients

```bash
GET /network-monitoring/v1alpha1/clients?site-id={siteId}
```
**Description**: Get connected wireless and wired clients
**Status**: ✅ Working
**Query Parameters**:
- `site-id` (optional) - Filter by site ID

**Response**:
```json
{
  "count": 20,
  "items": [
    {
      "macAddress": "...",
      "ipAddress": "...",
      "username": "...",
      "deviceName": "...",
      "connectionType": "wireless",
      "ssid": "...",
      "apName": "...",
      "connected": true,
      ...
    }
  ]
}
```

---

#### Client Trends

```bash
GET /network-monitoring/v1alpha1/clients/trends?site-id={siteId}
```
**Description**: Get client connection trends over time
**Status**: ✅ Working
**Query Parameters**:
- `site-id` (optional) - Filter by site ID

**Response**:
```json
{
  "categories": ["Wired", "Wireless"],
  "samples": [
    {
      "timestamp": "2025-11-05T10:00:00Z",
      "wired": 5,
      "wireless": 15
    },
    ...
  ]
}
```

---

#### Top Clients by Usage

```bash
GET /network-monitoring/v1alpha1/clients/usage/topn?site-id={siteId}
```
**Description**: Get top N clients by data usage
**Status**: ✅ Working
**Query Parameters**:
- `site-id` (optional) - Filter by site ID

**Response**:
```json
{
  "count": 5,
  "items": [
    {
      "mac": "20:4c:03:82:04:c2",
      "usage": 4607265652,
      "username": "...",
      "device": "...",
      ...
    }
  ]
}
```

---

### ❌ Unavailable Endpoints in v1alpha1

The following endpoints from the legacy Central API are **NOT available** in the new v1alpha1 API:

#### Sites Management
```bash
❌ GET /central/v2/sites
❌ POST /sites
❌ PUT /sites/{siteId}
❌ DELETE /sites/{siteId}
```
**Status**: 404 Not Found
**Alternative**: Sites-health endpoint provides read-only site information

---

#### Configuration Groups
```bash
❌ GET /configuration/v1/groups
❌ POST /configuration/v1/groups
❌ PUT /configuration/v1/groups/{groupName}
❌ DELETE /configuration/v1/groups/{groupName}
```
**Status**: 404 Not Found
**Alternative**: None currently available in v1alpha1

---

#### Configuration Templates
```bash
❌ GET /configuration/v1/templates
❌ POST /configuration/v1/templates
❌ PUT /configuration/v1/templates/{templateId}
❌ DELETE /configuration/v1/templates/{templateId}
```
**Status**: 404 Not Found
**Alternative**: None currently available in v1alpha1

---

#### User Management
```bash
❌ GET /platform/rbac/v1/users
❌ POST /platform/rbac/v1/users
❌ PUT /platform/rbac/v1/users/{userId}
❌ DELETE /platform/rbac/v1/users/{userId}
```
**Status**: 404 Not Found
**Alternative**: None currently available in v1alpha1

---

#### Switches (Direct Endpoint)
```bash
❌ GET /monitoring/v1/switches
```
**Status**: 404 Not Found
**Alternative**: Use `/network-monitoring/v1alpha1/devices` and filter by `deviceType == "SWITCH"`

---

## API Implementation Notes

### Device Type Filtering

Since there's no dedicated switches endpoint, filtering must be done on the backend:

```python
# Get all devices
response = client.get('/network-monitoring/v1alpha1/devices')

# Filter for switches
if 'items' in response:
    switches = [device for device in response['items']
                if device.get('deviceType') == 'SWITCH']
```

### Site ID Parameter

Several endpoints accept an optional `site-id` query parameter. The correct format is:

```bash
# Correct (hyphenated)
/clients?site-id=54819475093

# Not site_id (underscore) - this won't work as expected
```

### Response Format

All v1alpha1 endpoints return a consistent format:

```json
{
  "count": 10,
  "items": [...]
}
```

- `count` - Total number of items
- `items` - Array of resource objects

### Error Responses

```json
{
  "error": "Error message",
  "status": 404,
  "timestamp": "2025-11-05T15:30:00Z"
}
```

## Token Management Best Practices

### Automatic Token Refresh

The TokenManager class handles automatic token refresh:

```python
from token_manager import TokenManager

token_manager = TokenManager(
    client_id="your_client_id",
    client_secret="your_client_secret"
)

# Automatically refreshes when needed (5-minute buffer before expiry)
access_token = token_manager.get_access_token()
```

### Token Caching

Tokens are cached to `.token_cache.json` to avoid rate limits:

```json
{
  "access_token": "eyJhbGci...",
  "expires_at": 1730829322.5,
  "cached_at": 1730822122.5
}
```

### Manual Token Refresh

```python
# Force refresh even if cached token is valid
new_token = token_manager.get_access_token(force_refresh=True)
```

## Dashboard Backend Implementation

### Initialization

```python
from central_api_client import CentralAPIClient
from token_manager import TokenManager

# Initialize token manager
token_manager = TokenManager(
    client_id=config["client_id"],
    client_secret=config["client_secret"]
)

# Initialize API client with auto-refresh
client = CentralAPIClient(
    base_url="https://internal.api.central.arubanetworks.com",
    token_manager=token_manager
)
```

### Making API Calls

```python
# Token automatically refreshed if needed
@app.route('/api/devices')
def get_devices():
    response = client.get('/network-monitoring/v1alpha1/devices')
    return jsonify(response)
```

### Backend Filtering Example

```python
@app.route('/api/switches')
def get_switches():
    # Get all devices
    response = client.get('/network-monitoring/v1alpha1/devices')

    # Filter for switches only
    if 'items' in response:
        switches = [d for d in response['items']
                   if d.get('deviceType') == 'SWITCH']
        return jsonify({'count': len(switches), 'items': switches})

    return jsonify(response)
```

## Migration from Legacy API

### Key Changes

| Legacy API | New v1alpha1 API |
|------------|------------------|
| `apigw-prod2.central.arubanetworks.com` | `internal.api.central.arubanetworks.com` |
| Password flow (3-step OAuth) | Client credentials flow |
| `/monitoring/v1/...` | `/network-monitoring/v1alpha1/...` |
| `/monitoring/v1/switches` | Filter `/network-monitoring/v1alpha1/devices` |
| `/central/v2/sites` | ❌ Not available (use `/sites-health`) |
| `/configuration/v1/groups` | ❌ Not available |
| `/configuration/v1/templates` | ❌ Not available |
| `/platform/rbac/v1/users` | ❌ Not available |

### Code Changes Required

**Before** (Legacy API):
```python
from utils.api_client import ArubaClient

client = ArubaClient(
    base_url="https://apigw-prod2.central.arubanetworks.com",
    client_id=client_id,
    client_secret=client_secret,
    customer_id=customer_id,
    username=username,
    password=password
)
client.authenticate()  # 3-step OAuth
response = client.get('/monitoring/v1/switches')
```

**After** (New v1alpha1 API):
```python
from central_api_client import CentralAPIClient
from token_manager import TokenManager

token_manager = TokenManager(
    client_id=client_id,
    client_secret=client_secret
)

client = CentralAPIClient(
    base_url="https://internal.api.central.arubanetworks.com",
    token_manager=token_manager
)

# Automatic authentication, no manual authenticate() call
response = client.get('/network-monitoring/v1alpha1/devices')
switches = [d for d in response['items'] if d.get('deviceType') == 'SWITCH']
```

## Testing Endpoints

Use the API Explorer in the dashboard or test with curl:

```bash
# Get access token first
TOKEN=$(curl -X POST https://sso.common.cloud.hpe.com/as/token.oauth2 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET" \
  | jq -r '.access_token')

# Test devices endpoint
curl -X GET https://internal.api.central.arubanetworks.com/network-monitoring/v1alpha1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

## Support and Documentation

- **Developer Portal**: https://developer.arubanetworks.com/new-central-config/reference
- **API Documentation**: https://developer.arubanetworks.com/new-central/docs
- **GitHub Repository**: `/path/to/project/Aruba-Central-Portal/`
- **Dashboard**: http://localhost:3000 (development)
- **Backend API**: http://localhost:1344 (development)

## Version History

### v1alpha1 (Current)
- Network monitoring endpoints
- Device management
- Wireless (APs, WLANs)
- Client monitoring and analytics
- Sites health monitoring

### Future (Expected)
- Configuration management (sites, groups, templates)
- User and role management
- Audit logs
- Advanced analytics
- WebSocket support for real-time updates

## Known Limitations

1. **No Configuration Endpoints**: Sites, groups, and templates management not yet available
2. **No User Management**: RBAC endpoints not available in v1alpha1
3. **Read-Only Operations**: Most endpoints are GET-only
4. **Beta Status**: v1alpha1 indicates this is still in alpha/beta phase
5. **Limited Documentation**: Some endpoints lack detailed documentation

## Recommendations

1. **Use API Explorer**: Test endpoints interactively before implementing
2. **Handle 404 Gracefully**: Configuration endpoints will return 404, handle in UI
3. **Backend Filtering**: Implement device type filtering on backend
4. **Token Caching**: Always use TokenManager to avoid rate limits
5. **Monitor API Changes**: v1alpha1 may have breaking changes in future versions
6. **Fallback Logic**: Consider graceful degradation for unavailable features

---

**Document Version**: 1.0
**Last Verified**: November 5, 2025
**API Status**: Active (v1alpha1)
**Breaking Changes**: Expected as API moves from alpha to stable
