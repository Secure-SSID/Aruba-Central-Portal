/**
 * Network Monitor Page
 * Comprehensive monitoring dashboard for all network devices
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Button,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WifiIcon from '@mui/icons-material/Wifi';
import RouterIcon from '@mui/icons-material/Router';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import SpeedIcon from '@mui/icons-material/Speed';
import PowerIcon from '@mui/icons-material/Power';
import { monitoringAPIv2 } from '../services/api';
import StatsCard from '../components/StatsCard';

function NetworkMonitorPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data states
  const [sitesHealth, setSitesHealth] = useState([]);
  const [topAPs, setTopAPs] = useState([]);
  const [apsMonitoring, setAPsMonitoring] = useState([]);
  const [switchesMonitoring, setSwitchesMonitoring] = useState([]);
  const [gatewaysMonitoring, setGatewaysMonitoring] = useState([]);
  const [topApps, setTopApps] = useState([]);
  const [firewallSessions, setFirewallSessions] = useState([]);
  const [idpsEvents, setIDPSEvents] = useState([]);

  useEffect(() => {
    fetchMonitoringData();

    // Auto-refresh every 30 seconds
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setError('');

      const results = await Promise.allSettled([
        monitoringAPIv2.getSitesDeviceHealth(),
        monitoringAPIv2.getTopAPsByBandwidth({ limit: 10 }),
        monitoringAPIv2.getAPsMonitoring({ limit: 20 }),
        monitoringAPIv2.getSwitchesMonitoring({ limit: 20 }),
        monitoringAPIv2.getGatewaysMonitoring(),
        monitoringAPIv2.getTopApplications({ limit: 10 }),
        monitoringAPIv2.getFirewallSessions({ limit: 20 }),
        monitoringAPIv2.getIDPSEvents({ limit: 20 }),
      ]);

      if (results[0].status === 'fulfilled') {
        // Handle device health response structure
        const deviceHealthData = results[0].value;
        const sites = deviceHealthData?.items || deviceHealthData?.sites || deviceHealthData?.data || [];
        setSitesHealth(sites);
      }
      if (results[1].status === 'fulfilled') {
        setTopAPs(results[1].value.aps || results[1].value.data || []);
      }
      if (results[2].status === 'fulfilled') {
        setAPsMonitoring(results[2].value.aps || results[2].value.data || []);
      }
      if (results[3].status === 'fulfilled') {
        setSwitchesMonitoring(results[3].value.switches || results[3].value.data || []);
      }
      if (results[4].status === 'fulfilled') {
        setGatewaysMonitoring(results[4].value.gateways || results[4].value.data || []);
      }
      if (results[5].status === 'fulfilled') {
        setTopApps(results[5].value.applications || results[5].value.data || []);
      }
      if (results[6].status === 'fulfilled') {
        setFirewallSessions(results[6].value.sessions || results[6].value.data || []);
      }
      if (results[7].status === 'fulfilled') {
        setIDPSEvents(results[7].value.events || results[7].value.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderSitesHealth = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Sites Health Status
        </Typography>
        {sitesHealth.length === 0 ? (
          <Typography color="text.secondary">No site data available</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Site Name</TableCell>
                  <TableCell>Health Score</TableCell>
                  <TableCell>Devices</TableCell>
                  <TableCell>Clients</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sitesHealth.map((site, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {site.site_name || site.name || `Site ${idx + 1}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={site.health_score || 0}
                          color={getHealthColor(site.health_score || 0)}
                          sx={{ width: 100, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="body2">
                          {site.health_score || 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{site.device_count || 0}</TableCell>
                    <TableCell>{site.client_count || 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={site.status || 'Unknown'}
                        size="small"
                        color={site.status === 'healthy' ? 'success' : 'warning'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderTopAPs = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Top Access Points by Bandwidth
        </Typography>
        {topAPs.length === 0 ? (
          <Typography color="text.secondary">No AP data available</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>AP Name</TableCell>
                  <TableCell>Serial</TableCell>
                  <TableCell>Bandwidth Usage</TableCell>
                  <TableCell>Clients</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topAPs.map((ap, idx) => (
                  <TableRow
                    key={idx}
                    hover
                    onClick={() => ap.serial && navigate(`/devices/${ap.serial}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {ap.name || ap.ap_name || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {ap.serial || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatBytes(ap.bandwidth_usage || ap.usage || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>{ap.client_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderAPMonitoring = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Access Points Status
        </Typography>
        {apsMonitoring.length === 0 ? (
          <Typography color="text.secondary">No monitoring data available</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Serial</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>CPU %</TableCell>
                  <TableCell>Memory %</TableCell>
                  <TableCell>Clients</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apsMonitoring.map((ap, idx) => (
                  <TableRow
                    key={idx}
                    hover
                    onClick={() => ap.serial && navigate(`/devices/${ap.serial}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {ap.name || ap.ap_name || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {ap.serial || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ap.status || 'Unknown'}
                        size="small"
                        color={ap.status === 'up' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ap.cpu_utilization || ap.cpu || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ap.memory_utilization || ap.memory || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>{ap.client_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderSwitchMonitoring = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Switches Status
        </Typography>
        {switchesMonitoring.length === 0 ? (
          <Typography color="text.secondary">No switch data available</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Serial</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>CPU %</TableCell>
                  <TableCell>Memory %</TableCell>
                  <TableCell>Ports</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {switchesMonitoring.map((sw, idx) => (
                  <TableRow
                    key={idx}
                    hover
                    onClick={() => sw.serial && navigate(`/devices/${sw.serial}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {sw.name || sw.switch_name || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {sw.serial || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sw.status || 'Unknown'}
                        size="small"
                        color={sw.status === 'up' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {sw.cpu_utilization || sw.cpu || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {sw.memory_utilization || sw.memory || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>{sw.port_count || sw.ports || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderTopApplications = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Top Applications by Bandwidth
        </Typography>
        {topApps.length === 0 ? (
          <Typography color="text.secondary">No application data available</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Application</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Bandwidth</TableCell>
                  <TableCell>Sessions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topApps.map((app, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {app.name || app.application || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={app.category || 'Other'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatBytes(app.bandwidth || app.usage || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>{app.sessions || app.session_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderIDPSEvents = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          IDPS Security Events
        </Typography>
        {idpsEvents.length === 0 ? (
          <Typography color="text.secondary">No IDPS events</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Source IP</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {idpsEvents.map((event, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(event.timestamp || Date.now()).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={event.severity || 'Info'}
                        size="small"
                        color={
                          event.severity === 'critical' ? 'error' :
                          event.severity === 'high' ? 'warning' : 'info'
                        }
                      />
                    </TableCell>
                    <TableCell>{event.event_type || event.type || 'Unknown'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {event.source_ip || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {event.description || event.message || 'No description'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Network Monitor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive real-time monitoring of your network infrastructure
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant={autoRefresh ? 'contained' : 'outlined'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="small"
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Stats Overview */}
      {!loading && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                title="Sites Monitored"
                value={sitesHealth.length}
                icon={StorageIcon}
                color="primary"
                subtitle={`${sitesHealth.filter(s => s.status === 'healthy').length} healthy`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                title="Access Points"
                value={apsMonitoring.length}
                icon={WifiIcon}
                color="info"
                subtitle={`${topAPs.length} high bandwidth`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                title="Switches"
                value={switchesMonitoring.length}
                icon={RouterIcon}
                color="success"
                subtitle="Active monitoring"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                title="Security Events"
                value={idpsEvents.length}
                icon={SecurityIcon}
                color="warning"
                subtitle="IDPS alerts"
              />
            </Grid>
          </Grid>

          {/* Tabbed Content */}
          <Card sx={{ mb: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                <Tab label="Sites Health" />
                <Tab label="Access Points" />
                <Tab label="Switches" />
                <Tab label="Applications" />
                <Tab label="Security" />
              </Tabs>
            </Box>
          </Card>

          {/* Tab Content */}
          {tabValue === 0 && renderSitesHealth()}
          {tabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>{renderTopAPs()}</Grid>
              <Grid item xs={12} md={6}>{renderAPMonitoring()}</Grid>
            </Grid>
          )}
          {tabValue === 2 && renderSwitchMonitoring()}
          {tabValue === 3 && renderTopApplications()}
          {tabValue === 4 && renderIDPSEvents()}
        </>
      )}
    </Box>
  );
}

export default NetworkMonitorPage;
