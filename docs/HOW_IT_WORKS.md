# How Everything Works - Complete System Documentation

This document provides a comprehensive explanation of how the Aruba Central Portal system works, from initialization to API requests, authentication, and data flow.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Initialization Process](#initialization-process)
4. [Authentication Flow](#authentication-flow)
5. [Token Management](#token-management)
6. [Request Flow](#request-flow)
7. [Frontend Architecture](#frontend-architecture)
8. [Backend Architecture](#backend-architecture)
9. [Data Flow](#data-flow)
10. [Error Handling](#error-handling)
11. [Deployment Process](#deployment-process)
12. [Security Model](#security-model)

---

## System Overview

The Aruba Central Portal is a full-stack web application that provides a secure interface to the HPE Aruba Central API. It consists of:

- **Frontend**: React-based single-page application (SPA) with Material-UI
- **Backend**: Flask API proxy server that handles authentication and API calls
- **Token Management**: Automatic OAuth 2.0 token refresh system
- **Session Management**: Secure session-based authentication

### Key Design Principles

1. **Security First**: Credentials never exposed to frontend
2. **Stateless Backend**: Session-based with token caching
3. **Automatic Token Refresh**: Seamless token renewal
4. **Error Resilience**: Graceful error handling at all layers
5. **Rate Limit Awareness**: Built-in tracking and handling

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Browser                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         React Application (Port 3000/1344)           │  │
│  │  • React Router for navigation                       │  │
│  │  • Material-UI components                           │  │
│  │  • Axios for HTTP requests                           │  │
│  │  • Session storage (localStorage)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTP/HTTPS
                             │ (Session ID in header)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Flask Backend Server (Port 1344)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Endpoints                            │  │
│  │  • /api/auth/* - Authentication                      │  │
│  │  • /api/devices/* - Device management               │  │
│  │  • /api/monitoring/* - Monitoring data               │  │
│  │  • /api/explore - Custom API calls                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Session Management                           │  │
│  │  • In-memory session store (dev)                     │  │
│  │  • Session validation decorator                      │  │
│  │  • 1-hour session timeout                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Token Manager                                │  │
│  │  • OAuth 2.0 client credentials flow                │  │
│  │  • Automatic token refresh                          │  │
│  │  • Token caching (2-hour expiry)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Central API Client                           │  │
│  │  • Bearer token authentication                      │  │
│  │  • HTTP methods: GET, POST, PUT, DELETE              │  │
│  │  • Error handling & retry logic                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTPS (Bearer Token)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         HPE Aruba Central API                                │
│  • internal.api.central.arubanetworks.com                   │
│  • apigw-prod2.central.arubanetworks.com (legacy)            │
│  • OAuth 2.0 authentication                                 │
│  • RESTful API endpoints                                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ 1. User Action
       ▼
┌─────────────────────────────────────┐
│  React Component (e.g., DevicesPage)│
└──────┬──────────────────────────────┘
       │
       │ 2. API Call
       ▼
┌─────────────────────────────────────┐
│  services/api.js (API Service Layer) │
│  • Adds Session ID header            │
│  • Error handling                    │
│  • Request/response interceptors     │
└──────┬──────────────────────────────┘
       │
       │ 3. HTTP Request
       ▼
┌─────────────────────────────────────┐
│  Flask Backend (app.py)              │
│  • Validates session                 │
│  • Checks token validity             │
│  • Forwards to Aruba API             │
└──────┬───────────────────────────────┘
       │
       │ 4. Authenticated Request
       ▼
┌─────────────────────────────────────┐
│  CentralAPIClient                    │
│  • Adds Bearer token                 │
│  • Makes HTTP request                │
└──────┬───────────────────────────────┘
       │
       │ 5. API Call
       ▼
┌─────────────────────────────────────┐
│  Aruba Central API                   │
│  • Processes request                 │
│  • Returns JSON response             │
└──────────────────────────────────────┘
```

---

## Initialization Process

### Backend Initialization

When the Flask backend starts (`app.py`), it goes through the following initialization sequence:

#### 1. Application Setup

```python
# app.py startup sequence
1. Flask app created with CORS enabled
2. Session management initialized (in-memory dict)
3. API rate limiting tracker initialized
4. Global variables initialized (aruba_client, token_manager, config)
```

#### 2. Configuration Loading

```python
initialize_client() function:
1. Loads config from config.yaml and .env file
   - Uses utils/config.py load_config()
   - Environment variables override YAML values
   
2. Validates credentials:
   - Checks for client_id, client_secret, customer_id
   - Verifies they're not placeholder values
   - Sets credentials_configured flag
   
3. If credentials valid:
   - Creates TokenManager instance
   - Creates CentralAPIClient instance
   - TokenManager handles OAuth 2.0 authentication
```

#### 3. Token Manager Initialization

```python
TokenManager.__init__():
1. Stores client_id, client_secret
2. Sets token URL (default: HPE SSO endpoint)
3. Sets cache file location (.token_cache_central.json)
4. Attempts to load cached token:
   - Checks if cache file exists
   - Validates token expiry (with 5-min buffer)
   - Loads token if valid, otherwise sets to None
```

#### 4. Central API Client Initialization

```python
CentralAPIClient.__init__():
1. Sets base URL (internal.api.central.arubanetworks.com)
2. Creates requests.Session()
3. Gets access token from TokenManager
4. Sets Authorization header: "Bearer {token}"
```

### Frontend Initialization

When the React app loads (`App.jsx`), it goes through:

#### 1. App Component Mount

```javascript
App.jsx useEffect():
1. Checks if setup is needed:
   - Calls /api/setup/check
   - If needs_setup: Shows SetupWizard
   - If configured: Checks authentication
   
2. Checks authentication status:
   - Calls authAPI.getStatus()
   - If authenticated: Sets isAuthenticated = true
   - If not: Redirects to /login
   
3. Sets up keyboard shortcuts:
   - Cmd/Ctrl+K: Open global search
   - Cmd/Ctrl+B: Toggle sidebar
```

#### 2. API Service Initialization

```javascript
api.js module load:
1. Creates axios instance with base URL
2. Sets up request interceptor:
   - Adds X-Session-ID header from localStorage
   
3. Sets up response interceptor:
   - Handles 401 errors (redirects to login)
   - Handles optional endpoint errors gracefully
```

---

## Authentication Flow

### Initial Login Process

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Browser │                    │  Flask  │                    │  Aruba  │
│ (React) │                    │ Backend │                    │ Central │
└─────────┘                    └─────────┘                    └─────────┘
     │                              │                              │
     │ 1. User clicks "Connect"     │                              │
     ├─────────────────────────────►│                              │
     │                              │                              │
     │                              │ 2. POST /api/auth/login     │
     │                              │                              │
     │                              │ 3. Check token cache        │
     │                              │    (TokenManager)            │
     │                              │                              │
     │                              │ 4a. Token exists & valid?    │
     │                              │      Yes: Use cached token   │
     │                              │      No: Continue to 4b      │
     │                              │                              │
     │                              │ 4b. Request new token        │
     │                              ├─────────────────────────────►│
     │                              │    POST /as/token.oauth2     │
     │                              │    grant_type=client_credentials
     │                              │                              │
     │                              │◄─────────────────────────────┤
     │                              │    {access_token, expires_in}
     │                              │                              │
     │                              │ 5. Cache token               │
     │                              │    (.token_cache_central.json)
     │                              │                              │
     │                              │ 6. Generate session ID       │
     │                              │    (secrets.token_urlsafe)   │
     │                              │                              │
     │                              │ 7. Store session             │
     │                              │    active_sessions[session_id]
     │                              │    = {created, expires}      │
     │                              │                              │
     │ 8. Return session ID         │                              │
     │◄─────────────────────────────┤                              │
     │                              │                              │
     │ 9. Store in localStorage    │                              │
     │    (aruba_session_id)        │                              │
     │                              │                              │
```

### Session Validation

Every API request includes session validation:

```python
@require_session decorator:
1. Extracts X-Session-ID from request headers
2. Checks if session exists in active_sessions
3. Validates session hasn't expired:
   - current_time < session['expires']
4. If valid: Extends session expiry by 1 hour
5. If invalid: Returns 401 Unauthorized
```

### Token Refresh Process

Tokens are automatically refreshed when needed:

```python
TokenManager.get_access_token():
1. Checks if token needs refresh:
   - force_refresh flag
   - No token exists
   - Token expired (with 5-min buffer)
   
2. If refresh needed:
   - Calls _refresh_token()
   - POST to HPE SSO token endpoint
   - Updates access_token and expires_at
   - Saves to cache file
   
3. Returns valid access token
```

---

## Token Management

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Lifecycle                           │
└─────────────────────────────────────────────────────────────┘

1. Token Generation
   ├─ Client credentials sent to HPE SSO
   ├─ OAuth 2.0 client_credentials grant
   └─ Returns: access_token, expires_in (7200 seconds = 2 hours)

2. Token Caching
   ├─ Saved to .token_cache_central.json
   ├─ Includes: access_token, expires_at (timestamp)
   └─ Location: /app/data/ (Docker) or project root (dev)

3. Token Usage
   ├─ Added to Authorization header: "Bearer {token}"
   ├─ Used for all Aruba Central API requests
   └─ Automatically refreshed when needed

4. Token Refresh
   ├─ Triggered when: expires_at - 300 seconds < current_time
   ├─ Same OAuth 2.0 flow
   └─ Cache updated with new token

5. Token Expiry
   ├─ Default: 2 hours (7200 seconds)
   ├─ 5-minute buffer before refresh
   └─ Automatic refresh prevents expiry
```

### Token Storage

**Backend (TokenManager):**
- File: `.token_cache_central.json`
- Location: `TOKEN_CACHE_DIR` env var or project root
- Format:
  ```json
  {
    "access_token": "eyJhbGc...",
    "expires_at": 1234567890.123,
    "cached_at": 1234567890.123
  }
  ```

**Backend (Session):**
- In-memory dictionary: `active_sessions`
- Key: session_id (cryptographically secure)
- Value: `{created: timestamp, expires: timestamp}`
- Timeout: 1 hour (3600 seconds)

**Frontend:**
- localStorage key: `aruba_session_id`
- Value: Opaque session ID (not the actual token)
- Cleared on logout or 401 error

---

## Request Flow

### Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│              Complete API Request Flow                       │
└─────────────────────────────────────────────────────────────┘

1. USER ACTION
   User clicks button or page loads
   └─► Component calls API function

2. FRONTEND API CALL
   services/api.js function called
   ├─► Axios request interceptor adds X-Session-ID header
   ├─► Request sent to Flask backend
   └─► Example: GET /api/devices

3. BACKEND RECEIVES REQUEST
   Flask route handler receives request
   ├─► @require_session decorator validates session
   ├─► Checks session expiry
   ├─► Extends session timeout
   └─► Proceeds to route handler

4. TOKEN VALIDATION
   Route handler checks token
   ├─► TokenManager.get_access_token()
   ├─► If expired: Automatically refreshes
   └─► Returns valid token

5. ARUBA API CALL
   CentralAPIClient makes request
   ├─► Adds Authorization: Bearer {token}
   ├─► Makes HTTP request to Aruba Central
   └─► Handles response/errors

6. RESPONSE PROCESSING
   Response flows back through layers
   ├─► Aruba API returns JSON
   ├─► CentralAPIClient returns data
   ├─► Flask route returns JSON response
   └─► Axios receives response

7. FRONTEND UPDATE
   Component receives data
   ├─► Updates React state
   ├─► Re-renders component
   └─► User sees updated UI
```

### Example: Fetching Devices

```javascript
// 1. Frontend Component
const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  
  useEffect(() => {
    // 2. API Call
    deviceAPI.getAll()
      .then(data => setDevices(data))
      .catch(error => console.error(error));
  }, []);
  
  return <DeviceTable devices={devices} />;
};

// 3. API Service Layer
export const deviceAPI = {
  getAll: async () => {
    // Axios interceptor adds X-Session-ID header
    const response = await apiClient.get('/devices');
    return response.data;
  }
};

// 4. Backend Route Handler
@app.route('/api/devices', methods=['GET'])
@require_session
def get_devices():
    # Session validated by decorator
    # Token automatically refreshed if needed
    data = aruba_client.get('/monitoring/v1alpha1/devices')
    return jsonify(data)

// 5. Central API Client
def get(self, endpoint, params=None):
    # Ensures valid token
    self._ensure_valid_token()
    # Makes request with Bearer token
    response = self.session.get(url, params=params)
    return response.json()
```

---

## Frontend Architecture

### Component Hierarchy

```
App.jsx (Root)
├── Router
│   ├── SetupWizard (if credentials not configured)
│   ├── LoginPage (if not authenticated)
│   └── Authenticated Layout (if authenticated)
│       ├── Sidebar
│       │   ├── Navigation menu
│       │   └── Menu items
│       ├── TopBar
│       │   ├── Menu toggle
│       │   ├── Status indicator
│       │   └── User menu
│       └── Routes
│           ├── DashboardPage
│           │   ├── StatsCard components
│           │   └── System status
│           ├── DevicesPage
│           │   ├── Search/filter
│           │   └── Device table
│           ├── ClientsPage
│           ├── SitesPage
│           ├── APIExplorerPage
│           └── ... (other pages)
```

### State Management

**Local Component State:**
- Each page component manages its own state
- Uses React `useState` hook
- Data fetched on component mount (`useEffect`)

**Session State:**
- Stored in `localStorage` (session ID)
- Managed by `authAPI` service
- Checked on app initialization

**API State:**
- No global state management (Redux/Zustand)
- Each component fetches its own data
- Data refetched on mount or user action

### API Service Layer

The `services/api.js` file provides a clean abstraction:

```javascript
// Organized by feature
export const deviceAPI = { ... }
export const configAPI = { ... }
export const monitoringAPI = { ... }
export const authAPI = { ... }

// All functions:
// 1. Use axios instance (apiClient)
// 2. Automatically include session ID
// 3. Handle errors consistently
// 4. Return promise with data
```

### Routing

React Router handles client-side routing:

```javascript
// Public routes
/login - LoginPage
/setup-wizard - SetupWizard

// Protected routes (require authentication)
/ - DashboardPage
/devices - DevicesPage
/devices/:serial - DeviceDetailPage
/clients - ClientsPage
/api-explorer - APIExplorerPage
... (many more)
```

---

## Backend Architecture

### Route Organization

Routes in `app.py` are organized by feature:

```python
# Authentication Routes
/api/auth/login
/api/auth/logout
/api/auth/status

# Device Management
/api/devices
/api/devices/<serial>
/api/switches
/api/aps

# Configuration
/api/sites
/api/groups
/api/templates

# Monitoring
/api/monitoring/network-health
/api/monitoring/aps
/api/monitoring/switches

# Custom API Explorer
/api/explore

# System
/api/health
/api/setup/check
```

### Session Management

**In-Memory Storage (Development):**
```python
active_sessions = {
    "session_id_1": {
        "created": 1234567890.123,
        "expires": 1234571490.123  # +1 hour
    },
    "session_id_2": { ... }
}
```

**Session Decorator:**
```python
@require_session
def my_route():
    # Session automatically validated
    # Session expiry extended
    # Proceed with route logic
    pass
```

### Error Handling

**Centralized Error Handlers:**
```python
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500
```

**API Error Handling:**
```python
try:
    data = aruba_client.get(endpoint)
    return jsonify(data)
except requests.HTTPError as e:
    logger.error(f"API error: {e}")
    return jsonify({"error": "API request failed"}), e.response.status_code
```

---

## Data Flow

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Flow                                │
└─────────────────────────────────────────────────────────────┘

USER INTERACTION
    │
    ▼
REACT COMPONENT
    │ (calls API function)
    ▼
API SERVICE (api.js)
    │ (adds session header)
    ▼
AXIOS INTERCEPTOR
    │ (HTTP request)
    ▼
FLASK BACKEND
    │ (validates session)
    ▼
ROUTE HANDLER
    │ (checks token)
    ▼
TOKEN MANAGER
    │ (refreshes if needed)
    ▼
CENTRAL API CLIENT
    │ (adds Bearer token)
    ▼
ARUBA CENTRAL API
    │ (processes request)
    ▼
JSON RESPONSE
    │ (flows back)
    ▼
CENTRAL API CLIENT
    │
    ▼
ROUTE HANDLER
    │
    ▼
FLASK RESPONSE
    │
    ▼
AXIOS RESPONSE
    │
    ▼
API SERVICE
    │
    ▼
REACT COMPONENT
    │ (updates state)
    ▼
UI UPDATE
```

### Example: Real-Time Data Flow

**Dashboard Page Load:**

1. **Component Mounts**
   ```javascript
   useEffect(() => {
     fetchDashboardData();
   }, []);
   ```

2. **Multiple API Calls**
   ```javascript
   Promise.all([
     deviceAPI.getAll(),
     monitoringAPI.getNetworkHealth(),
     configAPI.getSites()
   ])
   ```

3. **Backend Processes**
   - Each request validated independently
   - Tokens shared (cached)
   - Parallel API calls to Aruba Central

4. **Response Aggregation**
   - All responses received
   - Component state updated
   - UI re-renders with data

---

## Error Handling

### Error Handling Strategy

**Frontend Error Handling:**

```javascript
// API Service Layer
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Session expired
      clearSessionId();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Component Level
try {
  const data = await deviceAPI.getAll();
  setDevices(data);
} catch (error) {
  setError(error.message);
  showNotification('Failed to load devices');
}
```

**Backend Error Handling:**

```python
# Route Level
try:
    data = aruba_client.get(endpoint)
    return jsonify(data)
except requests.HTTPError as e:
    if e.response.status_code == 401:
        # Token expired - will be refreshed on next request
        return jsonify({"error": "Authentication failed"}), 401
    elif e.response.status_code == 429:
        # Rate limit
        return jsonify({"error": "Rate limit exceeded"}), 429
    else:
        logger.error(f"API error: {e}")
        return jsonify({"error": "API request failed"}), e.response.status_code
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    return jsonify({"error": "Internal server error"}), 500
```

### Error Propagation

```
Aruba API Error
    │
    ▼
CentralAPIClient raises HTTPError
    │
    ▼
Flask route catches exception
    │
    ▼
Logs error (with details)
    │
    ▼
Returns sanitized JSON error
    │
    ▼
Axios receives error response
    │
    ▼
Frontend displays user-friendly message
```

---

## Deployment Process

### Docker Build Process

**Multi-Stage Dockerfile:**

```
Stage 1: Frontend Builder
├─ Node 18 Alpine
├─ Install npm dependencies
├─ Build React app (npm run build)
└─ Output: /app/frontend/build

Stage 2: Backend Builder
├─ Python 3.11 Slim
├─ Install system dependencies
├─ Create virtual environment
├─ Install Python packages
└─ Output: /opt/venv

Stage 3: Production
├─ Python 3.11 Slim
├─ Copy virtual environment
├─ Copy application code
├─ Copy built frontend
├─ Set permissions
└─ Run entrypoint script
```

### Container Startup

**Entrypoint Script (`docker-entrypoint.sh`):**

```bash
1. Wait for .env file (if needed)
2. Set up directories
3. Fix permissions
4. Start Flask app (gunicorn or flask run)
```

### Environment Configuration

**Configuration Sources (priority order):**

1. Environment variables (highest priority)
2. `.env` file
3. `config.yaml` file
4. Default values

**Required Variables:**
```env
ARUBA_BASE_URL=https://internal.api.central.arubanetworks.com
ARUBA_CLIENT_ID=your_client_id
ARUBA_CLIENT_SECRET=your_client_secret
ARUBA_CUSTOMER_ID=your_customer_id
```

### Health Checks

**Docker Health Check:**
```yaml
healthcheck:
  test: ["CMD", "python", "-c", "import requests; requests.get('http://localhost:1344/api/health', timeout=5)"]
  interval: 30s
  timeout: 10s
  retries: 3
```

**Health Endpoint:**
```python
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "aruba_client_initialized": aruba_client is not None
    })
```

---

## Security Model

### Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                               │
│ • HTTPS/TLS encryption                                  │
│ • Firewall rules                                        │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Application Gateway                            │
│ • Nginx reverse proxy (production)                      │
│ • SSL termination                                       │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Frontend Security                              │
│ • Content Security Policy                               │
│ • XSS protection (React)                                │
│ • No credential storage                                 │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Backend Security                               │
│ • Session validation                                    │
│ • Input validation                                      │
│ • CORS configuration                                    │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Authentication                                 │
│ • OAuth 2.0 (client credentials)                        │
│ • Secure session management                             │
│ • Token caching                                         │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 6: Data Security                                  │
│ • Credentials in environment variables                  │
│ • Token cache with expiry                               │
│ • No sensitive data logging                             │
└─────────────────────────────────────────────────────────┘
```

### Credential Flow

**Important:** Credentials flow in one direction only (downward). Frontend never sees credentials or API tokens.

```
.env file (Backend only)
    │
    ▼
TokenManager (Backend)
    │
    ▼
Token Cache (.token_cache_central.json)
    │
    ▼
CentralAPIClient (Backend)
    │
    ▼
Aruba Central API
    │
    ▼
Session ID (Opaque token)
    │
    ▼
Frontend (localStorage)
```

### Session Security

- **Session ID Generation**: Cryptographically secure (`secrets.token_urlsafe`)
- **Session Timeout**: 1 hour (3600 seconds)
- **Session Validation**: Every request validated
- **Session Extension**: Timeout extended on each request
- **Session Storage**: In-memory (dev) or Redis (production)

### Token Security

- **Token Storage**: File-based cache (backend only)
- **Token Expiry**: 2 hours (7200 seconds)
- **Token Refresh**: Automatic (5-minute buffer)
- **Token Transmission**: HTTPS only
- **Token Scope**: Never exposed to frontend

---

## Key Concepts Summary

### 1. **Separation of Concerns**
   - Frontend: UI and user interaction
   - Backend: Authentication and API proxy
   - Token Manager: OAuth 2.0 token lifecycle
   - API Client: HTTP communication with Aruba Central

### 2. **Security Model**
   - Credentials never leave backend
   - Session-based authentication
   - Automatic token refresh
   - Secure token caching

### 3. **Error Resilience**
   - Graceful error handling at all layers
   - User-friendly error messages
   - Automatic retry for token refresh
   - Optional endpoint handling

### 4. **Performance**
   - Token caching (2-hour expiry)
   - Session caching (1-hour timeout)
   - Parallel API calls where possible
   - Efficient React rendering

### 5. **Scalability**
   - Stateless backend design
   - Session storage can be externalized (Redis)
   - Horizontal scaling ready
   - Rate limit tracking

---

## Troubleshooting Guide

### Common Issues

**1. "Credentials not configured"**
- Check `.env` file exists and has correct values
- Verify Setup Wizard completed successfully
- Check file permissions on `.env`

**2. "Session expired"**
- Session timeout is 1 hour
- Re-authenticate by clicking "Connect to Aruba Central"
- Check backend logs for session validation errors

**3. "Token refresh failed"**
- Check network connectivity to HPE SSO
- Verify client_id and client_secret are correct
- Check token cache file permissions

**4. "API request failed"**
- Check Aruba Central API status
- Verify token is valid (check token cache)
- Review rate limiting (5000 calls/day limit)

**5. "Frontend not loading"**
- Verify frontend build exists (`dashboard/frontend/build`)
- Check Flask static folder configuration
- Verify React Router routes are correct

---

## Additional Resources

- [Architecture Documentation](../dashboard/ARCHITECTURE.md)
- [Configuration Guide](CONFIGURATION.md)
- [Setup Wizard Guide](SETUP_WIZARD_GUIDE.md)
- [API Documentation](../dashboard/README.md)
- [Docker Deployment](../DOCKER_DEPLOYMENT.md)

---

**Last Updated:** 2025-01-27
**Version:** 2.0.0

