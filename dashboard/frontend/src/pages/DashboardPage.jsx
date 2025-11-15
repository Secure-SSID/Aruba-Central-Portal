/**
 * Main Dashboard Page
 * Displays network health, device statistics, and overview
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Link,
} from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import RouterIcon from '@mui/icons-material/Router';
import WifiIcon from '@mui/icons-material/Wifi';
import PeopleIcon from '@mui/icons-material/People';
import ApiIcon from '@mui/icons-material/Api';
import SpeedIcon from '@mui/icons-material/Speed';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { monitoringAPI, deviceAPI, getClients, rateLimitAPI } from '../services/api';

function StatsCard({ title, value, icon: Icon, color, loading, trend, trendValue, subtitle, onClick }) {
  // Map theme color names to actual colors
  const colorMap = {
    'primary': '#FF6600',
    'info': '#2196f3',
    'success': '#4caf50',
    'warning': '#FF6600',
    'error': '#f44336',
  };

  const actualColor = colorMap[color] || '#FF6600';

  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${actualColor}15 0%, ${actualColor}05 100%)`,
        border: `1px solid ${actualColor}30`,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        } : {},
        transition: 'all 0.3s ease',
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={30} />
            ) : (
              <Typography variant="h3" sx={{ fontWeight: 700, color: actualColor }}>
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" display="block">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              backgroundColor: `${actualColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {Icon && <Icon sx={{ fontSize: 32, color: actualColor }} />}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  console.log('DashboardPage rendering...');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalDevices: 0,
    switches: 0,
    accessPoints: 0,
    gateways: 0,
    clients: 0,
  });
  const [rateLimit, setRateLimit] = useState(null);
  const [previousStats, setPreviousStats] = useState(null);

  useEffect(() => {
    console.log('DashboardPage useEffect running...');
    fetchDashboardData();
    fetchRateLimitData();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchRateLimitData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRateLimitData = async () => {
    try {
      const data = await rateLimitAPI.getStatus();
      setRateLimit(data);
    } catch (err) {
      console.error('Failed to fetch rate limit data:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setError('');

      // Fetch data in parallel - use site-specific client data
      const SITE_ID = '54819475093'; // Default site
      const [healthData, clientsData, devicesData] = await Promise.allSettled([
        monitoringAPI.getNetworkHealth(),
        getClients(SITE_ID),
        deviceAPI.getAll(),
      ]);

      const newStats = { ...stats };

      // Process health data
      if (healthData.status === 'fulfilled') {
        newStats.totalDevices = healthData.value.total_devices || 0;
        newStats.switches = healthData.value.switches || 0;
        newStats.accessPoints = healthData.value.access_points || 0;
      }

      // Process clients data - use 'total' for accurate count
      if (clientsData.status === 'fulfilled') {
        newStats.clients = clientsData.value.total || clientsData.value.count || clientsData.value.items?.length || 0;
      }

      // Process devices data for detailed breakdown
      if (devicesData.status === 'fulfilled') {
        const devices = devicesData.value.items || [];

        if (newStats.totalDevices === 0) {
          newStats.totalDevices = devices.length;
        }

        // Count device types
        const deviceCounts = devices.reduce((acc, device) => {
          const type = device.deviceType || 'UNKNOWN';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        newStats.switches = deviceCounts.SWITCH || 0;
        newStats.accessPoints = deviceCounts.AP || deviceCounts.IAP || deviceCounts.ACCESS_POINT || 0;
        newStats.gateways = deviceCounts.GATEWAY || 0;
      }

      // Calculate trends
      if (!previousStats) {
        setPreviousStats(newStats);
      } else {
        setPreviousStats(stats);
      }

      setStats(newStats);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'flat';
  };

  const getTrendValue = (current, previous) => {
    if (!previous || previous === 0) return null;
    const diff = current - previous;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}`;
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Network Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time overview of your Aruba Central network infrastructure
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Total Devices"
            value={loading ? '...' : stats.totalDevices}
            icon={DevicesIcon}
            color="primary"
            trend={previousStats ? getTrend(stats.totalDevices, previousStats.totalDevices) : null}
            trendValue={previousStats ? getTrendValue(stats.totalDevices, previousStats.totalDevices) : null}
            subtitle="View all devices"
            onClick={() => navigate('/devices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Switches"
            value={loading ? '...' : stats.switches}
            icon={RouterIcon}
            color="info"
            trend={previousStats ? getTrend(stats.switches, previousStats.switches) : null}
            trendValue={previousStats ? getTrendValue(stats.switches, previousStats.switches) : null}
            subtitle="Network switches"
            onClick={() => navigate('/devices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Access Points"
            value={loading ? '...' : stats.accessPoints}
            icon={WifiIcon}
            color="primary"
            trend={previousStats ? getTrend(stats.accessPoints, previousStats.accessPoints) : null}
            trendValue={previousStats ? getTrendValue(stats.accessPoints, previousStats.accessPoints) : null}
            subtitle="Wireless APs"
            onClick={() => navigate('/devices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Connected Clients"
            value={loading ? '...' : stats.clients}
            icon={PeopleIcon}
            color="success"
            trend={previousStats ? getTrend(stats.clients, previousStats.clients) : null}
            trendValue={previousStats ? getTrendValue(stats.clients, previousStats.clients) : null}
            subtitle="Active connections"
            onClick={() => navigate('/clients')}
          />
        </Grid>
      </Grid>

      {/* Client Count Note */}
      {stats.clients === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No clients are currently connected. Visit the <strong>Clients</strong> page to view detailed client information by site.
        </Alert>
      )}

      {/* Device Type Breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Device Type Breakdown
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(255, 102, 0, 0.1)', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">Switches</Typography>
                <Typography variant="h6" sx={{ color: '#FF6600' }}>{stats.switches}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(255, 102, 0, 0.1)', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">Access Points</Typography>
                <Typography variant="h6" sx={{ color: '#FF6600' }}>{stats.accessPoints}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'rgba(255, 102, 0, 0.1)', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">Gateways</Typography>
                <Typography variant="h6" sx={{ color: '#FF6600' }}>{stats.gateways}</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* API Usage and System Status */}
      <Grid container spacing={3}>
        {/* API Rate Limit Widget */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ApiIcon />
                  <Typography variant="h6">
                    API Usage
                  </Typography>
                </Box>
                <Tooltip title="Based on Aruba Central default limits: 5000 calls/day, 7 calls/second">
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>

              {rateLimit ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Daily Calls */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Daily API Calls
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {rateLimit.daily_calls} / {rateLimit.daily_limit}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(rateLimit.daily_percentage, 100)}
                      color={rateLimit.daily_percentage > 80 ? 'error' : rateLimit.daily_percentage > 60 ? 'warning' : 'success'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {rateLimit.calls_remaining} calls remaining • Resets in {rateLimit.reset_in_hours}h {rateLimit.reset_in_minutes}m
                    </Typography>
                  </Box>

                  {/* Current Rate */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        Current Rate
                      </Typography>
                    </Box>
                    <Chip
                      label={`${rateLimit.current_rate_per_second}/${rateLimit.per_second_limit} calls/sec`}
                      size="small"
                      color={rateLimit.current_rate_per_second >= rateLimit.per_second_limit ? 'error' : 'default'}
                    />
                  </Box>

                  {/* Documentation Link */}
                  <Link
                    href="https://developer.arubanetworks.com/aruba-central/docs/api-getting-started#rate-limiting"
                    target="_blank"
                    rel="noopener"
                    variant="caption"
                    sx={{ display: 'block', textAlign: 'center' }}
                  >
                    View Rate Limiting Documentation
                  </Link>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* System Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    API Connection
                  </Typography>
                  <Chip label="Connected" size="small" color="success" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {new Date().toLocaleTimeString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Auto-refresh
                  </Typography>
                  <Chip label="30s" size="small" variant="outlined" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Base URL
                  </Typography>
                  <Tooltip title="Click Settings to verify your regional cluster">
                    <Chip label="Configured" size="small" variant="outlined" />
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Navigate to different sections to manage your network:
                </Typography>
                <Typography variant="body2">
                  • View and manage all network devices
                </Typography>
                <Typography variant="body2">
                  • Configure network settings and templates
                </Typography>
                <Typography variant="body2">
                  • Manage user access and permissions
                </Typography>
                <Typography variant="body2">
                  • Explore API endpoints directly
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardPage;
