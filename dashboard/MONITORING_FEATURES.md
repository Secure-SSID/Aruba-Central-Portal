# Network Monitoring Features - Complete Guide

## 🎉 Overview

Your Aruba Central Portal now includes **40+ new monitoring API endpoints** and a comprehensive **Network Monitor dashboard** that provides real-time visibility into your entire network infrastructure.

---

## 📊 What's New

### Backend: 40+ New Monitoring API Endpoints

All endpoints are secured with session-based authentication and support flexible query parameters.

#### 1. **Site Health Monitoring**
Monitor the overall health of your sites:

```
GET /api/sites/health                  # List all sites with health metrics
GET /api/sites/{site_id}/health        # Individual site health details
```

**Features:**
- Health scores and status
- Device and client counts per site
- Aggregated site metrics

---

#### 2. **Access Points Monitoring (11 Endpoints)**

Comprehensive AP monitoring with performance metrics:

```
GET /api/monitoring/aps/top-bandwidth  # Top APs by bandwidth usage
GET /api/monitoring/aps                # List APs with monitoring data
GET /api/monitoring/aps/{serial}       # Detailed AP metrics

# Performance Metrics
GET /api/monitoring/aps/{serial}/cpu         # CPU utilization trends
GET /api/monitoring/aps/{serial}/memory      # Memory utilization trends
GET /api/monitoring/aps/{serial}/power       # Power consumption data
GET /api/monitoring/aps/{serial}/throughput  # Throughput trends

# Hardware Details
GET /api/monitoring/aps/{serial}/radios      # Radio information
GET /api/monitoring/aps/{serial}/radios/{radio_id}/channel-util  # Channel utilization
GET /api/monitoring/aps/{serial}/ports       # Port information
```

**Query Parameters:**
- `site_id` - Filter by site
- `limit` - Limit results (default: 20)
- `offset` - Pagination offset
- `interval` - Time interval for trends (5m, 1h, 1d)
- `duration` - Duration for trend data (1h, 24h, 7d)

**Use Cases:**
- Identify high-bandwidth APs
- Monitor CPU/memory usage for performance issues
- Track power consumption (PoE budget)
- Analyze channel utilization for optimization
- Monitor throughput trends

---

#### 3. **WLAN Monitoring (2 Endpoints)**

Monitor wireless networks:

```
GET /api/monitoring/wlans                    # List WLANs with monitoring data
GET /api/monitoring/wlans/{wlan_name}/throughput  # WLAN throughput trends
```

**Features:**
- WLAN bandwidth usage
- Client counts per WLAN
- Throughput trends over time

---

#### 4. **Switch Monitoring (5 Endpoints)**

Monitor your switches and their resources:

```
GET /api/monitoring/switches               # List switches with monitoring
GET /api/monitoring/switches/{serial}      # Detailed switch metrics
GET /api/monitoring/switches/{serial}/cpu     # CPU utilization
GET /api/monitoring/switches/{serial}/memory  # Memory utilization
GET /api/monitoring/switches/{serial}/ports   # Port monitoring data
```

**Features:**
- Real-time CPU and memory utilization
- Port status and statistics
- Switch health metrics
- Performance trends

---

#### 5. **Gateway Monitoring (3 Endpoints)**

Monitor gateways and VPN tunnels:

```
GET /api/monitoring/gateways               # List gateways with monitoring
GET /api/monitoring/gateways/{serial}      # Detailed gateway metrics
GET /api/monitoring/gateways/{serial}/tunnels  # Tunnel information
```

**Features:**
- Gateway performance metrics
- VPN tunnel status
- Bandwidth usage
- Active connections

---

#### 6. **Advanced Monitoring Features**

**Device Monitoring (Generic):**
```
GET /api/monitoring/devices  # All devices with monitoring data
```
Parameters: `site_id`, `device_type` (AP, SWITCH, GATEWAY)

**Client Monitoring:**
```
GET /api/monitoring/clients/{mac}/session  # Detailed client session info
```

**Firewall Sessions:**
```
GET /api/monitoring/firewall/sessions  # Active firewall sessions
```
Parameters: `gateway_serial`, `limit`

**IDPS (Intrusion Detection/Prevention):**
```
GET /api/monitoring/idps/events  # Security events
```
Parameters: `gateway_serial`, `severity` (critical, high, medium, low), `limit`

**Application Visibility:**
```
GET /api/monitoring/applications      # Application usage data
GET /api/monitoring/applications/top  # Top applications by bandwidth
```
Parameters: `site_id`, `limit`

**Swarms (AP Groups):**
```
GET /api/monitoring/swarms            # List of swarms
GET /api/monitoring/swarms/{swarm_id} # Swarm details
```
Parameters: `site_id`

---

## 🖥️ Frontend: Network Monitor Dashboard

### Access
Navigate to: **Monitoring → Network Monitor** in the sidebar
Or use the global search: Press `Cmd/Ctrl + K` and type "monitor"

### Features

