import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Button,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Tooltip,
  OutlinedInput,
} from '@mui/material';
import {
  Wifi as WifiIcon,
  Cable as CableIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  CheckCircle as CheckCircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { getClients, getClientTrends, getTopClients, sitesConfigAPI, monitoringAPIv2, configAPI } from '../services/api';

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false); // Don't block initial render
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(null); // null = all statuses
  const [selectedTypes, setSelectedTypes] = useState(['wireless', 'wired']);
  const [viewMode, setViewMode] = useState('list');
  const [sites, setSites] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [loadingSites, setLoadingSites] = useState(true); // Separate loading state for sites
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    // Only load data after sites have been loaded (even if empty)
    if (sitesLoaded) {
      loadData();
    }
  }, [selectedSites, sitesLoaded]);

  const loadSites = async () => {
    try {
      setLoadingSites(true);
      console.log('🔍 Loading sites in ClientsPage...');
      let sitesList = [];
      
      // Try Configuration API first (best choice - faster, returns site names/IDs)
      let lastError = null;
      
      try {
        console.log('🔍 [1/3] Trying Configuration API (/network-config/v1alpha1/sites)...');
        let sitesData;
        try {
          sitesData = await sitesConfigAPI.getSites({ limit: 100, offset: 0 });
          console.log('✅ Configuration API response (with params):', sitesData);
        } catch (firstErr) {
          console.warn('⚠️ Failed with limit/offset, trying without params:', firstErr);
          sitesData = await sitesConfigAPI.getSites({});
          console.log('✅ Configuration API response (without params):', sitesData);
        }
        
        // Handle different response formats
        if (Array.isArray(sitesData)) {
          sitesList = sitesData;
        } else if (sitesData && typeof sitesData === 'object') {
          sitesList = sitesData.items || sitesData.data || sitesData.sites || sitesData.results || [];
        }
        
        if (sitesList.length > 0) {
          console.log(`✅ Loaded ${sitesList.length} sites from Configuration API`);
          setSites(sitesList);
          const siteIds = sitesList.map(site => site.scopeId || site.id || site.siteId || site.site_id).filter(Boolean);
          setSelectedSites(siteIds);
          setError(null);
          setSitesLoaded(true);
          return;
        } else {
          console.warn('⚠️ Configuration API returned empty result');
          lastError = new Error('Configuration API returned empty result');
        }
      } catch (configErr) {
        console.warn('⚠️ Configuration API failed:', configErr);
        lastError = configErr;
      }
      
      // Fallback 1: Try Central v2 Sites API
      try {
        console.log('🔍 [2/3] Trying Central v2 Sites API (/central/v2/sites)...');
        const v2SitesData = await configAPI.getSites();
        console.log('✅ Central v2 API response:', v2SitesData);
        
        if (Array.isArray(v2SitesData)) {
          sitesList = v2SitesData;
        } else if (v2SitesData && typeof v2SitesData === 'object') {
          sitesList = v2SitesData.sites || v2SitesData.items || v2SitesData.data || [];
        }
        
        if (sitesList.length > 0) {
          // Map v2 format to expected format
          sitesList = sitesList.map(site => ({
            scopeId: site.site_id || site.id || site.scopeId,
            name: site.site_name || site.name || site.display_name,
            siteName: site.site_name || site.name || site.display_name,
            ...site
          })).filter(site => site.scopeId);
          
          console.log(`✅ Loaded ${sitesList.length} sites from Central v2 API`);
          setSites(sitesList);
          const siteIds = sitesList.map(site => site.scopeId || site.id || site.siteId || site.site_id).filter(Boolean);
          setSelectedSites(siteIds);
          setError(null);
          setSitesLoaded(true);
          return;
        } else {
          console.warn('⚠️ Central v2 API returned empty result');
        }
      } catch (v2Err) {
        console.warn('⚠️ Central v2 API failed:', v2Err);
        lastError = v2Err;
      }
      
      // Fallback 2: Try Monitoring API (sites-health endpoint)
      try {
          console.log('🔍 [3/3] Trying Monitoring API (/network-monitoring/v1alpha1/sites-health)...');
          const healthData = await monitoringAPIv2.getSitesHealth({ limit: 100, offset: 0 });
        console.log('✅ Monitoring API response:', healthData);
        
        // Extract sites from health data
        if (Array.isArray(healthData)) {
          sitesList = healthData;
        } else if (healthData && typeof healthData === 'object') {
          const items = healthData.items || healthData.data || healthData.sites || [];
          // Extract site info from health items
          sitesList = items.map(item => ({
            scopeId: item.scopeId || item.siteId || item.id,
            name: item.scopeName || item.siteName || item.name || item.displayName,
            siteName: item.scopeName || item.siteName || item.name || item.displayName,
            ...item
          })).filter(site => site.scopeId); // Filter out items without IDs
        }
        
        if (sitesList.length > 0) {
          console.log(`✅ Loaded ${sitesList.length} sites from Monitoring API fallback`);
          setSites(sitesList);
          const siteIds = sitesList.map(site => site.scopeId || site.id || site.siteId || site.site_id).filter(Boolean);
          setSelectedSites(siteIds);
          setError(null);
          setSitesLoaded(true);
          return;
        } else {
          console.warn('⚠️ Monitoring API returned empty result');
        }
      } catch (monitoringErr) {
        console.error('❌ Monitoring API also failed:', monitoringErr);
        lastError = monitoringErr;
      }
      
      // All APIs failed
      console.error('❌ All site APIs failed. Last error:', lastError);
      console.error('❌ Setting empty sites list');
      
      // Extract error message from last error
      let errorMessage = 'Failed to load sites from all available APIs';
      if (lastError) {
        if (lastError.response?.data) {
          if (typeof lastError.response.data === 'string') {
            errorMessage = lastError.response.data;
          } else if (lastError.response.data.error) {
            errorMessage = lastError.response.data.error;
          } else if (lastError.response.data.message) {
            errorMessage = lastError.response.data.message;
          }
        } else if (lastError.message) {
          errorMessage = lastError.message;
        }
      }
      
      setSites([]);
      setSelectedSites([]);
      setError(errorMessage);
      setSitesLoaded(true); // Mark as loaded even on error so loadData can run
    } catch (err) {
      console.error('❌ Error loading sites:', err);
      console.error('❌ Error response:', err.response);
      console.error('❌ Error response data:', err.response?.data);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      
      // Extract error message from various possible locations
      let errorMessage = 'Failed to load sites';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.error('❌ Final error message:', errorMessage);
      setError(errorMessage);
      setSites([]);
      setSelectedSites([]);
      setSitesLoaded(true); // Mark as loaded even on error so loadData can run
    } finally {
      setLoadingSites(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (selectedSites.length === 0) {
        setClients([]);
        setTopClients([]);
        setTrends(null);
        setLoading(false);
        return;
      }

      console.log('Loading clients for sites:', selectedSites);

      // Fetch clients using monitoring API (same approach as SitesPage)
      // First try to get all clients without site_id
      let allClients = [];
      let useMonitoringAPI = false;
      
      try {
        const clientsResponse = await getClients(); // No siteId = uses monitoring API
        if (clientsResponse) {
          if (Array.isArray(clientsResponse)) {
            allClients = clientsResponse;
            useMonitoringAPI = allClients.length > 0;
          } else if (clientsResponse.items && Array.isArray(clientsResponse.items)) {
            allClients = clientsResponse.items;
            useMonitoringAPI = allClients.length > 0;
          } else if (clientsResponse.count > 0 || clientsResponse.total > 0) {
            // Response has count but no items array - might be summary only
            useMonitoringAPI = false;
          }
        }
        console.log('Monitoring API returned clients:', allClients.length, 'useMonitoringAPI:', useMonitoringAPI);
      } catch (err) {
        console.warn('Failed to fetch clients from monitoring API, falling back to site-specific calls:', err);
        useMonitoringAPI = false;
      }
      
      // If monitoring API didn't return clients, fetch from selected sites
      if (!useMonitoringAPI && selectedSites.length > 0) {
        console.log('Fetching clients from site-specific endpoints for', selectedSites.length, 'sites');
        const clientPromises = selectedSites.map(siteId => 
          getClients(siteId).catch((err) => {
            console.warn(`Failed to fetch clients for site ${siteId}:`, err);
            return { items: [], total: 0, count: 0 };
          })
        );
        
        const clientsResults = await Promise.allSettled(clientPromises);
        clientsResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const clientData = result.value;
            const siteId = selectedSites[index];
            const site = sites.find(s => {
              const sId = s.scopeId || s.id || s.siteId || s.site_id;
              return sId?.toString() === siteId?.toString();
            });
            const siteName = site?.scopeName || site?.name || site?.siteName || site?.site_name || `Site ${siteId}`;
            
            // Handle different response formats
            let itemsArray = [];
            if (Array.isArray(clientData)) {
              itemsArray = clientData;
            } else if (clientData?.items && Array.isArray(clientData.items)) {
              itemsArray = clientData.items;
            } else if (clientData?.clients && Array.isArray(clientData.clients)) {
              itemsArray = clientData.clients;
            } else if (clientData?.data && Array.isArray(clientData.data)) {
              itemsArray = clientData.data;
            }
            
            console.log(`Site ${siteId} (${siteName}): ${itemsArray.length} clients`, clientData);
            
            itemsArray.forEach(client => {
              allClients.push({
                ...client,
                siteId: siteId,
                siteName: siteName,
              });
            });
          } else {
            console.error(`Failed to fetch clients for site ${selectedSites[index]}:`, result.reason);
          }
        });
      }

      console.log('Total clients before filtering:', allClients.length);

      // Filter clients by selected sites if we got all clients from monitoring API
      // Only filter if not all sites are selected
      if (allClients.length > 0 && selectedSites.length > 0 && selectedSites.length < sites.length) {
        // Filter to only selected sites
        const beforeFilter = allClients.length;
        allClients = allClients.filter(client => {
          const clientSiteId = client.siteId || client['site-id'] || client.site_id;
          const matches = selectedSites.some(siteId => {
            const siteIdStr = siteId?.toString();
            const clientSiteIdStr = clientSiteId?.toString();
            return siteIdStr === clientSiteIdStr;
          });
          return matches;
        });
        console.log(`Filtered from ${beforeFilter} to ${allClients.length} clients for selected sites`);
      }

      // Add site names to clients if not already present
      allClients = allClients.map(client => {
        if (!client.siteName) {
          const clientSiteId = client.siteId || client['site-id'] || client.site_id;
          const site = sites.find(s => {
            const siteId = s.scopeId || s.id || s.siteId || s.site_id;
            return siteId?.toString() === clientSiteId?.toString();
          });
          if (site) {
            client.siteId = clientSiteId;
            client.siteName = site.scopeName || site.name || site.siteName || site.site_name || `Site ${clientSiteId}`;
          } else if (clientSiteId) {
            // If we have a site ID but can't find the site, still set it
            client.siteId = clientSiteId;
            client.siteName = `Site ${clientSiteId}`;
          }
        }
        return client;
      });

      console.log('Final client count:', allClients.length);

      const [topData, trendsData] = await Promise.allSettled([
        selectedSites.length > 0 ? getTopClients(selectedSites[0]) : Promise.resolve({ items: [] }),
        selectedSites.length > 0 ? getClientTrends(selectedSites[0]) : Promise.resolve(null),
      ]);

      setClients(allClients);
      setTopClients(topData.status === 'fulfilled' ? (topData.value?.items || []) : []);
      setTrends(trendsData.status === 'fulfilled' ? trendsData.value : null);
    } catch (err) {
      console.error('Error loading client data:', err);
      setError(err.message || 'Failed to load client data');
      setClients([]);
      setTopClients([]);
      setTrends(null);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getExperienceColor = (experience) => {
    switch (experience?.toLowerCase()) {
      case 'good':
        return 'success';
      case 'fair':
        return 'warning';
      case 'poor':
        return 'error';
      default:
        return 'default';
    }
  };

  // Calculate counts for all statuses
  const statusCounts = {
    connected: clients.filter((c) => c.status?.toLowerCase() === 'connected').length,
    failed: clients.filter((c) => c.status?.toLowerCase() === 'failed').length,
    connecting: clients.filter((c) => c.status?.toLowerCase() === 'connecting').length,
    disconnected: clients.filter((c) => c.status?.toLowerCase() === 'disconnected').length,
  };

  // Calculate counts for type filters - filtered by selected status if one is selected
  const clientsForTypeCount = selectedStatus
    ? clients.filter((c) => c.status?.toLowerCase() === selectedStatus?.toLowerCase())
    : clients;
  
  const typeCounts = {
    wireless: clientsForTypeCount.filter((c) => c.type?.toLowerCase() === 'wireless').length,
    wired: clientsForTypeCount.filter((c) => c.type?.toLowerCase() === 'wired').length,
  };

  const filteredClients = clients.filter((client) => {
    // Search filter
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      client.name?.toLowerCase().includes(search) ||
      client.mac?.toLowerCase().includes(search) ||
      client.ipv4?.toLowerCase().includes(search) ||
      client.network?.toLowerCase().includes(search) ||
      client.connectedTo?.toLowerCase().includes(search) ||
      client.connected_to?.toLowerCase().includes(search) ||
      client.device?.toLowerCase().includes(search) ||
      client.associatedDevice?.toLowerCase().includes(search) ||
      client.port?.toLowerCase().includes(search) ||
      client.portId?.toLowerCase().includes(search) ||
      client.port_id?.toLowerCase().includes(search) ||
      client.interface?.toLowerCase().includes(search) ||
      client.portName?.toLowerCase().includes(search) ||
      client.essid?.toLowerCase().includes(search) ||
      client.ssid?.toLowerCase().includes(search);

    // Status filter
    const matchesStatus =
      !selectedStatus ||
      client.status?.toLowerCase() === selectedStatus?.toLowerCase();

    // Type filter
    const matchesType =
      selectedTypes.length === 0 ||
      selectedTypes.some((type) => client.type?.toLowerCase() === type);

    return matchesSearch && matchesStatus && matchesType;
  });

  // Sort clients
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue, bValue;

    switch (sortColumn) {
      case 'name':
        aValue = (a.name || a.mac || '').toLowerCase();
        bValue = (b.name || b.mac || '').toLowerCase();
        break;
      case 'type':
        aValue = (a.type || '').toLowerCase();
        bValue = (b.type || '').toLowerCase();
        break;
      case 'mac':
        aValue = (a.mac || '').toLowerCase();
        bValue = (b.mac || '').toLowerCase();
        break;
      case 'ip':
        aValue = (a.ipv4 || '').toLowerCase();
        bValue = (b.ipv4 || '').toLowerCase();
        break;
      case 'vlan':
        aValue = a.vlanId || a.network || '';
        bValue = b.vlanId || b.network || '';
        break;
      case 'connectedTo':
        aValue = (a.connectedTo || a.connected_to || a.device || a.associatedDevice || '').toLowerCase();
        bValue = (b.connectedTo || b.connected_to || b.device || b.associatedDevice || '').toLowerCase();
        break;
      case 'port':
        aValue = (a.port || a.portId || a.port_id || a.interface || a.portName || '').toLowerCase();
        bValue = (b.port || b.portId || b.port_id || b.interface || b.portName || '').toLowerCase();
        break;
      case 'role':
        aValue = (a.role || '').toLowerCase();
        bValue = (b.role || '').toLowerCase();
        break;
      case 'site':
        aValue = (a.siteName || '').toLowerCase();
        bValue = (b.siteName || '').toLowerCase();
        break;
      case 'ssid':
        aValue = (a.essid || a.ssid || a.network || '').toLowerCase();
        bValue = (b.essid || b.ssid || b.network || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleTypeClick = (type) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleStatusClick = (status) => {
    setSelectedStatus((prev) => {
      // If clicking the same status, deselect it (show all)
      if (prev === status) {
        return null;
      }
      return status;
    });
  };

  // Don't block the entire page on loading - show content with loading indicators
  // The loading state should only apply to the data loading, not the initial page render

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Clients
        </Typography>
      </Box>

      {/* Filters Row */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Status Filters Group */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
            Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant={selectedStatus === 'connected' ? 'contained' : 'outlined'}
              color="success"
              size="small"
              startIcon={selectedStatus === 'connected' && <CheckCircleIcon />}
              onClick={() => handleStatusClick('connected')}
            >
              Connected ({statusCounts.connected})
            </Button>
            <Button
              variant={selectedStatus === 'failed' ? 'contained' : 'outlined'}
              color="error"
              size="small"
              startIcon={selectedStatus === 'failed' && <CheckCircleIcon />}
              onClick={() => handleStatusClick('failed')}
            >
              Failed ({statusCounts.failed})
            </Button>
            <Button
              variant={selectedStatus === 'connecting' ? 'contained' : 'outlined'}
              color="info"
              size="small"
              startIcon={selectedStatus === 'connecting' && <CheckCircleIcon />}
              onClick={() => handleStatusClick('connecting')}
            >
              Connecting ({statusCounts.connecting})
            </Button>
            <Button
              variant={selectedStatus === 'disconnected' ? 'contained' : 'outlined'}
              size="small"
              startIcon={selectedStatus === 'disconnected' && <CheckCircleIcon />}
              onClick={() => handleStatusClick('disconnected')}
              sx={{
                ...(selectedStatus === 'disconnected' && {
                  backgroundColor: '#ffc107',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#ffb300',
                  },
                }),
                ...(selectedStatus !== 'disconnected' && {
                  borderColor: '#ffc107',
                  color: '#ffc107',
                  '&:hover': {
                    borderColor: '#ffb300',
                    backgroundColor: 'rgba(255, 193, 7, 0.04)',
                  },
                }),
              }}
            >
              Disconnected ({statusCounts.disconnected})
            </Button>
          </Box>
        </Box>

        {/* Type Filters Group */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
            Type
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant={selectedTypes.includes('wireless') ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleTypeClick('wireless')}
              startIcon={selectedTypes.includes('wireless') && <CheckCircleIcon />}
              sx={{
                ...(selectedTypes.includes('wireless') && {
                  backgroundColor: '#FF6600',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#CC5200',
                  },
                }),
                ...(!selectedTypes.includes('wireless') && {
                  borderColor: '#FF6600',
                  color: '#FF6600',
                  '&:hover': {
                    borderColor: '#CC5200',
                    backgroundColor: 'rgba(255, 102, 0, 0.04)',
                  },
                }),
              }}
            >
              Wireless ({typeCounts.wireless})
            </Button>
            <Button
              variant={selectedTypes.includes('wired') ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleTypeClick('wired')}
              startIcon={selectedTypes.includes('wired') && <CheckCircleIcon />}
              sx={{
                ...(selectedTypes.includes('wired') && {
                  backgroundColor: '#01A982',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#018F6F',
                  },
                }),
                ...(!selectedTypes.includes('wired') && {
                  borderColor: '#01A982',
                  color: '#01A982',
                  '&:hover': {
                    borderColor: '#018F6F',
                    backgroundColor: 'rgba(1, 169, 130, 0.04)',
                  },
                }),
              }}
            >
              Wired ({typeCounts.wired})
            </Button>
            {/* Site Selection Dropdown */}
            <FormControl size="small" sx={{ minWidth: 200, ml: 1 }}>
              {loadingSites && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption">Loading sites...</Typography>
                </Box>
              )}
              {error && sites.length === 0 && !loadingSites && (
                <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>
              )}
              <Select
                multiple
                value={selectedSites}
                disabled={loadingSites}
                onChange={(e) => {
                  const value = e.target.value;
                  // Handle "Select All" option - if "all" is in the value, select all sites
                  if (value.includes('all')) {
                    const allSiteIds = sites.map(site => site.scopeId || site.id || site.siteId || site.site_id).filter(Boolean);
                    setSelectedSites(allSiteIds);
                  } else {
                    // Remove "all" if it's in the array and select/deselect sites normally
                    setSelectedSites(value.filter(v => v !== 'all'));
                  }
                }}
                input={<OutlinedInput />}
                renderValue={(selected) => {
                  if (loadingSites) return 'Loading sites...';
                  if (sites.length === 0 && !loadingSites) return 'No sites available';
                  if (selected.length === 0) return 'Select Sites';
                  if (selected.length === sites.length) return 'All Sites';
                  if (selected.length === 1) {
                    const site = sites.find(s => (s.scopeId || s.id || s.siteId || s.site_id) === selected[0]);
                    return site?.scopeName || site?.name || site?.siteName || `Site ${selected[0]}`;
                  }
                  return `${selected.length} Sites`;
                }}
                displayEmpty
              >
                <MenuItem value="all">
                  <em>Select All</em>
                </MenuItem>
                {sites.map((site) => {
                  const siteId = site.scopeId || site.id || site.siteId || site.site_id;
                  const siteName = site.scopeName || site.name || site.siteName || site.site_name || `Site ${siteId}`;
                  return (
                    <MenuItem key={siteId} value={siteId}>
                      {siteName}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      {/* Search and Actions Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Q Search"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small">
                  <FilterIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 300 }}
        />
        <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
          {filteredClients.length} items
        </Typography>
        <Button variant="outlined" size="small" sx={{ whiteSpace: 'nowrap' }}>
          Create Tag
        </Button>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select value="standard" displayEmpty>
            <MenuItem value="standard">Standard</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="List View">
            <IconButton
              size="small"
              color={viewMode === 'list' ? 'primary' : 'default'}
              onClick={() => setViewMode('list')}
            >
              <ViewListIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Grid View">
            <IconButton
              size="small"
              color={viewMode === 'grid' ? 'primary' : 'default'}
              onClick={() => setViewMode('grid')}
            >
              <ViewModuleIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Clients Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('name')}
                  >
                    Name
                    {sortColumn === 'name' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('type')}
                  >
                    Type
                    {sortColumn === 'type' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('mac')}
                  >
                    MAC Address
                    {sortColumn === 'mac' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('ip')}
                  >
                    IP Address
                    {sortColumn === 'ip' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('vlan')}
                  >
                    VLAN
                    {sortColumn === 'vlan' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('connectedTo')}
                  >
                    Connected To
                    {sortColumn === 'connectedTo' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('port')}
                  >
                    Port
                    {sortColumn === 'port' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('role')}
                  >
                    Role
                    {sortColumn === 'role' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('ssid')}
                  >
                    SSID
                    {sortColumn === 'ssid' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => handleSort('site')}
                  >
                    Site Name
                    {sortColumn === 'site' && (
                      sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="textSecondary">
                      {selectedSites.length === 0
                        ? 'Please select one or more sites to view clients'
                        : 'No clients found for the selected sites'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedClients.map((client, index) => {
                const status = client.status?.toLowerCase() || 'unknown';
                const isConnected = status === 'connected';
                const isFailed = status === 'failed';
                const isConnecting = status === 'connecting';
                const isDisconnected = status === 'disconnected';
                const experience = client.experience || 'Good';
                
                // Get status indicator color
                const getStatusColor = () => {
                  if (isConnected) return '#4caf50'; // Green for connected
                  if (isFailed) return '#f44336'; // Red for failed
                  if (isConnecting || isDisconnected) return 'rgb(249, 192, 0)'; // Yellow for connecting/disconnected
                  return '#9e9e9e'; // Gray for unknown
                };
                
                const clientType = client.type?.toLowerCase();
                
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {(isConnected || isFailed || isConnecting || isDisconnected) && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: getStatusColor(),
                            }}
                          />
                        )}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {client.name || client.mac || 'Unknown'}
                          </Typography>
                          {isConnected && (
                            <Typography variant="caption" color="textSecondary">
                              Connected - {experience} Performance
                            </Typography>
                          )}
                          {isFailed && (
                            <Typography variant="caption" color="textSecondary">
                              Failed
                            </Typography>
                          )}
                          {isConnecting && (
                            <Typography variant="caption" color="textSecondary">
                              Connecting
                            </Typography>
                          )}
                          {isDisconnected && (
                            <Typography variant="caption" color="textSecondary">
                              Disconnected
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={client.type || 'Unknown'}
                        icon={clientType === 'wireless' ? <WifiIcon /> : <CableIcon />}
                        sx={{
                          ...(clientType === 'wireless' && {
                            backgroundColor: '#FF6600',
                            color: 'white',
                            '& .MuiChip-icon': {
                              color: 'white',
                            },
                          }),
                          ...(clientType === 'wired' && {
                            backgroundColor: '#01A982',
                            color: 'white',
                            '& .MuiChip-icon': {
                              color: 'white',
                            },
                          }),
                          ...(clientType !== 'wireless' && clientType !== 'wired' && {
                            backgroundColor: '#e0e0e0',
                            color: '#424242',
                          }),
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {client.mac || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {client.ipv4 && (
                          <Typography variant="body2">{client.ipv4}</Typography>
                        )}
                        {client.ipv6 && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            {client.ipv6}
                          </Typography>
                        )}
                        {!client.ipv4 && !client.ipv6 && (
                          <Typography variant="body2" color="textSecondary">
                            -
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {client.vlanId ? (
                        <Typography variant="body2">
                          {client.vlanId}
                          {client.network && ` (${client.network})`}
                        </Typography>
                      ) : client.network ? (
                        <Typography variant="body2">{client.network}</Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {client.connectedTo || client.connected_to || client.device || client.associatedDevice || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {client.port || client.portId || client.port_id || client.interface || client.portName || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {client.role || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {clientType === 'wireless' ? (
                        <Typography variant="body2">
                          {client.essid || client.ssid || client.network || 'N/A'}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {client.siteName || 'Unknown'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default ClientsPage;
