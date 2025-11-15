/**
 * Alerts and Events Page
 * Monitor network alerts and system events
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert as MuiAlert,
  Button,
  Chip,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { alertsAPI } from '../services/api';

function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [alertsData, eventsData] = await Promise.allSettled([
        alertsAPI.getAll(),
        alertsAPI.getEvents(),
      ]);

      if (alertsData.status === 'fulfilled') {
        setAlerts(alertsData.value.alerts || alertsData.value.items || []);
      }

      if (eventsData.status === 'fulfilled') {
        setEvents(eventsData.value.events || eventsData.value.items || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load alerts and events');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return <ErrorIcon sx={{ color: '#f44336' }} />;
      case 'medium':
      case 'warning':
        return <WarningIcon sx={{ color: '#ff9800' }} />;
      case 'low':
      case 'info':
        return <InfoIcon sx={{ color: '#2196f3' }} />;
      default:
        return <InfoIcon sx={{ color: '#757575' }} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
      case 'warning':
        return 'warning';
      case 'low':
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Alerts & Events
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor network alerts and system events
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchData}>
          Refresh
        </Button>
      </Box>

      {error && (
        <MuiAlert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </MuiAlert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Alerts
                  </Typography>
                  <Typography variant="h4">{alerts.length}</Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Critical
                  </Typography>
                  <Typography variant="h4">
                    {alerts.filter(a => a.severity?.toLowerCase() === 'critical').length}
                  </Typography>
                </Box>
                <ErrorIcon sx={{ fontSize: 40, color: '#f44336' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Warnings
                  </Typography>
                  <Typography variant="h4">
                    {alerts.filter(a => a.severity?.toLowerCase() === 'warning').length}
                  </Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: '#ff9800' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Events
                  </Typography>
                  <Typography variant="h4">{events.length}</Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts and Events Tables */}
      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
            <Tab label={`Alerts (${alerts.length})`} />
            <Tab label={`Events (${events.length})`} />
          </Tabs>

          {tabValue === 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.length > 0 ? (
                    alerts.map((alert, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getSeverityIcon(alert.severity)}
                            <Chip
                              size="small"
                              label={alert.severity || 'N/A'}
                              color={getSeverityColor(alert.severity)}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>{alert.description || alert.message || 'N/A'}</TableCell>
                        <TableCell>{alert.device_name || alert.device || 'N/A'}</TableCell>
                        <TableCell>
                          {alert.timestamp ? new Date(alert.timestamp * 1000).toLocaleString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={alert.acknowledged ? 'Acknowledged' : 'Active'}
                            color={alert.acknowledged ? 'default' : 'warning'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No alerts found or endpoint not available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 1 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.length > 0 ? (
                    events.map((event, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip size="small" label={event.type || 'Event'} variant="outlined" />
                        </TableCell>
                        <TableCell>{event.description || event.message || 'N/A'}</TableCell>
                        <TableCell>{event.device_name || event.device || 'N/A'}</TableCell>
                        <TableCell>
                          {event.timestamp ? new Date(event.timestamp * 1000).toLocaleString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No events found or endpoint not available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default AlertsPage;