#### 1. **Multi-Tab Interface**
Five comprehensive tabs:
- **Sites Health** - Site-wide health scores and status
- **Access Points** - AP performance and bandwidth usage
- **Switches** - Switch resource utilization
- **Applications** - Top applications by bandwidth
- **Security** - IDPS security events

#### 2. **Real-Time Auto-Refresh**
- Configurable auto-refresh (default: every 30 seconds)
- Manual refresh button
- Toggle auto-refresh ON/OFF

#### 3. **Interactive Stats Cards**
Four overview cards showing:
- Sites Monitored (with healthy count)
- Access Points (with high bandwidth count)
- Switches (with monitoring status)
- Security Events (IDPS alert count)

#### 4. **Detailed Tables**

**Sites Health Table:**
- Site name
- Health score with visual progress bar
- Device count
- Client count
- Status chip (healthy/warning/error)

**Top APs by Bandwidth:**
- AP name and serial
- Bandwidth usage (formatted MB/GB)
- Client count
- Click to view device details

**AP Status Monitoring:**
- AP name and serial
- Status (Up/Down)
- CPU utilization %
- Memory utilization %
- Client count
- Click to view device details

**Switch Status Monitoring:**
- Switch name and serial
- Status (Up/Down)
- CPU utilization %
- Memory utilization %
- Port count
- Click to view device details

**Top Applications:**
- Application name
- Category (with chips)
- Bandwidth usage
- Session count

**IDPS Security Events:**
- Timestamp
- Severity (Critical/High/Medium/Low)
- Event type
- Source IP
- Description

---

## 🔧 Frontend API Integration

### New Service: `monitoringAPIv2`

Located in: `dashboard/frontend/src/services/api.js`

**Usage Example:**

```javascript
import { monitoringAPIv2 } from '../services/api';

// Get sites health
const sites = await monitoringAPIv2.getSitesHealth();

// Get top APs by bandwidth
const topAPs = await monitoringAPIv2.getTopAPsByBandwidth({ limit: 10 });

// Get AP CPU utilization
const cpuData = await monitoringAPIv2.getAPCPU(serial, {
  interval: '5m',
  duration: '1h'
});

// Get top applications
const apps = await monitoringAPIv2.getTopApplications({
  site_id: 'YOUR_SITE_ID',
  limit: 10
});

// Get IDPS events
const events = await monitoringAPIv2.getIDPSEvents({
  severity: 'critical',
  limit: 20
});
```

**Available Methods:**
- `getSitesHealth()` / `getSiteHealth(siteId)`
- `getTopAPsByBandwidth(params)`
- `getAPsMonitoring(params)`
- `getAPMonitoringDetails(serial)`
- `getAPCPU(serial, params)` / `getAPMemory(serial, params)` / `getAPPower(serial, params)`
- `getAPThroughput(serial, params)`
- `getAPRadios(serial)` / `getRadioChannelUtil(serial, radioId, params)`
- `getAPPorts(serial)`
- `getWLANsMonitoring(params)` / `getWLANThroughput(wlanName, params)`
- `getSwitchesMonitoring(params)` / `getSwitchMonitoringDetails(serial)`
- `getSwitchCPU(serial, params)` / `getSwitchMemory(serial, params)`
- `getSwitchPorts(serial)`
- `getGatewaysMonitoring(params)` / `getGatewayMonitoringDetails(serial)`
- `getGatewayTunnels(serial)`
- `getDevicesMonitoring(params)`
- `getClientSession(mac)`
- `getFirewallSessions(params)`
- `getIDPSEvents(params)`
- `getApplications(params)` / `getTopApplications(params)`
- `getSwarms(params)` / `getSwarmDetails(swarmId)`

---

## 🎯 Use Cases

### 1. **Proactive Monitoring**
- Real-time visibility into network health
- Identify issues before they impact users
- Track performance trends over time

### 2. **Capacity Planning**
- Monitor resource utilization (CPU, memory)
- Identify high-bandwidth APs and switches
- Track application bandwidth usage

### 3. **Security Monitoring**
- Track IDPS security events
- Monitor firewall sessions
- Identify suspicious activity

### 4. **Performance Optimization**
- Identify overutilized APs
- Analyze channel utilization
- Optimize WLAN configurations

### 5. **Troubleshooting**
- Quickly identify problematic devices
- View detailed performance metrics
- Track client session information

---

## 🔒 Security & Authentication

All monitoring endpoints require:
- Valid session authentication
- `X-Session-ID` header automatically added by frontend
- Session timeout: 1 hour
- Automatic redirect to login on 401 errors

---

## 📈 Data Visualization

### Health Scores
- Visual progress bars (0-100%)
- Color-coded: Green (80-100%), Orange (50-79%), Red (0-49%)

### Bandwidth Usage
- Formatted as B, KB, MB, GB, TB
- Automatic unit conversion

### Status Indicators
- Color-coded chips: Success (green), Error (red), Warning (orange)

### Timestamps
- Relative time display ("5m ago", "2h ago", "3d ago")
- Full date for older entries

