/**
 * Interfaces Page
 * Comprehensive interface management: Device Profiles, Loopback, Management, MAC Lockout, and MACsec
 * Consolidates Interface, Interfaces, and Interface Security categories
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  ViewColumn as ViewColumnIcon,
  GetApp as ExportIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import apiClient from '../../services/api';
import { exportToCSV, exportToJSON } from '../../utils/exportUtils';
import { getErrorMessage } from '../../utils/errorUtils';

// Tab indices
const TAB_DEVICE_PROFILES = 0;
const TAB_LOOPBACK = 1;
const TAB_MANAGEMENT = 2;
const TAB_MAC_LOCKOUT = 3;
const TAB_MACSEC = 4;

// Column definitions
const DEVICE_PROFILE_COLUMNS = ['name', 'type', 'status'];
const ALL_DEVICE_PROFILE_COLUMNS = [
  { id: 'name', label: 'Profile Name', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: false },
];

const LOOPBACK_COLUMNS = ['name', 'ipAddress', 'status'];
const ALL_LOOPBACK_COLUMNS = [
  { id: 'name', label: 'Interface Name', default: true },
  { id: 'ipAddress', label: 'IP Address', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: false },
];

const MANAGEMENT_COLUMNS = ['name', 'ipAddress', 'status'];
const ALL_MANAGEMENT_COLUMNS = [
  { id: 'name', label: 'Interface Name', default: true },
  { id: 'ipAddress', label: 'IP Address', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: false },
];

const MAC_LOCKOUT_COLUMNS = ['name', 'status', 'description'];
const ALL_MAC_LOCKOUT_COLUMNS = [
  { id: 'name', label: 'Profile Name', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: true },
];

const MACSEC_COLUMNS = ['name', 'status', 'description'];
const ALL_MACSEC_COLUMNS = [
  { id: 'name', label: 'Name', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: true },
];

function InterfacesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Data states
  const [deviceProfiles, setDeviceProfiles] = useState([]);
  const [loopbackInterfaces, setLoopbackInterfaces] = useState([]);
  const [managementInterfaces, setManagementInterfaces] = useState([]);
  const [macLockoutProfiles, setMacLockoutProfiles] = useState([]);
  const [macsecConfig, setMacsecConfig] = useState(null);
  
  // UI states
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:interfaces-device-profiles');
    return saved ? JSON.parse(saved) : DEVICE_PROFILE_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:interfaces-device-profiles');
    return saved ? JSON.parse(saved) : { column: 'name', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const getStorageKey = (suffix) => {
    const tabNames = ['device-profiles', 'loopback', 'management', 'mac-lockout', 'macsec'];
    return `table:${suffix}:interfaces-${tabNames[tabValue]}`;
  };

  const getDefaultColumns = () => {
    switch (tabValue) {
      case TAB_DEVICE_PROFILES:
        return DEVICE_PROFILE_COLUMNS;
      case TAB_LOOPBACK:
        return LOOPBACK_COLUMNS;
      case TAB_MANAGEMENT:
        return MANAGEMENT_COLUMNS;
      case TAB_MAC_LOCKOUT:
        return MAC_LOCKOUT_COLUMNS;
      case TAB_MACSEC:
        return MACSEC_COLUMNS;
      default:
        return DEVICE_PROFILE_COLUMNS;
    }
  };

  const getAllColumns = () => {
    switch (tabValue) {
      case TAB_DEVICE_PROFILES:
        return ALL_DEVICE_PROFILE_COLUMNS;
      case TAB_LOOPBACK:
        return ALL_LOOPBACK_COLUMNS;
      case TAB_MANAGEMENT:
        return ALL_MANAGEMENT_COLUMNS;
      case TAB_MAC_LOCKOUT:
        return ALL_MAC_LOCKOUT_COLUMNS;
      case TAB_MACSEC:
        return ALL_MACSEC_COLUMNS;
      default:
        return ALL_DEVICE_PROFILE_COLUMNS;
    }
  };

  const getCurrentData = () => {
    switch (tabValue) {
      case TAB_DEVICE_PROFILES:
        return deviceProfiles;
      case TAB_LOOPBACK:
        return loopbackInterfaces;
      case TAB_MANAGEMENT:
        return managementInterfaces;
      case TAB_MAC_LOCKOUT:
        return macLockoutProfiles;
      case TAB_MACSEC:
        return macsecConfig ? [macsecConfig] : [];
      default:
        return [];
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      switch (tabValue) {
        case TAB_DEVICE_PROFILES:
          try {
            const response = await apiClient.get('/config/device-profile');
            setDeviceProfiles(response.data?.items || response.data || []);
          } catch (err) {
            setDeviceProfiles([]);
            if (err.response?.status === 400 || err.response?.status === 404) {
              const errorMsg = getErrorMessage(err, 'Device profiles endpoint not available or returned an error');
              setError(errorMsg);
            } else if (err.response?.status && err.response.status >= 500) {
              setError(getErrorMessage(err, 'Failed to load device profiles'));
            } else {
              setError(getErrorMessage(err, 'Failed to load device profiles'));
            }
          }
          break;
          
        case TAB_LOOPBACK:
          try {
            const response = await apiClient.get('/config/interface/loopback');
            setLoopbackInterfaces(response.data?.items || response.data || []);
          } catch (err) {
            setLoopbackInterfaces([]);
            if (err.response?.status === 400 || err.response?.status === 404) {
              const errorMsg = getErrorMessage(err, 'Loopback interfaces endpoint not available or returned an error');
              setError(errorMsg);
            } else if (err.response?.status && err.response.status >= 500) {
              setError(getErrorMessage(err, 'Failed to load loopback interfaces'));
            } else {
              setError(getErrorMessage(err, 'Failed to load loopback interfaces'));
            }
          }
          break;
          
        case TAB_MANAGEMENT:
          try {
            const response = await apiClient.get('/config/interface/management');
            setManagementInterfaces(response.data?.items || response.data || []);
          } catch (err) {
            setManagementInterfaces([]);
            if (err.response?.status === 400 || err.response?.status === 404) {
              const errorMsg = getErrorMessage(err, 'Management interfaces endpoint not available or returned an error');
              setError(errorMsg);
            } else if (err.response?.status && err.response.status >= 500) {
              setError(getErrorMessage(err, 'Failed to load management interfaces'));
            } else {
              setError(getErrorMessage(err, 'Failed to load management interfaces'));
            }
          }
          break;
          
        case TAB_MAC_LOCKOUT:
          // MAC Lockout profiles - would need list endpoint
          setMacLockoutProfiles([]);
          break;
          
        case TAB_MACSEC:
          try {
            const response = await apiClient.get('/config/macsec');
            setMacsecConfig(response.data && typeof response.data === 'object' ? response.data : null);
          } catch (err) {
            setMacsecConfig(null);
            if (err.response?.status === 400 || err.response?.status === 404) {
              const errorMsg = getErrorMessage(err, 'MACsec configuration endpoint not available or returned an error');
              setError(errorMsg);
            } else if (err.response?.status && err.response.status >= 500) {
              setError(getErrorMessage(err, 'Failed to load MACsec configuration'));
            } else {
              setError(getErrorMessage(err, 'Failed to load MACsec configuration'));
            }
          }
          break;
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (e, newValue) => {
    setTabValue(newValue);
    const defaults = getDefaultColumns();
    const storageKey = `table:columns:interfaces-${['device-profiles', 'loopback', 'management', 'mac-lockout', 'macsec'][newValue]}`;
    const saved = localStorage.getItem(storageKey);
    setVisibleColumns(saved ? JSON.parse(saved) : defaults);
    
    // Update sort config
    const sortKey = `table:sort:interfaces-${['device-profiles', 'loopback', 'management', 'mac-lockout', 'macsec'][newValue]}`;
    const savedSort = localStorage.getItem(sortKey);
    setSortConfig(savedSort ? JSON.parse(savedSort) : { column: 'name', direction: 'asc' });
  };

  const handleSort = (columnId) => {
    setSortConfig((prev) => {
      const newConfig = {
        column: columnId,
        direction: prev.column === columnId && prev.direction === 'asc' ? 'desc' : 'asc',
      };
      localStorage.setItem(getStorageKey('sort'), JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem(getStorageKey('columns'), JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    const defaults = getDefaultColumns();
    setVisibleColumns(defaults);
    localStorage.setItem(getStorageKey('columns'), JSON.stringify(defaults));
  };

  const sortedData = [...getCurrentData()].sort((a, b) => {
    const aVal = a[sortConfig.column] || '';
    const bVal = b[sortConfig.column] || '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const visibleColumnDefs = getAllColumns().filter((col) => visibleColumns.includes(col.id));

  const handleExport = async (format) => {
    try {
      const data = getCurrentData();
      const tabNames = ['device-profiles', 'loopback', 'management', 'mac-lockout', 'macsec'];
      const filename = `interfaces-${tabNames[tabValue]}-${new Date().toISOString().split('T')[0]}`;
      
      if (format === 'csv') {
        exportToCSV(data, `${filename}.csv`);
      } else {
        exportToJSON(data, `${filename}.json`);
      }
      setExportDialogOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Export failed'));
    }
  };

  const getTabLabel = (index) => {
    const labels = [
      `Device Profiles (${deviceProfiles.length})`,
      `Loopback (${loopbackInterfaces.length})`,
      `Management (${managementInterfaces.length})`,
      `MAC Lockout (${macLockoutProfiles.length})`,
      'MACsec',
    ];
    return labels[index];
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Interfaces
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage device profiles, interfaces (loopback, management), and interface security (MAC lockout, MACsec)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Export">
            <Button variant="outlined" startIcon={<ExportIcon />} onClick={() => setExportDialogOpen(true)}>
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Column Settings">
            <IconButton onClick={(e) => setColumnMenuAnchor(e.currentTarget)}>
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={getTabLabel(0)} />
            <Tab label={getTabLabel(1)} />
            <Tab label={getTabLabel(2)} />
            <Tab label={getTabLabel(3)} />
            <Tab label={getTabLabel(4)} />
          </Tabs>
        </Box>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : sortedData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {tabValue === TAB_MAC_LOCKOUT 
                  ? 'MAC Lockout profiles not available (list endpoint may not be implemented)'
                  : tabValue === TAB_MACSEC && !macsecConfig
                  ? 'MACsec configuration not available'
                  : 'No data available'}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {visibleColumnDefs.map((column) => (
                      <TableCell
                        key={column.id}
                        sx={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                        onClick={() => handleSort(column.id)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {column.label}
                          </Typography>
                          {sortConfig.column === column.id && (
                            sortConfig.direction === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
                          )}
                        </Box>
                      </TableCell>
                    ))}
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedData.map((item, index) => (
                    <TableRow key={item.name || item.id || index} hover>
                      {visibleColumnDefs.map((column) => (
                        <TableCell key={column.id}>
                          {column.id === 'status' ? (
                            <Chip label={item[column.id] || 'N/A'} color="primary" size="small" />
                          ) : (
                            item[column.id] || 'N/A'
                          )}
                        </TableCell>
                      ))}
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedItem(item);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" fontWeight={600}>Select Columns</Typography>
        </MenuItem>
        <MenuItem>
          <Button size="small" onClick={resetColumns}>Reset to Default</Button>
        </MenuItem>
        {getAllColumns().map((column) => (
          <MenuItem key={column.id} onClick={() => handleColumnToggle(column.id)}>
            <Checkbox checked={visibleColumns.includes(column.id)} />
            <Typography>{column.label}</Typography>
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Data</DialogTitle>
        <DialogContent>
          <Typography>Choose export format:</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleExport('csv')}>CSV</Button>
          <Button onClick={() => handleExport('json')}>JSON</Button>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {tabValue === TAB_DEVICE_PROFILES ? 'Device Profile Details' :
           tabValue === TAB_LOOPBACK ? 'Loopback Interface Details' :
           tabValue === TAB_MANAGEMENT ? 'Management Interface Details' :
           tabValue === TAB_MAC_LOCKOUT ? 'MAC Lockout Profile Details' :
           'MACsec Configuration Details'}
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              {Object.entries(selectedItem).map(([key, value]) => (
                <Box key={key} sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    {key.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body1">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || 'N/A')}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InterfacesPage;
