/**
 * Main Dashboard Page
 * Displays network health, device statistics, and overview
 * Optimized for faster loading with caching and optimistic UI
 */

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
  Skeleton,
} from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import RouterIcon from '@mui/icons-material/Router';
import WifiIcon from '@mui/icons-material/Wifi';
import PeopleIcon from '@mui/icons-material/People';
import ApiIcon from '@mui/icons-material/Api';
import SpeedIcon from '@mui/icons-material/Speed';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { monitoringAPI, deviceAPI, getClients, rateLimitAPI, sitesConfigAPI } from '../services/api';

// Cache keys
const CACHE_KEYS = {
  STATS: 'dashboard_stats',
  RATE_LIMIT: 'dashboard_rate_limit',
};

// Cache expiration (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Cache utility functions
 */
const cacheUtils = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },
  set: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch {
      // Ignore storage errors
    }
  },
};

/**
 * Memoized StatsCard component to prevent unnecessary re-renders
 */
const StatsCard = memo(function StatsCard({ title, value, icon: Icon, color, loading, trend, trendValue, subtitle, onClick }) {
  // Map theme color names to actual colors
  const colorMap = useMemo(() => ({
    'primary': '#FF6600',
    'info': '#2196f3',
    'success': '#4caf50',
    'warning': '#FF6600',
    'error': '#f44336',
  }), []);

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
              <Skeleton variant="text" width={60} height={60} />
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
});

