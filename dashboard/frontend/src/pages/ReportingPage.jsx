/**
 * Reporting Page
 *
 * Export-focused report catalog with field selection dialogs.
 * Displays report categories (Network, Wireless, Security, GreenLake, etc.)
 * as clickable cards. Clicking a card opens a CSV export dialog with
 * customizable field selection.
 *
 * Key components:
 * - REPORT_CATEGORIES: Static configuration of available reports
 * - CSVExportDialog: Field selection and CSV generation
 * - ReportCard: Individual report display with record count
 * - ReportSection: Category grouping container
 */

import React, { useState, useEffect, useCallback } from 'react';
import { flattenObject, escapeCSVValue } from '../utils/exportUtils';
import {
  Box,
  Card,
  CardActionArea,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Search as SearchIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
  NetworkCheck as NetworkHealthIcon,
  People as ClientsIcon,
  Wifi as WifiIcon,
  Security as SecurityIcon,
  Inventory as InventoryIcon,
  Speed as SpeedIcon,
  Devices as DevicesIcon,
  Warning as WarningIcon,
  Cloud as CloudIcon,
  LocalOffer as TagIcon,
  Subscriptions as SubscriptionIcon,
  Business as WorkspaceIcon,
  VpnKey as RoleIcon,
  LocationOn as LocationIcon,
  AccountTree as AccountTreeIcon,
  PlayCircle as PlayCircleIcon,
  Edit as EditIcon,
  Bookmark as BookmarkIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  reportingAPI,
  monitoringAPIv2,
  alertsAPI,
  firmwareAPI,
  wlanAPI,
  configAPI,
  greenlakeUserAPI,
  greenlakeDeviceAPI,
  greenlakeTagsAPI,
  greenlakeSubscriptionsAPI,
  greenlakeWorkspacesAPI,
  greenlakeRoleAPI,
  batchAPI,
} from '../services/api';
import { APIMindMapDialog } from '../components/api-mindmap';
import apiCollectionStorage from '../utils/apiCollectionStorage';
import { findEndpointById } from '../config/apiEndpointTree';

/**
 * Format header name from API key for CSV column headers.
 * Transforms camelCase, snake_case, and dot.notation to Title Case.
 *
 * @param {string} key - API field key to format
 * @returns {string} Formatted header name
 *
 * @example
 *   formatHeader('deviceType') -> 'Device Type'
 *   formatHeader('client_count') -> 'Client Count'
 *   formatHeader('gl.subscriptionKey') -> 'Gl > Subscription Key'
 */
const formatHeader = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\./g, ' > ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

// Utility functions (flattenObject, escapeCSVValue) imported from ../utils/exportUtils

/**
 * Get all available fields from data array
 */
