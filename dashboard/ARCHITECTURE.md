# Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React Application                       │  │
│  │                     (Port 3000)                           │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │  Dashboard   │  │   Devices    │  │    Users     │   │  │
│  │  │     Page     │  │     Page     │  │     Page     │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │    Config    │  │ API Explorer │  │   Sidebar    │   │  │
│  │  │     Page     │  │     Page     │  │   & TopBar   │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                            │  │
│  │                  ┌──────────────┐                         │  │
│  │                  │   API.js     │                         │  │
│  │                  │  (Service    │                         │  │
│  │                  │   Layer)     │                         │  │
│  │                  └──────────────┘                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ HTTP Requests                       │
│                            │ (Session ID in header)              │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Flask Backend Server                        │
│                        (Port 5000)                               │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   API Endpoints                            │  │
│  │                                                            │  │
│  │  /api/auth/login        POST  - Create session            │  │
│  │  /api/auth/logout       POST  - Destroy session           │  │
│  │  /api/auth/status       GET   - Check auth status         │  │
│  │                                                            │  │
│  │  /api/devices           GET   - Get all devices           │  │
│  │  /api/devices/<serial>  GET   - Get device details        │  │
│  │  /api/switches          GET   - Get switches              │  │
│  │  /api/aps               GET   - Get access points         │  │
│  │                                                            │  │
│  │  /api/sites             GET   - Get sites                 │  │
│  │  /api/groups            GET   - Get groups                │  │
│  │  /api/templates         GET   - Get templates             │  │
│  │                                                            │  │
│  │  /api/users             GET   - Get users                 │  │
│  │                                                            │  │
│  │  /api/monitoring/       GET   - Network health            │  │
│  │      network-health                                        │  │
│  │                                                            │  │
│  │  /api/explore           POST  - Execute custom API call   │  │
│  │                                                            │  │
│  │  /api/health            GET   - Health check              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Session Management                            │  │
│  │                                                            │  │
│  │  active_sessions = {                                      │  │
│  │    "session_id": {                                        │  │
│  │      "created": timestamp,                                │  │
│  │      "expires": timestamp + 3600                          │  │
│  │    }                                                       │  │
│  │  }                                                         │  │
│  │                                                            │  │
│  │  @require_session decorator validates all requests        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         CentralAPIClient + TokenManager (utils/)          │  │
│  │                                                            │  │
│  │  • OAuth 2.0 client credentials via HPE SSO               │  │
│  │  • Token caching (2-hour expiry, 5-min buffer)            │  │
│  │  • Automatic token refresh                                │  │
│  │  • 429 retry with exponential backoff                     │  │
│  │  • HTTP methods: GET, POST, PUT, PATCH, DELETE            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ HTTPS (OAuth 2.0)                   │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               HPE Aruba Networking Central API                   │
│                                                                   │
│  Regional Endpoints:                                             │
│  • US East:    apigw-prod2.central.arubanetworks.com            │
│  • US West:    apigw-uswest4.central.arubanetworks.com          │
│  • Europe:     apigw-eucentral3.central.arubanetworks.com       │
│  • APAC:       apigw-apeast1.central.arubanetworks.com          │
│                                                                   │
│  API Categories:                                                 │
│  • /monitoring/v1/*       - Device monitoring & status          │
│  • /configuration/v1/*    - Configuration management            │
│  • /central/v2/*          - Site management                     │
│  • /platform/*            - User & RBAC management              │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Authentication Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Browser │                    │  Flask  │                    │  Aruba  │
│ (React) │                    │ Backend │                    │ Central │
└─────────┘                    └─────────┘                    └─────────┘
     │                              │                              │
     │ 1. Click "Connect"           │                              │
     ├─────────────────────────────►│                              │
     │                              │                              │
     │                              │ 2. Check for cached token    │
     │                              │    (from utils/token_cache)  │
     │                              │                              │
     │                              │ 3. If no token: Authenticate │
     │                              ├─────────────────────────────►│
     │                              │                              │
     │                              │    Step 1: Login             │
     │                              ├─────────────────────────────►│
     │                              │◄─────────────────────────────┤
     │                              │    (Session + CSRF token)    │
     │                              │                              │
     │                              │    Step 2: Get auth code     │
     │                              ├─────────────────────────────►│
     │                              │◄─────────────────────────────┤
     │                              │    (Authorization code)      │
     │                              │                              │
     │                              │    Step 3: Exchange for token│
     │                              ├─────────────────────────────►│
     │                              │◄─────────────────────────────┤
     │                              │    (Access token + refresh)  │
     │                              │                              │
     │                              │ 4. Cache token               │
     │                              │    (.token_cache.json)       │
     │                              │                              │
     │                              │ 5. Generate session ID       │
     │                              │    (secrets.token_urlsafe)   │
     │                              │                              │
     │ 6. Return session ID         │                              │
     │◄─────────────────────────────┤                              │
     │                              │                              │
     │ 7. Store in sessionStorage   │                              │
     │                              │                              │
```

### API Request Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Browser │                    │  Flask  │                    │  Aruba  │
│ (React) │                    │ Backend │                    │ Central │
└─────────┘                    └─────────┘                    └─────────┘
     │                              │                              │
     │ 1. API request               │                              │
     │    (with Session ID header)  │                              │
     ├─────────────────────────────►│                              │
     │                              │                              │
     │                              │ 2. Validate session          │
     │                              │    (@require_session)        │
     │                              │                              │
     │                              │ 3. Check session expiry      │
     │                              │    (expires > current time)  │
     │                              │                              │
     │                              │ 4. Forward to Aruba Client   │
     │                              │    (with cached token)       │
     │                              ├─────────────────────────────►│
     │                              │                              │
     │                              │ 5. API response              │
     │                              │◄─────────────────────────────┤
     │                              │                              │
     │                              │ 6. Update session expiry     │
     │                              │    (refresh timeout)         │
     │                              │                              │
     │ 7. Return response           │                              │
     │◄─────────────────────────────┤                              │
     │                              │                              │
```

### Token Refresh Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│  Flask  │                    │  Token  │                    │  Aruba  │
│ Backend │                    │  Cache  │                    │ Central │
└─────────┘                    └─────────┘                    └─────────┘
     │                              │                              │
     │ 1. Check token cache         │                              │
     ├─────────────────────────────►│                              │
     │                              │                              │
     │ 2. Token expired?            │                              │
     │◄─────────────────────────────┤                              │
     │                              │                              │
     │ 3. Use refresh token         │                              │
     ├──────────────────────────────┼─────────────────────────────►│
     │                              │                              │
     │ 4. New access token          │                              │
     │◄─────────────────────────────┼──────────────────────────────┤
     │                              │                              │
     │ 5. Update cache              │                              │
     ├─────────────────────────────►│                              │
     │    (2-hour expiry)           │                              │
     │                              │                              │
```

## Component Architecture

### Frontend Component Hierarchy

```
App.jsx (Root)
├── Router
│   ├── LoginPage
│   │   └── Login form with branded UI
│   │
│   └── Authenticated Layout
│       ├── Sidebar
│       │   └── Navigation menu
│       │
│       ├── TopBar
│       │   ├── Menu toggle
│       │   ├── Status indicator
│       │   └── User menu
│       │
│       └── Routes
│           ├── DashboardPage
│           │   ├── StatCard (x4)
│           │   ├── System status card
│           │   └── Quick actions card
│           │
│           ├── DevicesPage
│           │   ├── Search bar
│           │   ├── Tabs (All/Switches/APs)
│           │   └── Device table
│           │
│           ├── ConfigurationPage
│           │   ├── Tabs (Sites/Groups/Templates)
│           │   └── Configuration tables
│           │
│           ├── UsersPage
│           │   ├── Search bar
│           │   └── User table
│           │
│           └── APIExplorerPage
│               ├── Common endpoints
│               ├── Request configuration
│               │   ├── Method selector
│               │   ├── Endpoint input
│               │   ├── Query params
│               │   └── Request body
│               └── Response display
```

### Backend Module Architecture

```
app.py (Flask Application)
├── Configuration
│   ├── CORS setup
│   ├── Logging configuration
│   └── Session management
│
├── Initialization
│   └── init_central_client()
│       ├── Load config (from utils/)
│       ├── Create TokenManager + CentralAPIClient
│       └── Token automatically cached/refreshed
│
├── Middleware
│   └── @require_session decorator
│       ├── Validate session ID
│       ├── Check expiry
│       └── Refresh timeout
│
├── Authentication Routes
│   ├── POST /api/auth/login
│   ├── POST /api/auth/logout
│   └── GET /api/auth/status
│
├── Device Routes
│   ├── GET /api/devices
│   ├── GET /api/devices/<serial>
│   ├── GET /api/switches
│   └── GET /api/aps
│
├── Configuration Routes
│   ├── GET /api/sites
│   ├── GET /api/groups
│   └── GET /api/templates
│
├── User Routes
│   └── GET /api/users
│
├── Monitoring Routes
│   └── GET /api/monitoring/network-health
│
├── Explorer Routes
│   └── POST /api/explore
│
└── System Routes
    ├── GET /api/health
    └── Error handlers (404, 500)
```

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                               │
│ • HTTPS/TLS encryption                                  │
│ • Firewall rules                                        │
│ • DDoS protection                                       │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Application Gateway                            │
│ • Nginx reverse proxy                                   │
│ • SSL termination                                       │
│ • Request rate limiting                                 │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Frontend Security                              │
│ • Content Security Policy                               │
│ • XSS protection (React)                                │
│ • CSRF protection                                       │
│ • No credential storage                                 │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Backend Security                               │
│ • Session validation                                    │
│ • Input validation                                      │
│ • Error sanitization                                    │
│ • CORS configuration                                    │
└─────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Authentication                                 │
│ • OAuth 2.0 (client credentials)                        │
│ • Secure session management                             │
│ • Token caching                                         │
│ • Automatic token refresh                               │
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

```
┌──────────────────────────────────────────────────────┐
│                  Credential Storage                   │
│                                                       │
│  .env file (Backend server only)                     │
│  ├── ARUBA_CLIENT_ID                                 │
│  ├── ARUBA_CLIENT_SECRET                             │
│  ├── ARUBA_CUSTOMER_ID                               │
│  └── ARUBA_BASE_URL                                  │
│                                                       │
│  • Never committed to Git (.gitignore)               │
│  • Read-only file permissions (600)                  │
│  • Loaded via python-dotenv                          │
└──────────────────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────┐
│              Token Generation & Caching               │
│                                                       │
│  .token_cache.json (Backend server only)             │
│  ├── access_token                                    │
│  ├── refresh_token                                   │
│  └── expires_at (timestamp)                          │
│                                                       │
│  • 2-hour expiry with 5-min buffer                   │
│  • Automatic refresh                                 │
│  • Never exposed to frontend                         │
└──────────────────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────┐
│                Session Management                     │
│                                                       │
│  active_sessions dict (Backend memory)               │
│  └── session_id: {created, expires}                  │
│                                                       │
│  • Cryptographically secure ID                       │
│  • 1-hour expiry                                     │
│  • Sent to frontend as opaque token                 │
└──────────────────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────┐
│               Frontend Session Storage                │
│                                                       │
│  sessionStorage (Browser)                            │
│  └── session_id (opaque token)                       │
│                                                       │
│  • Cleared on browser close                          │
│  • No sensitive data                                 │
│  • Used for API authentication only                  │
└──────────────────────────────────────────────────────┘

IMPORTANT: Credentials flow one direction only (down).
           Frontend never sees credentials or API tokens.
```

## Deployment Architecture

### Development Environment

```
┌────────────────────────────────────────┐
│         Developer Machine              │
│                                        │
│  ┌─────────────┐    ┌──────────────┐  │
│  │   Vite      │    │    Flask     │  │
│  │   Dev       │    │  Development │  │
│  │  Server     │    │    Server    │  │
│  │ :3000       │    │    :5000     │  │
│  └─────────────┘    └──────────────┘  │
│         │                   │          │
│         └───────┬───────────┘          │
│                 │                      │
│      ┌──────────▼─────────┐           │
│      │   .env file        │           │
│      │  (credentials)     │           │
│      └────────────────────┘           │
└────────────────────────────────────────┘
```

### Production Environment

```
┌──────────────────────────────────────────────────────┐
│                    Internet                          │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                  Nginx (Port 443)                    │
│  • SSL/TLS Termination                               │
│  • Static file serving                               │
│  • Reverse proxy for API                             │
│  • Security headers                                  │
└──────────────────────┬───────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Static Files   │         │  Gunicorn       │
│  (React Build)  │         │  (Port 5000)    │
│                 │         │  • 4 workers    │
│  /usr/share/    │         │  • Flask app    │
│  nginx/html/    │         └────────┬────────┘
└─────────────────┘                  │
                                     ▼
                          ┌─────────────────┐
                          │  Redis          │
                          │  (Sessions)     │
                          │  • Port 6379    │
                          └─────────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Environment Vars    │
                          │  • From secrets mgr  │
                          │  • Or systemd env    │
                          └──────────────────────┘
```

## State Management

### Frontend State Flow

```
Component Mount
    ↓
useEffect Hook
    ↓
API Call (via services/api.js)
    ↓
Axios Request
    ↓
Add Session ID Header (interceptor)
    ↓
Send to Backend
    ↓
Receive Response
    ↓
Handle 401 (interceptor) → Redirect to Login
    ↓
Update Component State (useState)
    ↓
Re-render Component
```

### Backend Session State

```
Login Request
    ↓
Initialize Aruba Client
    ↓
Load Cached Token (if exists & valid)
    OR
    Authenticate with Aruba Central
    ↓
Generate Session ID
    ↓
Store in active_sessions dict
    {
      session_id: {
        created: timestamp,
        expires: timestamp + 3600
      }
    }
    ↓
Return Session ID to Frontend
    ↓
Subsequent Requests
    ↓
Validate Session (@require_session)
    ↓
Check Expiry
    ↓
Refresh Timeout (extend by 1 hour)
    ↓
Process Request
```

## Error Handling

### Error Propagation

```
Backend API Error
    ↓
Aruba Client raises HTTPError
    ↓
Flask route catches exception
    ↓
Log error (with details)
    ↓
Sanitize error message
    ↓
Return generic JSON error
    {
      "error": "Failed to fetch devices"
    }
    ↓
Axios receives error response
    ↓
Frontend displays user-friendly alert
```

## Performance Optimizations

### Caching Strategy

```
┌────────────────────────────────────┐
│       Token Cache (Backend)        │
│  • 2-hour cache                    │
│  • Reduces auth API calls          │
│  • File-based persistence          │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│      Session Cache (Backend)       │
│  • In-memory (development)         │
│  • Redis (production)              │
│  • 1-hour timeout                  │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│    Component State (Frontend)      │
│  • React useState                  │
│  • Local to each component         │
│  • Re-fetched on mount             │
└────────────────────────────────────┘
```

### Build Optimization

```
Frontend Build Process (Vite)
    ↓
Code Splitting
    ↓
Tree Shaking (remove unused code)
    ↓
Minification
    ↓
Asset Optimization (images, fonts)
    ↓
Gzip Compression
    ↓
Output to build/ directory
```

---

This architecture provides:
- **Scalability**: Stateless design with external session storage
- **Security**: Multi-layered defense in depth
- **Maintainability**: Clear separation of concerns
- **Performance**: Caching at multiple levels
- **Reliability**: Error handling at every layer