function DashboardPage() {
  const navigate = useNavigate();
  
  // Load cached data immediately for optimistic UI
  const cachedStats = cacheUtils.get(CACHE_KEYS.STATS);
  const cachedRateLimit = cacheUtils.get(CACHE_KEYS.RATE_LIMIT);
  
  const [loading, setLoading] = useState(!cachedStats);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Always start with 0, then update when data loads
  const [stats, setStats] = useState({
    totalDevices: 0,
    switches: 0,
    accessPoints: 0,
    gateways: 0,
    clients: 0,
  });
  // Cache the last known values to show while loading
  const [cachedDisplayStats, setCachedDisplayStats] = useState(cachedStats || {
    totalDevices: 0,
    switches: 0,
    accessPoints: 0,
    gateways: 0,
    clients: 0,
  });
  const [rateLimit, setRateLimit] = useState(cachedRateLimit);
  const [previousStats, setPreviousStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(cachedStats ? new Date() : null);

  // Request timeout helper
  const withTimeout = useCallback((promise, timeoutMs = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  }, []);

  // Fetch client count - try monitoring API first, then aggregate from all sites
  // Only count clients with status "connected"
  const fetchClientsCount = useCallback(async () => {
    try {
      // Try monitoring API first (fastest)
      const clientsResponse = await withTimeout(getClients(), 5000);
      
      if (clientsResponse) {
        // Check if this is the "monitoring endpoint not available" response
        if (clientsResponse.count === 0 && (!clientsResponse.items || clientsResponse.items.length === 0) && clientsResponse.message) {
          // Monitoring endpoint not available, fall through to site aggregation
          throw new Error('Monitoring clients endpoint not available');
        }
        
        let clientsArray = [];
        if (Array.isArray(clientsResponse)) {
          clientsArray = clientsResponse;
        } else if (clientsResponse.items && Array.isArray(clientsResponse.items)) {
          clientsArray = clientsResponse.items;
        } else if (clientsResponse.count !== undefined && clientsResponse.count > 0) {
          // If we only have count, we can't filter by status, so return 0
          // (we need the actual items to filter)
          throw new Error('Need items array to filter by status');
        } else if (clientsResponse.total !== undefined && clientsResponse.total > 0) {
          throw new Error('Need items array to filter by status');
        }
        
        // Filter to only connected clients
        const connectedClients = clientsArray.filter(client => 
          client.status?.toLowerCase() === 'connected'
        );
        
        if (connectedClients.length > 0 || clientsArray.length === 0) {
          return connectedClients.length;
        }
      }
      
      // If we got here, response was empty - try aggregating from sites
      throw new Error('Monitoring API returned empty result');
    } catch (err) {
      // If monitoring API fails, aggregate from all sites
      console.warn('Monitoring API unavailable, aggregating from sites:', err.message);
      
      try {
        // Get all sites
        const sitesData = await withTimeout(sitesConfigAPI.getSites({ limit: 100, offset: 0 }), 5000);
        
        let sitesList = [];
        if (Array.isArray(sitesData)) {
          sitesList = sitesData;
        } else if (sitesData && typeof sitesData === 'object') {
          sitesList = sitesData.items || sitesData.data || sitesData.sites || [];
        }
        
        if (sitesList.length === 0) {
          return 0;
        }
        
        // Get site IDs
        const siteIds = sitesList.map(site => site.scopeId || site.id || site.siteId || site.site_id).filter(Boolean);
        
        if (siteIds.length === 0) {
          return 0;
        }
        
        // Fetch clients from all sites in parallel with timeout
        const clientPromises = siteIds.map(siteId => 
          withTimeout(getClients(siteId), 3000).catch(() => ({ items: [], count: 0, total: 0 }))
        );
        
        const clientsResults = await Promise.allSettled(clientPromises);
        
        // Aggregate total count - only count connected clients
        let totalCount = 0;
        clientsResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const clientData = result.value;
            let itemsArray = [];
            if (Array.isArray(clientData)) {
              itemsArray = clientData;
            } else if (clientData?.items && Array.isArray(clientData.items)) {
              itemsArray = clientData.items;
            }
            
            // Filter to only connected clients
            const connectedClients = itemsArray.filter(client => 
              client.status?.toLowerCase() === 'connected'
            );
            totalCount += connectedClients.length;
          }
        });
        
        return totalCount;
      } catch (aggregateErr) {
        console.warn('Failed to aggregate clients from sites:', aggregateErr.message);
        return 0;
      }
    }
  }, [withTimeout]);

  const fetchRateLimitData = useCallback(async () => {
    try {
      const data = await withTimeout(rateLimitAPI.getStatus(), 5000);
      setRateLimit(data);
      cacheUtils.set(CACHE_KEYS.RATE_LIMIT, data);
    } catch (err) {
      // Don't show error for rate limit - it's non-critical
      console.warn('Failed to fetch rate limit data:', err.message);
    }
  }, [withTimeout]);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      setError('');

      // Fetch critical data in parallel with timeouts
      const [healthData, devicesData] = await Promise.allSettled([
        withTimeout(monitoringAPI.getNetworkHealth(), 8000),
        withTimeout(deviceAPI.getAll(), 10000),
      ]);

      const newStats = {
        totalDevices: 0,
        switches: 0,
        accessPoints: 0,
        gateways: 0,
        clients: 0,
      };

      // Process health data (fastest source)
      if (healthData.status === 'fulfilled') {
        newStats.totalDevices = healthData.value.total_devices || 0;
        newStats.switches = healthData.value.switches || 0;
        newStats.accessPoints = healthData.value.access_points || 0;
      }

      // Process devices data for detailed breakdown (fallback if health data missing)
      if (devicesData.status === 'fulfilled') {
        const devices = devicesData.value.items || [];

        if (newStats.totalDevices === 0) {
          newStats.totalDevices = devices.length;
        }

        // Only count if health data didn't provide counts
        if (newStats.switches === 0 && newStats.accessPoints === 0) {
          const deviceCounts = devices.reduce((acc, device) => {
            const type = device.deviceType || 'UNKNOWN';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});

          newStats.switches = deviceCounts.SWITCH || 0;
          newStats.accessPoints = deviceCounts.AP || deviceCounts.IAP || deviceCounts.ACCESS_POINT || 0;
          newStats.gateways = deviceCounts.GATEWAY || 0;
        }
      }

      // Fetch clients count (non-blocking, can fail gracefully)
      fetchClientsCount().then(count => {
        setStats(prev => {
          const updated = { ...prev, clients: count };
          // Update cached display if value changed
          setCachedDisplayStats(prevCached => {
            if (count !== prevCached.clients) {
              const updatedCached = { ...prevCached, clients: count };
              cacheUtils.set(CACHE_KEYS.STATS, { ...updated, ...updatedCached });
              return updatedCached;
            }
            return prevCached;
          });
          return updated;
        });
      }).catch(() => {
        // Keep previous client count or 0
      });

      // Calculate trends - use functional update to avoid dependency
      setStats(prevStats => {
        setPreviousStats(prevStats);
        // Update cached display stats if values changed
        setCachedDisplayStats(prevCached => {
          const hasChanges = 
            newStats.totalDevices !== prevCached.totalDevices ||
            newStats.switches !== prevCached.switches ||
            newStats.accessPoints !== prevCached.accessPoints ||
            newStats.gateways !== prevCached.gateways;
          
          if (hasChanges) {
            const updated = {
              ...prevCached,
              totalDevices: newStats.totalDevices,
              switches: newStats.switches,
              accessPoints: newStats.accessPoints,
              gateways: newStats.gateways,
            };
            const finalStats = { ...updated, clients: prevCached.clients };
            cacheUtils.set(CACHE_KEYS.STATS, finalStats);
            return updated;
          }
          return prevCached;
        });
        // Cache the results (clients will be updated separately)
        const finalStats = { ...newStats, clients: prevStats?.clients || cachedDisplayStats.clients || 0 };
        cacheUtils.set(CACHE_KEYS.STATS, finalStats);
        return newStats;
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      // On error, try to restore from cache or keep existing stats
      const cached = cacheUtils.get(CACHE_KEYS.STATS);
      if (!cached && stats.totalDevices === 0) {
        // Only reset if we have no data at all
        setStats({
          totalDevices: 0,
          switches: 0,
          accessPoints: 0,
          gateways: 0,
          clients: 0,
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [withTimeout, fetchClientsCount]);

  // Initial load and refresh interval
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      // If we have cached stats, set them immediately for display
      if (cachedStats) {
        setCachedDisplayStats(cachedStats);
        setStats(cachedStats);
      }
      // Then refresh in background
      await fetchDashboardData(false);
      if (mounted) await fetchRateLimitData();
    };

    loadData();

    // Refresh every 60 seconds (only refresh, don't show loading)
    const interval = setInterval(() => {
      if (mounted) {
        fetchDashboardData(true);
        fetchRateLimitData();
      }
    }, 60000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []); // Only run on mount

  const getTrend = useCallback((current, previous) => {
    if (!previous || previous === 0) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'flat';
  }, []);

  const getTrendValue = useCallback((current, previous) => {
    if (!previous || previous === 0) return null;
    const diff = current - previous;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}`;
  }, []);

  // Memoize trend calculations
  const trends = useMemo(() => ({
    totalDevices: previousStats ? getTrend(stats.totalDevices, previousStats.totalDevices) : null,
    switches: previousStats ? getTrend(stats.switches, previousStats.switches) : null,
    accessPoints: previousStats ? getTrend(stats.accessPoints, previousStats.accessPoints) : null,
    clients: previousStats ? getTrend(stats.clients, previousStats.clients) : null,
  }), [stats, previousStats, getTrend]);

  const trendValues = useMemo(() => ({
    totalDevices: previousStats ? getTrendValue(stats.totalDevices, previousStats.totalDevices) : null,
    switches: previousStats ? getTrendValue(stats.switches, previousStats.switches) : null,
    accessPoints: previousStats ? getTrendValue(stats.accessPoints, previousStats.accessPoints) : null,
    clients: previousStats ? getTrendValue(stats.clients, previousStats.clients) : null,
  }), [stats, previousStats, getTrendValue]);

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Network Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time overview of your Aruba Central network infrastructure
          </Typography>
        </Box>
        {refreshing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="caption" color="text.secondary">
              Refreshing...
            </Typography>
          </Box>
        )}
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
            value={stats.totalDevices !== undefined ? stats.totalDevices : cachedDisplayStats.totalDevices}
            icon={DevicesIcon}
            color="primary"
            loading={false}
            trend={trends.totalDevices}
            trendValue={trendValues.totalDevices}
            subtitle="View all devices"
            onClick={() => navigate('/devices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Switches"
            value={stats.switches !== undefined ? stats.switches : cachedDisplayStats.switches}
            icon={RouterIcon}
            color="info"
            loading={false}
            trend={trends.switches}
            trendValue={trendValues.switches}
            subtitle="Network switches"
            onClick={() => navigate('/devices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Access Points"
            value={stats.accessPoints !== undefined ? stats.accessPoints : cachedDisplayStats.accessPoints}
            icon={WifiIcon}
            color="primary"
            loading={false}
            trend={trends.accessPoints}
            trendValue={trendValues.accessPoints}
            subtitle="Wireless APs"
            onClick={() => navigate('/devices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="Clients"
            value={stats.clients !== undefined ? stats.clients : cachedDisplayStats.clients}
            icon={PeopleIcon}
            color="success"
            loading={false}
            trend={trends.clients}
            trendValue={trendValues.clients}
            subtitle="Connected clients"
            onClick={() => navigate('/clients')}
          />
        </Grid>
      </Grid>

      {/* Client Count Note */}
      {(stats.clients !== undefined ? stats.clients : cachedDisplayStats.clients) === 0 && !loading && (
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
                    {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Auto-refresh
                  </Typography>
                  <Chip label="60s" size="small" variant="outlined" />
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