const getAvailableFields = (dataArray, priorityKeys = []) => {
  if (!dataArray || dataArray.length === 0) return [];
  const allKeys = new Set();
  dataArray.forEach((item) => {
    const flat = flattenObject(item);
    Object.keys(flat).forEach((key) => allKeys.add(key));
  });
  return Array.from(allKeys).sort((a, b) => {
    const aIdx = priorityKeys.indexOf(a);
    const bIdx = priorityKeys.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
};

/**
 * Export data to CSV with proper escaping and cleanup.
 *
 * @param {Array} data - Array of objects to export
 * @param {Array} selectedFields - Field keys to include in export
 * @param {string} filename - Base filename (date will be appended)
 */
const exportToCSV = (data, selectedFields, filename) => {
  if (!data || data.length === 0 || !selectedFields || selectedFields.length === 0) return;

  const flattenedData = data.map((item) => flattenObject(item));

  // Escape headers to prevent CSV injection
  const header = selectedFields.map((key) => escapeCSVValue(formatHeader(key))).join(',');

  const rows = flattenedData.map((flat) => {
    return selectedFields.map((key) => escapeCSVValue(flat[key])).join(',');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // Use try/finally to ensure URL is always revoked (prevent memory leak)
  const link = document.createElement('a');
  try {
    link.href = url;
    // Generate unique filename with date and time
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `${filename}_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * CSV Export Dialog Component
 */
function CSVExportDialog({ open, onClose, title, data, defaultFields, priorityFields, filename }) {
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [availableFields, setAvailableFields] = useState([]);

  useEffect(() => {
    if (open && data && data.length > 0) {
      const fields = getAvailableFields(data, priorityFields || []);
      setAvailableFields(fields);
      const initialSelected = new Set((defaultFields || []).filter((f) => fields.includes(f)));
      if (initialSelected.size === 0 && fields.length > 0) {
        fields.slice(0, 10).forEach((f) => initialSelected.add(f));
      }
      setSelectedFields(initialSelected);
      setSearchTerm('');
    }
  }, [open, data, defaultFields, priorityFields]);

  const handleToggleField = (field) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleSelectAll = () => {
    const filtered = availableFields.filter(
      (f) =>
        f.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSelectedFields(new Set([...selectedFields, ...filtered]));
  };

  const handleDeselectAll = () => {
    if (searchTerm) {
      const filtered = availableFields.filter(
        (f) =>
          f.toLowerCase().includes(searchTerm.toLowerCase()) ||
          formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSelectedFields((prev) => {
        const next = new Set(prev);
        filtered.forEach((f) => next.delete(f));
        return next;
      });
    } else {
      setSelectedFields(new Set());
    }
  };

  const handleExport = () => {
    exportToCSV(data, Array.from(selectedFields), filename);
    onClose();
  };

  const filteredFields = availableFields.filter(
    (f) =>
      f.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {title}
        <Typography variant="body2" color="text.secondary">
          Select fields to include ({selectedFields.size} of {availableFields.length} selected)
        </Typography>
      </DialogTitle>
      <DialogContent>
        {data && data.length > 0 ? (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ mb: 1, display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<SelectAllIcon />} onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" startIcon={<DeselectIcon />} onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Box>
            <Box
              sx={{
                maxHeight: 350,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }}
            >
              <Grid container spacing={0}>
                {filteredFields.map((field) => (
                  <Grid item xs={6} key={field}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedFields.has(field)}
                          onChange={() => handleToggleField(field)}
                          size="small"
                          sx={{ py: 0.25 }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatHeader(field)}
                        </Typography>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Grid>
                ))}
                {filteredFields.length === 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      No fields match your search
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </>
        ) : (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No data available to export
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={selectedFields.size === 0 || !data || data.length === 0}
          startIcon={<DownloadIcon />}
        >
          Export ({selectedFields.size} fields)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Compact Report Card Component - minimal, clean design
 */
function ReportCard({ title, icon, recordCount, onExport, loading, color = 'primary.main', apiEndpoint }) {
  const isDisabled = loading || recordCount === 0;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'all 0.15s ease-in-out',
        borderColor: 'divider',
        opacity: isDisabled ? 0.6 : 1,
        '&:hover': isDisabled ? {} : {
          borderColor: 'primary.main',
          boxShadow: 1,
          bgcolor: 'action.hover',
        },
      }}
    >
      <CardActionArea
        onClick={onExport}
        disabled={isDisabled}
        sx={{ height: '100%', py: 1.25, px: 1.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color, display: 'flex', fontSize: 18 }}>
            {React.cloneElement(icon, { sx: { fontSize: 18 } })}
          </Box>
          <Typography
            variant="body2"
            fontWeight={500}
            noWrap
            sx={{ flexGrow: 1, fontSize: '0.8rem' }}
          >
            {title}
          </Typography>
          {apiEndpoint && (
            <Tooltip title={apiEndpoint} arrow placement="top">
              <InfoIcon
                sx={{
                  fontSize: 14,
                  color: 'text.secondary',
                  opacity: 0.6,
                  '&:hover': { opacity: 1 }
                }}
              />
            </Tooltip>
          )}
          {loading ? (
            <CircularProgress size={14} />
          ) : recordCount !== undefined ? (
            <Chip
              label={recordCount}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                '& .MuiChip-label': { px: 0.75 }
              }}
            />
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
}

/**
 * Report Category Section - compact header with tight grid
 */
function ReportSection({ title, icon, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        {React.cloneElement(icon, { sx: { fontSize: 18 } })}
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          {title}
        </Typography>
      </Stack>
      <Grid container spacing={1.5}>
        {children}
      </Grid>
    </Box>
  );
}

/**
 * Report definitions organized by category
 */
const REPORT_CATEGORIES = [
  {
    id: 'network',
    title: 'Network Infrastructure',
    icon: <NetworkHealthIcon color="primary" />,
    reports: [
      {
        id: 'devices',
        title: 'All Devices',
        icon: <DevicesIcon />,
        color: 'primary.main',
        apiEndpoint: 'GET /network-monitoring/v1alpha1/devices',
        defaultFields: ['name', 'serial', 'deviceType', 'model', 'status', 'ipAddress', 'site', 'firmwareVersion'],
        priorityFields: ['name', 'serial', 'deviceType', 'model', 'status', 'ipAddress', 'site'],
        filename: 'device_inventory',
      },
      {
        id: 'sites',
        title: 'Sites',
        icon: <LocationIcon />,
        color: 'info.main',
        apiEndpoint: 'GET /network-config/v1alpha1/sites',
        defaultFields: ['site_name', 'site_id', 'address', 'city', 'state', 'country'],
        priorityFields: ['site_name', 'site_id', 'address', 'city', 'state', 'country'],
        filename: 'sites',
      },
    ],
  },
  {
    id: 'wireless',
    title: 'Wireless',
    icon: <WifiIcon color="success" />,
    reports: [
      {
        id: 'wlans',
        title: 'WLANs / SSIDs',
        icon: <WifiIcon />,
        color: 'secondary.main',
        apiEndpoint: 'GET /network-config/v1alpha1/wlan-ssids',
        defaultFields: ['ssid', 'enabled', 'forwardMode', 'opmode', 'rfBand', 'vlanName', 'hideSsid'],
        priorityFields: ['ssid', 'enabled', 'forwardMode', 'opmode', 'rfBand', 'vlanName'],
        filename: 'wlans',
      },
      {
        id: 'clients',
        title: 'Top APs by Clients',
        icon: <ClientsIcon />,
        color: 'primary.main',
        apiEndpoint: 'GET /network-monitoring/v1alpha1/top-aps-by-client-count',
        defaultFields: ['name', 'serial', 'client_count', 'site', 'model'],
        priorityFields: ['name', 'serial', 'client_count', 'site'],
        filename: 'top_aps_by_clients',
      },
      {
        id: 'bandwidth',
        title: 'Top APs by Bandwidth',
        icon: <SpeedIcon />,
        color: 'success.main',
        apiEndpoint: 'GET /network-monitoring/v1alpha1/top-aps-by-wireless-usage',
        defaultFields: ['name', 'serial', 'tx_bytes', 'rx_bytes', 'site'],
        priorityFields: ['name', 'serial', 'tx_bytes', 'rx_bytes', 'site'],
        filename: 'top_aps_by_bandwidth',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Alerts',
    icon: <SecurityIcon color="error" />,
    reports: [
      {
        id: 'alerts',
        title: 'Alerts',
        icon: <WarningIcon />,
        color: 'error.main',
        apiEndpoint: 'GET /network-monitoring/v1alpha1/sites-health (alerts extracted)',
        defaultFields: ['siteName', 'severity', 'count', 'siteId'],
        priorityFields: ['siteName', 'severity', 'count'],
        filename: 'alerts',
      },
      {
        id: 'idps',
        title: 'IDPS Threats',
        icon: <SecurityIcon />,
        color: 'error.main',
        apiEndpoint: 'GET /network-monitoring/v1alpha1/threats',
        defaultFields: ['timestamp', 'signatureName', 'srcIp', 'destIp', 'action', 'severity'],
        priorityFields: ['timestamp', 'signatureName', 'srcIp', 'destIp', 'action'],
        filename: 'idps_threats',
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Inventory',
    icon: <InventoryIcon color="warning" />,
    reports: [
      {
        id: 'firmware',
        title: 'Firmware Compliance',
        icon: <InventoryIcon />,
        color: 'warning.main',
        apiEndpoint: 'GET /network-services/v1alpha1/firmware-details',
        defaultFields: ['deviceName', 'serialNumber', 'deviceType', 'softwareVersion', 'recommendedVersion', 'upgradeStatus'],
        priorityFields: ['deviceName', 'serialNumber', 'deviceType', 'softwareVersion', 'upgradeStatus'],
        filename: 'firmware_compliance',
      },
    ],
  },
  {
    id: 'greenlake',
    title: 'GreenLake Platform',
    icon: <CloudIcon sx={{ color: '#01A982' }} />,
    reports: [
      {
        id: 'gl_users',
        title: 'Users',
        icon: <ClientsIcon />,
        color: '#01A982',
        apiEndpoint: 'GET /identity/v1/users',
        defaultFields: ['username', 'displayName', 'userStatus', 'id', 'createdAt', 'updatedAt'],
        priorityFields: ['username', 'displayName', 'userStatus', 'id'],
        filename: 'greenlake_users',
      },
      {
        id: 'gl_devices',
        title: 'Devices',
        icon: <DevicesIcon />,
        color: '#01A982',
        apiEndpoint: 'GET /devices/v1/devices (enriched with subscription tiers)',
        defaultFields: ['serialNumber', 'deviceType', 'model', 'status', 'location', 'subscription', 'subscription_tier'],
        priorityFields: ['serialNumber', 'deviceType', 'model', 'status', 'subscription_tier'],
        filename: 'greenlake_devices',
      },
      {
        id: 'gl_tags',
        title: 'Tags',
        icon: <TagIcon />,
        color: '#01A982',
        apiEndpoint: 'GET /tags/v1/tags',
        defaultFields: ['name', 'description', 'createdAt', 'resourceCount'],
        priorityFields: ['name', 'description', 'createdAt'],
        filename: 'greenlake_tags',
      },
      {
        id: 'gl_subscriptions',
        title: 'Subscriptions',
        icon: <SubscriptionIcon />,
        color: '#01A982',
        apiEndpoint: 'GET /subscriptions/v1/subscriptions',
        defaultFields: ['id', 'key', 'tier', 'tierDescription', 'subscriptionType', 'subscriptionStatus', 'quantity', 'availableQuantity', 'startTime', 'endTime'],
        priorityFields: ['key', 'tier', 'tierDescription', 'subscriptionStatus', 'quantity'],
        filename: 'greenlake_subscriptions',
      },
      {
        id: 'gl_workspaces',
        title: 'Workspaces',
        icon: <WorkspaceIcon />,
        color: '#01A982',
        apiEndpoint: 'GET /workspaces/v1/workspaces',
        defaultFields: ['name', 'id', 'status', 'createdAt'],
        priorityFields: ['name', 'id', 'status', 'createdAt'],
        filename: 'greenlake_workspaces',
      },
      {
        id: 'gl_roles',
        title: 'Role Assignments',
        icon: <RoleIcon />,
        color: '#01A982',
        apiEndpoint: 'GET /iam/v1/users/{userId}/roles',
        defaultFields: ['userId', 'roleId', 'roleName', 'assignedAt'],
        priorityFields: ['userId', 'roleId', 'roleName'],
        filename: 'greenlake_roles',
      },
    ],
  },
];

function ReportingPage() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState({});
  const [loadingReports, setLoadingReports] = useState({});
  const [error, setError] = useState(null);
  const [glStatus, setGlStatus] = useState({ available: null, error: null });
  const [mindMapOpen, setMindMapOpen] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [savedCollections, setSavedCollections] = useState([]);
  const [executingCollection, setExecutingCollection] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [collectionFieldSelectionOpen, setCollectionFieldSelectionOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState(null);
  const [collectionData, setCollectionData] = useState(null);
  const [collectionSelectedFields, setCollectionSelectedFields] = useState(new Set());
  const [collectionAvailableFields, setCollectionAvailableFields] = useState([]);

  // Handle batch execution from mind map
  const handleBatchExecute = useCallback(async (endpoints) => {
    const results = await batchAPI.executeAll(endpoints);
    setBatchResults(results);
    return results;
  }, []);

  // Handle execute collection - opens field selection dialog
  const handleExecuteCollection = useCallback(async (collection) => {
    setExecutingCollection(collection.id);
    setActiveCollection(collection);
    setError(null);
    
    try {
      // Convert endpoint IDs to full endpoint objects
      const endpoints = collection.endpointIds
        .map(id => findEndpointById(id))
        .filter(Boolean);
      
      if (endpoints.length === 0) {
        setError(`Collection "${collection.name}" has no valid endpoints`);
        setExecutingCollection(null);
        return;
      }

      // Execute to get data
      const results = await batchAPI.executeAll(endpoints);
      setBatchResults(results);
      
      // Extract all data for field analysis - flatten it first to get _tier fields
      const allData = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.data) {
          const items = result.data.items || result.data.devices || result.data.wlans ||
                        result.data.clients || result.data.alerts || result.data.sites ||
                        [result.data];
          if (Array.isArray(items)) {
            items.forEach(item => {
              // Flatten each item to get subscription_tier and other generated fields
              const flattened = flattenObject(item);
              allData.push(flattened);
            });
          }
        }
      });

      if (allData.length === 0) {
        setError(`Collection "${collection.name}" returned no data`);
        setExecutingCollection(null);
        return;
      }

      // Store data for export
      setCollectionData(results);
      
      // Get available fields from flattened data
      const allKeys = new Set();
      allData.forEach((item) => {
        Object.keys(item).forEach((key) => allKeys.add(key));
      });
      const fields = Array.from(allKeys).sort();
      setCollectionAvailableFields(fields);
      
      // Pre-select common useful fields
      const commonFields = ['serialNumber', 'serial', 'name', 'deviceType', 'model', 'status', 'ipAddress', 'site'];
      const preselected = fields.filter(f => commonFields.includes(f));
      setCollectionSelectedFields(new Set(preselected.length > 0 ? preselected : fields.slice(0, 10)));
      
      // Open field selection dialog
      setCollectionFieldSelectionOpen(true);
    } catch (err) {
      setError(`Failed to execute collection: ${err.message}`);
    } finally {
      setExecutingCollection(null);
    }
  }, []);

  // Handle export collection with selected fields
  const handleExportCollection = useCallback(() => {
    if (!collectionData || !activeCollection) return;

    batchAPI.exportAsCSV(collectionData, Array.from(collectionSelectedFields));
    setCollectionFieldSelectionOpen(false);
    setSuccessMessage(`Collection "${activeCollection.name}" exported with ${collectionSelectedFields.size} fields`);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [collectionData, activeCollection, collectionSelectedFields]);

  // Handle open collection in mind map
  const handleOpenInMindMap = useCallback((collection) => {
    // Store collection to load in mind map
    sessionStorage.setItem('loadCollection', JSON.stringify(collection));
    setMindMapOpen(true);
  }, []);

  // Handle export from mind map
  const handleBatchExport = useCallback((endpoints, format, selectedFields) => {
    if (!batchResults || batchResults.length === 0) {
      // Execute first if no results
      batchAPI.executeAll(endpoints).then((results) => {
        if (format === 'csv') {
          batchAPI.exportAsCSV(results, selectedFields);
        } else {
          batchAPI.exportAsJSON(results, selectedFields);
        }
      });
    } else {
      if (format === 'csv') {
        batchAPI.exportAsCSV(batchResults, selectedFields);
      } else {
        batchAPI.exportAsJSON(batchResults, selectedFields);
      }
    }
  }, [batchResults]);

  // Load record counts with error tracking
  const loadReportCounts = useCallback(async () => {
    const failedAPIs = [];

    try {
      const [devices, wlans, sites, alerts] = await Promise.all([
        monitoringAPIv2.getDevicesMonitoring({ limit: 1000 }).catch((e) => {
          failedAPIs.push('Devices');
          console.error('Devices API failed:', e);
          return { items: [] };
        }),
        wlanAPI.getAll().catch((e) => {
          failedAPIs.push('WLANs');
          console.error('WLANs API failed:', e);
          return { wlans: [] };
        }),
        configAPI.getSites().catch((e) => {
          failedAPIs.push('Sites');
          console.error('Sites API failed:', e);
          return { sites: [] };
        }),
        alertsAPI.getAll(null, 100).catch((e) => {
          failedAPIs.push('Alerts');
          console.error('Alerts API failed:', e);
          return { alerts: [] };
        }),
      ]);

      const deviceList = devices.items || devices.devices || [];
      const wlanList = wlans.wlans || wlans.items || [];
      const siteList = sites.sites || sites.items || [];
      const alertList = alerts.alerts || alerts.items || [];

      setReportData((prev) => ({
        ...prev,
        devices: deviceList,
        wlans: wlanList,
        sites: siteList,
        alerts: alertList,
      }));

      // Show warning if some APIs failed
      if (failedAPIs.length > 0) {
        setError(`Some reports unavailable: ${failedAPIs.join(', ')}`);
      }
    } catch (err) {
      console.error('Failed to load report counts:', err);
      setError('Failed to load report data. Please try refreshing the page.');
    }

    // Load GreenLake counts separately (may fail if not configured)
    // Fetch all data without limits to get accurate counts
    try {
      const [glUsers, glDevices, glTags, glSubs, glWorkspaces, glRoles] = await Promise.all([
        greenlakeUserAPI.list().catch(() => null),
        greenlakeDeviceAPI.listWithTiers().catch(() => null),
        greenlakeTagsAPI.list().catch(() => null),
        greenlakeSubscriptionsAPI.list().catch(() => null),
        greenlakeWorkspacesAPI.list().catch(() => null),
        greenlakeRoleAPI.listAssignments().catch(() => null),
      ]);

      // Check if any GreenLake data was returned
      const hasGlData = glUsers || glDevices || glTags || glSubs || glWorkspaces || glRoles;

      setReportData((prev) => ({
        ...prev,
        gl_users: glUsers?.items || glUsers?.users || [],
        gl_devices: glDevices?.items || glDevices?.devices || [],
        gl_tags: glTags?.items || glTags?.tags || [],
        gl_subscriptions: glSubs?.items || glSubs?.subscriptions || [],
        gl_workspaces: glWorkspaces?.items || glWorkspaces?.tenants || [],
        gl_roles: glRoles?.items || glRoles?.assignments || [],
        // Store totals - prioritize API total/count, fallback to actual items length
        gl_users_total: glUsers?.total ?? glUsers?.count ?? (glUsers?.items || glUsers?.users || []).length,
        gl_devices_total: glDevices?.total ?? glDevices?.count ?? (glDevices?.items || glDevices?.devices || []).length,
        gl_tags_total: glTags?.total ?? glTags?.count ?? (glTags?.items || glTags?.tags || []).length,
        gl_subscriptions_total: glSubs?.total ?? glSubs?.count ?? (glSubs?.items || glSubs?.subscriptions || []).length,
        gl_workspaces_total: glWorkspaces?.total ?? glWorkspaces?.count ?? (glWorkspaces?.items || glWorkspaces?.tenants || []).length,
        gl_roles_total: glRoles?.total ?? glRoles?.count ?? (glRoles?.items || glRoles?.assignments || []).length,
      }));

      setGlStatus({
        available: hasGlData,
        error: hasGlData ? null : 'GreenLake integration not configured',
      });
    } catch (err) {
      console.error('GreenLake reports not available:', err);
      setGlStatus({
        available: false,
        error: err.response?.status === 401
          ? 'GreenLake authentication required'
          : 'GreenLake integration unavailable',
      });
    }
  }, []);

  // Load record counts on mount
  useEffect(() => {
    loadReportCounts();
  }, [loadReportCounts]);

  // Load saved collections on mount and when dialog closes
  useEffect(() => {
    setSavedCollections(apiCollectionStorage.getCollections());
  }, [mindMapOpen]);

  const loadReportData = async (reportId) => {
    setLoadingReports((prev) => ({ ...prev, [reportId]: true }));
    setError(null);

    try {
      let data = [];

      switch (reportId) {
        case 'devices': {
          const response = await monitoringAPIv2.getDevicesMonitoring({ limit: 1000 });
          data = response.items || response.devices || [];
          break;
        }
        case 'wlans': {
          const response = await wlanAPI.getAll();
          data = response.wlans || response.items || [];
          break;
        }
        case 'clients': {
          const response = await reportingAPI.getTopAPsByClientCount(null, 100);
          data = response.aps || response.items || [];
          break;
        }
        case 'bandwidth': {
          const response = await reportingAPI.getTopAPsByWirelessUsage(null, 100);
          data = response.aps || response.items || [];
          break;
        }
        case 'sites': {
          const response = await configAPI.getSites();
          data = response.sites || response.items || [];
          break;
        }
        case 'alerts': {
          const response = await alertsAPI.getAll(null, 500);
          data = response.alerts || response.items || [];
          break;
        }
        case 'firmware': {
          const response = await firmwareAPI.getCompliance();
          data = response.devices || response.items || [];
          break;
        }
        case 'idps': {
          const response = await monitoringAPIv2.getIDPSEvents();
          data = response.events || response.items || [];
          break;
        }
        // GreenLake Reports - fetch all without limits
        case 'gl_users': {
          const response = await greenlakeUserAPI.list();
          data = response.items || response.users || [];
          break;
        }
        case 'gl_devices': {
          const response = await greenlakeDeviceAPI.listWithTiers();
          data = response.items || response.devices || [];
          break;
        }
        case 'gl_tags': {
          const response = await greenlakeTagsAPI.list();
          data = response.items || response.tags || [];
          break;
        }
        case 'gl_subscriptions': {
          const response = await greenlakeSubscriptionsAPI.list();
          data = response.items || response.subscriptions || [];
          break;
        }
        case 'gl_workspaces': {
          const response = await greenlakeWorkspacesAPI.list();
          data = response.items || response.tenants || [];
          break;
        }
        case 'gl_roles': {
          const response = await greenlakeRoleAPI.listAssignments();
          data = response.items || response.assignments || [];
          break;
        }
        default:
          console.error(`Unknown report type: ${reportId}`);
          throw new Error(`Report type "${reportId}" is not implemented`);
      }

      setReportData((prev) => ({ ...prev, [reportId]: data }));
      return data;
    } catch (err) {
      console.error(`Failed to load ${reportId} report:`, err);
      setError(`Failed to load ${reportId} data: ${err.message}`);
      return [];
    } finally {
      setLoadingReports((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const handleExportClick = useCallback(async (report) => {
    setActiveReport(report);
    setError(null);

    try {
      if (!reportData[report.id] || reportData[report.id].length === 0) {
        const data = await loadReportData(report.id);
        if (!data || data.length === 0) {
          setError(`No data available for ${report.title}`);
          return; // Don't open dialog with no data
        }
      }
      setExportDialogOpen(true);
    } catch (err) {
      // Error already set by loadReportData, don't open dialog
      console.error(`Export click failed for ${report.id}:`, err);
    }
  }, [reportData]);

  const getRecordCount = (reportId) => {
    // For GreenLake reports, use stored totals (since we fetch with limit:1 initially)
    if (reportId.startsWith('gl_')) {
      const totalKey = `${reportId}_total`;
      if (reportData[totalKey] !== undefined) {
        return reportData[totalKey];
      }
    }
    const data = reportData[reportId];
    return data ? data.length : undefined;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.25 }}>
            Reports
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click a report to export data as CSV
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<AccountTreeIcon />}
          onClick={() => setMindMapOpen(true)}
          size="small"
        >
          API Mind Map
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Success Alert */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* GreenLake Status Alert */}
      {glStatus.available === false && glStatus.error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {glStatus.error}. GreenLake reports will show 0 records.
        </Alert>
      )}

      {/* Saved Collections Section */}
      {savedCollections.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
            <BookmarkIcon sx={{ fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
              Saved Collections ({savedCollections.length})
            </Typography>
          </Stack>
          <Grid container spacing={1.5}>
            {savedCollections.map((collection) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={collection.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    transition: 'all 0.15s ease-in-out',
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 1,
                    },
                  }}
                >
                  <CardActionArea
                    component="div"
                    onClick={() => handleExecuteCollection(collection)}
                    disabled={executingCollection === collection.id}
                    sx={{ height: '100%', p: 1.5 }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box sx={{ color: 'primary.main', display: 'flex' }}>
                          {executingCollection === collection.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PlayCircleIcon sx={{ fontSize: 20 }} />
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            noWrap
                            sx={{ mb: 0.25 }}
                          >
                            {collection.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.3,
                            }}
                          >
                            {collection.description || 'No description'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={`${collection.endpointIds.length} endpoints`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        <Button
                          size="small"
                          startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInMindMap(collection);
                          }}
                          sx={{ ml: 'auto', fontSize: '0.7rem', minWidth: 0, px: 0.75 }}
                        >
                          Edit
                        </Button>
                      </Stack>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Report Sections */}
      {REPORT_CATEGORIES.map((category) => (
        <ReportSection key={category.id} title={category.title} icon={category.icon}>
          {category.reports.map((report) => (
            <Grid item xs={6} sm={4} md={3} lg={2} xl={2} key={report.id}>
              <ReportCard
                title={report.title}
                icon={report.icon}
                color={report.color}
                apiEndpoint={report.apiEndpoint}
                recordCount={getRecordCount(report.id)}
                loading={loadingReports[report.id]}
                onExport={() => handleExportClick(report)}
              />
            </Grid>
          ))}
        </ReportSection>
      ))}

      {/* Export Dialog */}
      {activeReport && (
        <CSVExportDialog
          open={exportDialogOpen}
          onClose={() => {
            setExportDialogOpen(false);
            setActiveReport(null);
          }}
          title={`Export ${activeReport.title}`}
          data={reportData[activeReport.id] || []}
          defaultFields={activeReport.defaultFields}
          priorityFields={activeReport.priorityFields}
          filename={activeReport.filename}
        />
      )}

      {/* API Mind Map Dialog */}
      <APIMindMapDialog
        open={mindMapOpen}
        onClose={() => {
          setMindMapOpen(false);
          setBatchResults(null);
        }}
        onExecute={handleBatchExecute}
        onExport={handleBatchExport}
      />

      {/* Collection Field Selection Dialog */}
      <Dialog
        open={collectionFieldSelectionOpen}
        onClose={() => setCollectionFieldSelectionOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6">
                {activeCollection?.name || 'Select Fields'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose fields to export ({collectionSelectedFields.size} of {collectionAvailableFields.length} selected)
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setCollectionFieldSelectionOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
              size="small"
              startIcon={<SelectAllIcon />}
              onClick={() => setCollectionSelectedFields(new Set(collectionAvailableFields))}
            >
              Select All
            </Button>
            <Button
              size="small"
              startIcon={<DeselectIcon />}
              onClick={() => setCollectionSelectedFields(new Set())}
            >
              Deselect All
            </Button>
          </Stack>

          <Box
            sx={{
              maxHeight: 400,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
            }}
          >
            <Grid container spacing={0}>
              {collectionAvailableFields.map((field) => (
                <Grid item xs={6} key={field}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={collectionSelectedFields.has(field)}
                        onChange={(e) => {
                          setCollectionSelectedFields((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(field);
                            } else {
                              next.delete(field);
                            }
                            return next;
                          });
                        }}
                        size="small"
                        sx={{ py: 0.25 }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                        {formatHeader(field)}
                      </Typography>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Grid>
              ))}
              {collectionAvailableFields.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    No fields available
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectionFieldSelectionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExportCollection}
            disabled={collectionSelectedFields.size === 0}
            startIcon={<DownloadIcon />}
          >
            Export CSV ({collectionSelectedFields.size} fields)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ReportingPage;
