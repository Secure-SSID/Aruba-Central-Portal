/**
 * Sites Management Page
 * View and manage network sites with health monitoring
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
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
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Popover,
} from '@mui/material';
import {
  LocationOn as LocationOnIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Dangerous as DangerousIcon,
} from '@mui/icons-material';
import { monitoringAPIv2, sitesConfigAPI } from '../services/api';
import AddressAutocomplete from '../components/AddressAutocomplete';

function SitesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sites, setSites] = useState([]);
  const [sitesConfig, setSitesConfig] = useState([]);
  const [sitesHealth, setSitesHealth] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [viewMode, setViewMode] = useState('combined'); // 'config', 'health', 'combined'
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteHealthDetail, setSiteHealthDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [newSite, setNewSite] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipcode: '',
    latitude: '',
    longitude: '',
    timezone: {
      rawOffset: null,
      timezoneId: '',
      timezoneName: '',
    },
    image: null,
  });

  const extractSitesHealthItems = (response, visited = new Set()) => {
    if (!response || typeof response !== 'object' || visited.has(response)) return [];
    if (Array.isArray(response)) return response;

    visited.add(response);

    const candidateKeys = [
      'items',
      'data',
      'sites',
      'sites_health',
      'sitesHealth',
      'siteHealth',
      'result',
      'results',
      'records',
      'values',
    ];

    for (const key of candidateKeys) {
      const value = response[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') {
        const nested = extractSitesHealthItems(value, visited);
        if (nested.length > 0) return nested;
      }
    }

    const firstArray = Object.values(response).find((value) => Array.isArray(value));
    if (firstArray) return firstArray;

    return [];
  };

  const getDeviceHealthCounts = (site) => {
    if (!site) return { poor: 0, fair: 0, good: 0 };

    const parseValue = (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      }
      return 0;
    };

    const getValueFromGroups = (groups, target) => {
      if (!Array.isArray(groups)) return 0;
      return parseValue(
        groups.find(
          (group) => typeof group?.name === 'string' && group.name.toLowerCase() === target
        )?.value
      );
    };

    // Check for deviceTypes structure (from sites-device-health endpoint)
    const deviceTypes = site?.deviceTypes || site?.deviceHealth?.deviceTypes || site?.devices?.deviceTypes;
    if (Array.isArray(deviceTypes) && deviceTypes.length > 0) {
      // Sum up health counts from all device types
      let totalGood = 0;
      let totalFair = 0;
      let totalPoor = 0;

      deviceTypes.forEach(deviceType => {
        const groups = deviceType?.health?.groups || deviceType?.groups;
        if (groups) {
          totalGood += getValueFromGroups(groups, 'good');
          totalFair += getValueFromGroups(groups, 'fair');
          totalPoor += getValueFromGroups(groups, 'poor');
        }
      });

      if (totalGood > 0 || totalFair > 0 || totalPoor > 0) {
        return { good: totalGood, fair: totalFair, poor: totalPoor };
      }
    }

    // Check for direct groups structure (from sites-health endpoint)
    const groups =
      site?.health?.devices?.health?.groups ||
      site?.devices?.health?.groups ||
      site?.deviceHealth?.devices?.health?.groups ||
      site?.siteHealth?.devices?.health?.groups ||
      site?.health?.groups ||
      site?.devices?.groups ||
      site?.deviceHealth?.groups ||
      null;

    if (Array.isArray(groups)) {
      return {
        poor: getValueFromGroups(groups, 'poor'),
        fair: getValueFromGroups(groups, 'fair'),
        good: getValueFromGroups(groups, 'good'),
      };
    }

    return { poor: 0, fair: 0, good: 0 };
  };

  const calculateDeviceHealthTotals = (siteList) => {
    if (!Array.isArray(siteList) || siteList.length === 0) {
      return { poor: 0, fair: 0, good: 0 };
    }

    return siteList.reduce(
      (acc, site) => {
        const counts = getDeviceHealthCounts(site);
        acc.poor += counts.poor;
        acc.fair += counts.fair;
        acc.good += counts.good;
        return acc;
      },
      { poor: 0, fair: 0, good: 0 }
    );
  };

  useEffect(() => {
    fetchSites();
  }, [limit, offset, search, filter, sort]);

  const fetchSites = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Build query params for config API
      const params = {
        limit,
        offset,
      };
      if (search) params.search = search;
      if (filter) params.filter = filter;
      if (sort) params.sort = sort;

      // Fetch sites from config API
      const configResponse = await sitesConfigAPI.getSites(params);
      const configData = configResponse.items || configResponse.data || [];
      setSitesConfig(configData);
      setTotal(configResponse.count || configResponse.total || configData.length);

      // Fetch health data in parallel - use sites-device-health endpoint for device data
      let healthData = [];
      let deviceHealthData = [];
      try {
        // Fetch general sites health
        const healthParams = { limit: 1000, offset: 0 };
        console.log('🔍 Calling getSitesHealth with params:', healthParams);
        let healthResponse;
        try {
          healthResponse = await monitoringAPIv2.getSitesHealth(healthParams);
          console.log('✅ getSitesHealth returned:', healthResponse);
          if (healthResponse) {
            const extracted = extractSitesHealthItems(healthResponse);
            healthData = Array.isArray(extracted) ? extracted : [];
            setSitesHealth(healthData);
            console.log('📊 Sites health data:', healthData);
          }
        } catch (err) {
          console.warn('⚠️ Failed to fetch sites health:', err);
          healthResponse = null;
        }

        // Fetch device health data using dedicated endpoint
        console.log('🔍 Calling getSitesDeviceHealth for device health data');
        try {
          const deviceHealthResponse = await monitoringAPIv2.getSitesDeviceHealth({ limit: 1000, offset: 0 });
          console.log('✅ getSitesDeviceHealth returned:', deviceHealthResponse);
          if (deviceHealthResponse) {
            const extracted = extractSitesHealthItems(deviceHealthResponse);
            deviceHealthData = Array.isArray(extracted) ? extracted : [];
            console.log('📊 Device health data:', deviceHealthData);
            
            // Merge device health into sites health data
            if (healthData.length > 0 && deviceHealthData.length > 0) {
              healthData = healthData.map(site => {
                const siteId = site.id || site.siteId || site.site_id;
                const deviceHealth = deviceHealthData.find(dh => {
                  const dhSiteId = dh.id || dh.siteId || dh.site_id;
                  return dhSiteId && siteId && dhSiteId.toString() === siteId.toString();
                });
                if (deviceHealth) {
                  return {
                    ...site,
                    devices: deviceHealth.devices || deviceHealth,
                    deviceHealth: deviceHealth,
                    // Preserve deviceTypes for aggregation
                    deviceTypes: deviceHealth.deviceTypes || deviceHealth.devices?.deviceTypes
                  };
                }
                return site;
              });
            } else if (deviceHealthData.length > 0) {
              // If no general health data, use device health data
              healthData = deviceHealthData;
            }
          }
        } catch (err) {
          console.warn('⚠️ Failed to fetch device health data:', err);
          console.warn('⚠️ Error details:', err.response?.data || err.message);
        }
        
        if (healthData.length === 0) {
          console.warn('⚠️ No health data available');
        }
      } catch (healthErr) {
        console.warn('Failed to fetch health data:', healthErr);
        setSitesHealth([]);
        healthData = [];
      }

      // Combine config and health data
      // If we have config data, merge health into it
      // If no config data but we have health data, use health data directly
      let combined = [];
      if (configData.length > 0) {
        // Merge config with health data
        combined = configData.map(configSite => {
          const configSiteId = configSite.scopeId || configSite.id;
          const healthSite = healthData.find(h => {
            // Health API uses 'id' field (e.g., "YOUR_SITE_ID")
            const healthSiteId = h.id || h.siteId || h.site_id;
            // Try both string and number comparison
            if (!healthSiteId || !configSiteId) return false;
            return healthSiteId.toString() === configSiteId.toString() ||
                   healthSiteId === configSiteId ||
                   healthSiteId === configSiteId.toString() ||
                   healthSiteId.toString() === configSiteId;
          });
          // Merge health data into config site, preserving devices structure
          return { 
            ...configSite, 
            health: healthSite || null,
            // Also add devices at top level for easier access
            devices: healthSite?.devices || configSite.devices || null,
            // Preserve deviceTypes for aggregation
            deviceTypes: healthSite?.deviceTypes || healthSite?.deviceHealth?.deviceTypes || configSite.deviceTypes || null,
            deviceHealth: healthSite?.deviceHealth || healthSite || null,
          };
        });
      } else if (healthData.length > 0) {
        // If no config data, use health data directly and format it
        combined = healthData.map(healthSite => ({
          id: healthSite.id,
          scopeId: healthSite.id,
          name: healthSite.name,
          scopeName: healthSite.name,
          address: healthSite.address?.address || '',
          city: healthSite.address?.city || '',
          state: healthSite.address?.state || '',
          country: healthSite.address?.country || '',
          zipcode: healthSite.address?.zipCode || '',
          latitude: healthSite.location?.latitude ? parseFloat(healthSite.location.latitude) : null,
          longitude: healthSite.location?.longitude ? parseFloat(healthSite.location.longitude) : null,
          deviceCount: healthSite.devices?.count || 0,
          devices: healthSite.devices || null,
          health: healthSite,
          deviceTypes: healthSite.deviceTypes || healthSite.deviceHealth?.deviceTypes || null,
          deviceHealth: healthSite.deviceHealth || healthSite || null,
        }));
      }
      console.log('Combined sites with device health:', combined.map(s => ({
        name: s.scopeName || s.name,
        id: s.scopeId || s.id,
        deviceCount: s.devices?.count || s.deviceCount,
        hasHealth: !!s.health,
        hasDevices: !!s.devices,
        hasDeviceTypes: !!s.deviceTypes,
        devicesPath: s.devices ? 'exists' : 'missing',
        healthDevicesPath: s.health?.devices ? 'exists' : 'missing',
        deviceHealth: getDeviceHealthCounts(s),
        deviceTypesCount: s.deviceTypes?.length || 0,
        rawDevices: s.devices,
        rawDeviceTypes: s.deviceTypes,
        rawHealthDevices: s.health?.devices,
        fullSite: s, // Full site object for debugging
      })));
      
      // Calculate and log total device health counts across all sites
      const totals = getTotalDeviceHealthCounts();
      console.log('📊 Total device health counts across all sites:', totals);
      console.log('📊 Sites contributing to totals:', combined.length);
      
      setSites(combined);
    } catch (err) {
      console.error('Sites API error:', err);
      setError('Failed to load sites data. ' + (err.message || ''));
      setSites([]);
      setSitesConfig([]);
      setSitesHealth([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchSiteHealthDetail = async (siteId) => {
    try {
      setDetailLoading(true);
      const response = await monitoringAPIv2.getSiteHealth(siteId);
      setSiteHealthDetail(response);
    } catch (err) {
      console.error('Failed to fetch site health detail:', err);
      setError('Failed to load site health details: ' + (err.message || ''));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetails = async (site) => {
    const siteId = site.siteId || site.id || site.site_id;
    setSelectedSite(site);
    setOpenDetailDialog(true);
    await fetchSiteHealthDetail(siteId);
  };

  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
  };

  const handleLimitChange = (event) => {
    setLimit(event.target.value);
    setOffset(0); // Reset to first page when changing limit
  };

  const getHealthColor = (health) => {
    if (health === 'Good' || health === 'good') return 'success';
    if (health === 'Fair' || health === 'fair') return 'warning';
    if (health === 'Poor' || health === 'poor' || health === 'Critical') return 'error';
    return 'default';
  };

  const getHealthScore = (site) => {
    // Try to get health score from various possible fields
    return site.healthScore || site.health_score || 
           (site.health && site.health.score) || 
           (site.health && site.health.groups && site.health.groups.find(g => g.name === 'Good')?.value) || 
           'N/A';
  };

  const getHealthStatus = (site) => {
    // First check device health counts (most accurate)
    const deviceCounts = getDeviceHealthCounts(site);
    if (deviceCounts.poor > 0) {
      return 'Critical'; // Show critical status when there are poor devices
    }
    if (deviceCounts.fair > 0) return 'Fair';
    if (deviceCounts.good > 0) return 'Good';
    
    // Fallback to site health groups if device counts not available
    if (site.health && site.health.groups) {
      const groups = site.health.groups;
      const poor = groups.find(g => g.name === 'Poor')?.value || 0;
      const fair = groups.find(g => g.name === 'Fair')?.value || 0;
      const good = groups.find(g => g.name === 'Good')?.value || 0;
      
      // Determine status based on which has the highest value
      // If there are any Poor items, show Critical (most critical)
      if (poor > 0) return 'Critical';
      if (fair > 0 && good === 0) return 'Fair';
      if (good > 0) return 'Good';
      // If all are 0, check if there are any devices/clients
      const total = poor + fair + good;
      if (total === 0) return 'Unknown';
    }
    return 'Unknown';
  };

  const getDeviceCountBadgeColor = (site) => {
    const counts = getDeviceHealthCounts(site);
    const total = counts.poor + counts.fair + counts.good;
    
    // If no devices, show green
    if (total === 0) return { color: 'success', textColor: 'white' };
    // If any poor devices, show red (priority)
    if (counts.poor > 0) return { color: 'error', textColor: 'white' };
    // If any fair devices (but no poor), show orange
    if (counts.fair > 0) return { color: 'warning', textColor: 'white' };
    // All good, show green
    return { color: 'success', textColor: 'white' };
  };

  const getTotalDeviceHealthCounts = () => {
    let totalPoor = 0;
    let totalFair = 0;
    let totalGood = 0;
    
    sites.forEach(site => {
      const counts = getDeviceHealthCounts(site);
      totalPoor += counts.poor;
      totalFair += counts.fair;
      totalGood += counts.good;
    });
    
    return { poor: totalPoor, fair: totalFair, good: totalGood };
  };

  const handleCreateSite = async () => {
    try {
      setError('');
      setSuccess('');
      const siteData = {
        name: newSite.name,
        address: newSite.address,
        city: newSite.city,
        state: newSite.state,
        country: newSite.country,
        zipcode: newSite.zipcode,
      };
      if (newSite.latitude && newSite.longitude) {
        siteData.latitude = parseFloat(newSite.latitude);
        siteData.longitude = parseFloat(newSite.longitude);
      }
      if (newSite.timezone.timezoneId) {
        siteData.timezone = newSite.timezone;
      }
      if (newSite.image) {
        siteData.image = newSite.image;
      }
      await sitesConfigAPI.createSite(siteData);
      setSuccess('Site created successfully!');
      setOpenDialog(false);
      setNewSite({
        name: '',
        address: '',
        city: '',
        state: '',
        country: '',
        zipcode: '',
        latitude: '',
        longitude: '',
        timezone: { rawOffset: null, timezoneId: '', timezoneName: '' },
        image: null,
      });
      fetchSites();
    } catch (err) {
      setError(err.message || 'Failed to create site');
    }
  };

  const handleEditSite = (site) => {
    setEditingSite(site);
    setNewSite({
      name: site.scopeName || site.name || '',
      address: site.address || '',
      city: site.city || '',
      state: site.state || '',
      country: site.country || '',
      zipcode: site.zipcode || '',
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
      timezone: site.timezone || { rawOffset: null, timezoneId: '', timezoneName: '' },
      image: site.image || null,
    });
    setOpenEditDialog(true);
  };

  const handleUpdateSite = async () => {
    try {
      setError('');
      setSuccess('');
      if (!editingSite || !editingSite.scopeId) {
        setError('Site ID is required for update');
        return;
      }
      const siteData = {
        scopeId: editingSite.scopeId,
        name: newSite.name,
        address: newSite.address,
        city: newSite.city,
        state: newSite.state,
        country: newSite.country,
        zipcode: newSite.zipcode,
      };
      if (newSite.latitude && newSite.longitude) {
        siteData.latitude = parseFloat(newSite.latitude);
        siteData.longitude = parseFloat(newSite.longitude);
      }
      if (newSite.timezone.timezoneId) {
        siteData.timezone = newSite.timezone;
      }
      if (newSite.image) {
        siteData.image = newSite.image;
      }
      await sitesConfigAPI.updateSite(siteData);
      setSuccess('Site updated successfully!');
      setOpenEditDialog(false);
      setEditingSite(null);
      fetchSites();
    } catch (err) {
      setError(err.message || 'Failed to update site');
    }
  };

  const handleDeleteSite = async (scopeId) => {
    if (!window.confirm('Are you sure you want to delete this site?')) return;

    try {
      setError('');
      setSuccess('');
      await sitesConfigAPI.deleteSite(scopeId);
      setSuccess('Site deleted successfully!');
      fetchSites();
    } catch (err) {
      setError(err.message || 'Failed to delete site');
    }
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setOffset(0); // Reset to first page on search
  };

  const handleSortChange = (event) => {
    setSort(event.target.value);
    setOffset(0);
  };

  const handleClearFilters = () => {
    setSearch('');
    setFilter('');
    setSort('');
    setOffset(0);
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
            Sites Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage network sites and locations
          </Typography>
        </Box>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchSites}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            disabled={Boolean(error && sites.length === 0)}
          >
            Create Site
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Sites Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Sites
                  </Typography>
                  <Typography variant="h4">{total || sites.length}</Typography>
                </Box>
                <LocationOnIcon sx={{ fontSize: 40, color: '#FF6600' }} />
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
                    Good Devices
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {getTotalDeviceHealthCounts().good}
                  </Typography>
                </Box>
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
                    Fair Devices
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {getTotalDeviceHealthCounts().fair}
                  </Typography>
                </Box>
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
                    Poor Devices
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {getTotalDeviceHealthCounts().poor}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtering and Search Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search sites..."
                value={search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select value={sort} label="Sort By" onChange={handleSortChange}>
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="scopeName asc">Name (A-Z)</MenuItem>
                  <MenuItem value="scopeName desc">Name (Z-A)</MenuItem>
                  <MenuItem value="deviceCount desc">Device Count (High-Low)</MenuItem>
                  <MenuItem value="deviceCount asc">Device Count (Low-High)</MenuItem>
                  <MenuItem value="city asc">City (A-Z)</MenuItem>
                  <MenuItem value="state asc">State (A-Z)</MenuItem>
                  <MenuItem value="country asc">Country (A-Z)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Page Size</InputLabel>
                <Select value={limit} label="Page Size" onChange={handleLimitChange}>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {(search || filter || sort) && (
                  <Button
                    size="small"
                    onClick={handleClearFilters}
                    startIcon={<FilterListIcon />}
                  >
                    Clear Filters
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Sites Table */}
      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">Sites Overview</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Site Name</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Collection</TableCell>
                  <TableCell>Devices</TableCell>
                  <TableCell>Health Status</TableCell>
                  <TableCell>Geolocation</TableCell>
                  <TableCell>Timezone</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sites.length > 0 ? (
                  sites.map((site) => {
                    const scopeId = site.scopeId || site.id || site.siteId || site.site_id;
                    // Health API uses 'name', config API uses 'scopeName'
                    const siteName = site.scopeName || site.name || site.siteName || site.site_name || `Site ${scopeId}`;
                    // Check device health counts to determine status
                    const deviceCounts = getDeviceHealthCounts(site);
                    const hasDevices = deviceCounts.poor > 0 || deviceCounts.fair > 0 || deviceCounts.good > 0;
                    const healthStatus = (site.health || hasDevices) ? getHealthStatus(site) : 'Unknown';
                    // Health API has devices.count, config API has deviceCount
                    const deviceCount = site.devices?.count || site.deviceCount || site.device_count || 0;
                    // Handle nested address object from health API or flat address from config API
                    const address = site.address?.address || site.address || 'N/A';
                    const city = site.address?.city || site.city || '';
                    const state = site.address?.state || site.state || '';
                    const country = site.address?.country || site.country || '';
                    const location = [city, state, country].filter(Boolean).join(', ') || 'N/A';
                    
                    return (
                      <TableRow key={scopeId} hover>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {siteName}
                          </Typography>
                          {scopeId && (
                            <Typography variant="caption" color="text.secondary">
                              ID: {scopeId}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{address}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {location}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {site.collectionName ? (
                            <Chip size="small" label={site.collectionName} />
                          ) : (
                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip
                            title={
                              <Box>
                                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                  <Chip size="small" label={`Good: ${getDeviceHealthCounts(site).good}`} color="success" />
                                  <Chip size="small" label={`Fair: ${getDeviceHealthCounts(site).fair}`} color="warning" />
                                  <Chip size="small" label={`Poor: ${getDeviceHealthCounts(site).poor}`} color="error" />
                                </Box>
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <Chip
                              size="small"
                              label={deviceCount}
                              color={getDeviceCountBadgeColor(site).color}
                              sx={{
                                color: getDeviceCountBadgeColor(site).textColor,
                                fontWeight: 600,
                                cursor: 'help',
                              }}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {site.health || (deviceCounts.poor > 0 || deviceCounts.fair > 0 || deviceCounts.good > 0) ? (
                            <Chip
                              size="small"
                              icon={healthStatus === 'Critical' ? <DangerousIcon /> : undefined}
                              label={healthStatus === 'Critical' ? '☠️ Critical' : healthStatus}
                              color={getHealthColor(healthStatus)}
                              sx={{
                                fontWeight: healthStatus === 'Critical' ? 600 : 400,
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {site.latitude && site.longitude ? (
                            <Typography variant="caption">
                              {parseFloat(site.latitude).toFixed(4)}, {parseFloat(site.longitude).toFixed(4)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {site.timezone?.timezoneId ? (
                            <Typography variant="caption">
                              {site.timezone.timezoneId}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {site.health && (
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleViewDetails(site)}
                                title="View Health Details"
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            )}
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEditSite(site)}
                              title="Edit Site"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteSite(scopeId)}
                              title="Delete Site"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {loading ? 'Loading sites...' : 'No sites found.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {/* Pagination Controls */}
          {sites.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} sites
              </Typography>
              <Box>
                <Button
                  startIcon={<ChevronLeftIcon />}
                  onClick={() => handlePageChange(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  size="small"
                >
                  Previous
                </Button>
                <Button
                  endIcon={<ChevronRightIcon />}
                  onClick={() => handlePageChange(offset + limit)}
                  disabled={offset + limit >= total}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  Next
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Site Health Detail Dialog */}
      <Dialog 
        open={openDetailDialog} 
        onClose={() => {
          setOpenDetailDialog(false);
          setSiteHealthDetail(null);
          setSelectedSite(null);
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Site Health Details
          {selectedSite && (
            <Typography variant="body2" color="text.secondary">
              {selectedSite.siteName || selectedSite.site_name || selectedSite.name || `Site ${selectedSite.siteId || selectedSite.id}`}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : siteHealthDetail ? (
            <Box sx={{ pt: 2 }}>
              {/* Overall Health */}
              {siteHealthDetail.health && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Overall Health</Typography>
                    {siteHealthDetail.health.groups && (
                      <Grid container spacing={2}>
                        {siteHealthDetail.health.groups.map((group, idx) => (
                          <Grid item xs={4} key={idx}>
                            <Chip
                              label={`${group.name}: ${group.value}`}
                              color={getHealthColor(group.name)}
                              sx={{ width: '100%' }}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Health Reasons */}
              {siteHealthDetail.reasons && siteHealthDetail.reasons.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Health Issues</Typography>
                    <List>
                      {siteHealthDetail.reasons.map((reason, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={reason.reason}
                            secondary={
                              <Chip
                                size="small"
                                label={reason.health}
                                color={getHealthColor(reason.health)}
                                sx={{ mt: 0.5 }}
                              />
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Device Types */}
              {siteHealthDetail.deviceTypes && siteHealthDetail.deviceTypes.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Device Types</Typography>
                    {siteHealthDetail.deviceTypes.map((dt, idx) => (
                      <Box key={idx} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>{dt.name}</Typography>
                        {dt.health && dt.health.groups && (
                          <Grid container spacing={1}>
                            {dt.health.groups.map((group, gIdx) => (
                              <Grid item xs={4} key={gIdx}>
                                <Chip
                                  size="small"
                                  label={`${group.name}: ${group.value}`}
                                  color={getHealthColor(group.name)}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        )}
                        {idx < siteHealthDetail.deviceTypes.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Client Types */}
              {siteHealthDetail.clientTypes && siteHealthDetail.clientTypes.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Client Types</Typography>
                    {siteHealthDetail.clientTypes.map((ct, idx) => (
                      <Box key={idx} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>{ct.name}</Typography>
                        {ct.health && ct.health.groups && (
                          <Grid container spacing={1}>
                            {ct.health.groups.map((group, gIdx) => (
                              <Grid item xs={4} key={gIdx}>
                                <Chip
                                  size="small"
                                  label={`${group.name}: ${group.value}`}
                                  color={getHealthColor(group.name)}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        )}
                        {idx < siteHealthDetail.clientTypes.length - 1 && <Divider sx={{ mt: 2 }} />}
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Compute */}
              {siteHealthDetail.compute && siteHealthDetail.compute.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Compute</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {JSON.stringify(siteHealthDetail.compute, null, 2)}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Response Info */}
              {siteHealthDetail.response && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status: {siteHealthDetail.response.status} - {siteHealthDetail.response.message}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No health details available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenDetailDialog(false);
            setSiteHealthDetail(null);
            setSelectedSite(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Site Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Site</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Site Name"
              value={newSite.name}
              onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <AddressAutocomplete
              value={newSite.address}
              onChange={(val) => setNewSite({ ...newSite, address: val })}
              onResolved={(data) => {
                // Only auto-fill timezone (and coordinates); do not change address/city/state/country/zip
                const tz = data.timezone
                  ? { ...newSite.timezone, timezoneId: data.timezone }
                  : newSite.timezone;
                setNewSite({
                  ...newSite,
                  latitude: data.lat != null ? String(data.lat) : newSite.latitude,
                  longitude: data.lon != null ? String(data.lon) : newSite.longitude,
                  timezone: tz,
                });
              }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={newSite.city}
                  onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>State</InputLabel>
                  <Select
                    label="State"
                    value={newSite.state}
                    onChange={(e) => setNewSite({ ...newSite, state: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'].map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={newSite.country}
                    onChange={(e) => setNewSite({ ...newSite, country: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['United States','Canada','United Kingdom','Australia','Germany','France','Netherlands','India','Japan','Singapore','Brazil','Mexico'].map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Zip Code"
                  value={newSite.zipcode}
                  onChange={(e) => setNewSite({ ...newSite, zipcode: e.target.value })}
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Geolocation (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  value={newSite.latitude}
                  onChange={(e) => setNewSite({ ...newSite, latitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  value={newSite.longitude}
                  onChange={(e) => setNewSite({ ...newSite, longitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Timezone (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Timezone ID (e.g., America/New_York)"
                  value={newSite.timezone.timezoneId}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneId: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Timezone Name"
                  value={newSite.timezone.timezoneName}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneName: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Raw Offset (seconds)"
                  type="number"
                  value={newSite.timezone.rawOffset || ''}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, rawOffset: e.target.value ? parseInt(e.target.value) : null }
                  })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSite}
            disabled={!newSite.name || newSite.name.trim() === ''}
          >
            Create Site
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={openEditDialog} onClose={() => {
        setOpenEditDialog(false);
        setEditingSite(null);
      }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Site</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Site Name"
              value={newSite.name}
              onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <AddressAutocomplete
              value={newSite.address}
              onChange={(val) => setNewSite({ ...newSite, address: val })}
              onResolved={(data) => {
                // Only auto-fill timezone (and coordinates); do not change address/city/state/country/zip
                const tz = data.timezone
                  ? { ...newSite.timezone, timezoneId: data.timezone }
                  : newSite.timezone;
                setNewSite({
                  ...newSite,
                  latitude: data.lat != null ? String(data.lat) : newSite.latitude,
                  longitude: data.lon != null ? String(data.lon) : newSite.longitude,
                  timezone: tz,
                });
              }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={newSite.city}
                  onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>State</InputLabel>
                  <Select
                    label="State"
                    value={newSite.state}
                    onChange={(e) => setNewSite({ ...newSite, state: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'].map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={newSite.country}
                    onChange={(e) => setNewSite({ ...newSite, country: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['United States','Canada','United Kingdom','Australia','Germany','France','Netherlands','India','Japan','Singapore','Brazil','Mexico'].map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Zip Code"
                  value={newSite.zipcode}
                  onChange={(e) => setNewSite({ ...newSite, zipcode: e.target.value })}
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Geolocation (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  value={newSite.latitude}
                  onChange={(e) => setNewSite({ ...newSite, latitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  value={newSite.longitude}
                  onChange={(e) => setNewSite({ ...newSite, longitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Timezone (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Timezone ID (e.g., America/New_York)"
                  value={newSite.timezone.timezoneId}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneId: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Timezone Name"
                  value={newSite.timezone.timezoneName}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneName: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Raw Offset (seconds)"
                  type="number"
                  value={newSite.timezone.rawOffset || ''}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, rawOffset: e.target.value ? parseInt(e.target.value) : null }
                  })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenEditDialog(false);
            setEditingSite(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateSite}
            disabled={!newSite.name || newSite.name.trim() === ''}
          >
            Update Site
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SitesPage;