---

## 🚀 Getting Started

### 1. **Backend Setup**
The monitoring endpoints are already integrated into your Flask backend (`dashboard/backend/app.py`).

Ensure your Aruba Central API credentials have permissions for:
- Network monitoring API access
- Device monitoring
- Application visibility
- IDPS event access

### 2. **Frontend Access**
1. Start your dashboard: `cd dashboard/frontend && npm run dev`
2. Navigate to "Monitoring → Network Monitor"
3. Data will automatically refresh every 30 seconds

### 3. **Test the APIs**
Use the API Explorer page to test endpoints:
1. Go to "System → API Explorer"
2. Select GET method
3. Test any monitoring endpoint, e.g., `/monitoring/aps/top-bandwidth`

---

## 🔧 Configuration

### Auto-Refresh Interval
Default: 30 seconds
Location: `NetworkMonitorPage.jsx` line 42

```javascript
const interval = setInterval(fetchMonitoringData, 30000); // 30 seconds
```

### Query Parameters
Customize data retrieval:
```javascript
// Get last hour of data with 5-minute intervals
const params = {
  interval: '5m',
  duration: '1h'
};

// Limit results
const params = {
  limit: 20,
  offset: 0
};

// Filter by site
const params = {
  site_id: 'your-site-id'
};
```

---

## 📝 API Response Formats

### Example: Site Health Response
```json
{
  "sites": [
    {
      "site_id": "123",
      "site_name": "HQ Office",
      "health_score": 85,
      "device_count": 50,
      "client_count": 120,
      "status": "healthy"
    }
  ]
}
```

### Example: AP CPU Response
```json
{
  "serial": "ABC123",
  "cpu_utilization": [
    {
      "timestamp": "2025-11-07T10:00:00Z",
      "value": 45.2
    }
  ],
  "average": 42.5,
  "max": 67.8
}
```

### Example: IDPS Event Response
```json
{
  "events": [
    {
      "timestamp": "2025-11-07T10:15:30Z",
      "severity": "critical",
      "event_type": "intrusion_attempt",
      "source_ip": "192.168.1.100",
      "description": "SQL injection attempt detected"
    }
  ]
}
```

---

## 🐛 Troubleshooting

### No Data Displayed
1. Check your Aruba Central API credentials
2. Verify your account has monitoring API access
3. Check browser console for error messages
4. Verify backend is running: `http://localhost:1344/api/health`

### Authentication Errors
1. Re-login to refresh your session
2. Check session hasn't expired (1 hour timeout)
3. Verify credentials in backend `.env` file

### Slow Performance
1. Reduce auto-refresh interval
2. Limit the number of results (`limit` parameter)
3. Filter by specific site (`site_id` parameter)

---

## 🎨 Customization

### Add Custom Metrics
Edit `NetworkMonitorPage.jsx` to add new sections:

```javascript
const renderCustomMetric = () => (
  <Card>
    <CardContent>
      <Typography variant="h6">Custom Metric</Typography>
      {/* Your custom visualization */}
    </CardContent>
  </Card>
);
```

### Modify Table Columns
Edit the `TableHead` sections in `NetworkMonitorPage.jsx`:

```javascript
<TableHead>
  <TableRow>
    <TableCell>Your Column</TableCell>
    {/* Add more columns */}
  </TableRow>
</TableHead>
```

---

## 📊 Metrics Available

### Device Metrics
- CPU utilization (%)
- Memory utilization (%)
- Power consumption (Watts)
- Throughput (Mbps)
- Client count
- Port status

### Network Metrics
- Bandwidth usage
- Channel utilization
- Signal strength
- Packet loss
- Latency
- Jitter

### Security Metrics
- IDPS events
- Firewall sessions
- Failed auth attempts
- Security policy violations

### Application Metrics
- Application bandwidth
- Session counts
- Protocol distribution
- Category breakdown

---

## 🔄 Version History

**Version 2.0.0** (Current)
- Added 40+ monitoring API endpoints
- Created Network Monitor dashboard page
- Integrated real-time auto-refresh
- Added multi-tab interface
- Implemented interactive visualizations

**Version 1.0.0**
- Basic device management
- Simple dashboard
- Manual data refresh

---

## 📞 Support

For issues or questions:
- Check the main `README.md`
- Review `FEATURES.md` for UI features
- Check `CLAUDE.md` for development guidelines
- Review API documentation: https://developer.arubanetworks.com/new-central/reference

---

## 🎯 Future Enhancements

Potential additions:
- [ ] Historical trend charts (time-series visualizations)
- [ ] Alert threshold configuration
- [ ] Custom dashboard layouts
- [ ] Export monitoring data to CSV/JSON
- [ ] Email/Slack notifications for critical events
- [ ] Predictive analytics and anomaly detection
- [ ] Multi-site comparison views
- [ ] Custom metric widgets

---

**Powered by HPE Aruba Networking**
Dashboard Version: 2.0.0
Monitoring Features: Complete
