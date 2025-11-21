/**
 * Central NAC Page
 * Configure authorization policies, identity stores, portal profiles, and authentication
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  Checkbox,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  GetApp as ExportIcon,
  FileUpload as ImportIcon,
  ViewColumn as ViewColumnIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { configAPI } from '../../services/api';
import { exportToCSV, exportToJSON } from '../../utils/exportUtils';

// Default columns for each resource type
const AUTHZ_POLICY_COLUMNS = ['name', 'status'];
const IDENTITY_STORE_COLUMNS = ['name', 'type', 'status'];
const PORTAL_PROFILE_COLUMNS = ['name', 'status', 'description'];
const AUTH_PROFILE_COLUMNS = ['name', 'status'];

const ALL_AUTHZ_POLICY_COLUMNS = [
  { id: 'name', label: 'Policy Name', default: true },
  { id: 'status', label: 'Status', default: true },
];

const ALL_IDENTITY_STORE_COLUMNS = [
  { id: 'name', label: 'Store Name', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'status', label: 'Status', default: false },
];

const ALL_PORTAL_PROFILE_COLUMNS = [
  { id: 'name', label: 'Profile Name', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: false },
];

const ALL_AUTH_PROFILE_COLUMNS = [
  { id: 'name', label: 'Profile Name', default: true },
  { id: 'status', label: 'Status', default: true },
];

function CentralNACPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Data states
  const [authzPolicy, setAuthzPolicy] = useState(null);
  const [identityStore, setIdentityStore] = useState(null);
  const [portalProfiles, setPortalProfiles] = useState([]);
  const [authProfile, setAuthProfile] = useState(null);
  
  // Table customization
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:central-nac-authz-policy');
    return saved ? JSON.parse(saved) : AUTHZ_POLICY_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:central-nac-authz-policy');
    return saved ? JSON.parse(saved) : { column: 'name', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (tabValue === 0) {
        // Authz Policy
        try {
          const data = await configAPI.centralNAC.getAuthzPolicy();
          setAuthzPolicy(data && typeof data === 'object' ? data : null);
        } catch (err) {
          setAuthzPolicy(null);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load authorization policy');
          }
        }
      } else if (tabValue === 1) {
        // Identity Store
        try {
          const data = await configAPI.centralNAC.getIdentityStore();
          setIdentityStore(data && typeof data === 'object' ? data : null);
        } catch (err) {
          setIdentityStore(null);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load identity store');
          }
        }
      } else if (tabValue === 2) {
        // Portal Profiles - API doesn't have a list endpoint
        setPortalProfiles([]);
      } else if (tabValue === 3) {
        // Auth Profile
        try {
          const data = await configAPI.centralNAC.getAuthProfile();
          setAuthProfile(data && typeof data === 'object' ? data : null);
        } catch (err) {
          setAuthProfile(null);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load auth profile');
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (columnId) => {
    setSortConfig((prev) => {
      const newConfig = {
        column: columnId,
        direction: prev.column === columnId && prev.direction === 'asc' ? 'desc' : 'asc',
      };
      const storageKey = `table:sort:central-nac-${getCurrentResourceType()}`;
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const getCurrentResourceType = () => {
    const types = ['authz-policy', 'identity-store', 'portal-profiles', 'auth-profile'];
    return types[tabValue] || 'authz-policy';
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      const storageKey = `table:columns:central-nac-${getCurrentResourceType()}`;
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    const defaults = {
      0: AUTHZ_POLICY_COLUMNS,
      1: IDENTITY_STORE_COLUMNS,
      2: PORTAL_PROFILE_COLUMNS,
      3: AUTH_PROFILE_COLUMNS,
    };
    const defaultCols = defaults[tabValue] || AUTHZ_POLICY_COLUMNS;
    setVisibleColumns(defaultCols);
    const storageKey = `table:columns:central-nac-${getCurrentResourceType()}`;
    localStorage.setItem(storageKey, JSON.stringify(defaultCols));
  };

  const getCurrentColumns = () => {
    const columnSets = {
      0: ALL_AUTHZ_POLICY_COLUMNS,
      1: ALL_IDENTITY_STORE_COLUMNS,
      2: ALL_PORTAL_PROFILE_COLUMNS,
      3: ALL_AUTH_PROFILE_COLUMNS,
    };
    return columnSets[tabValue] || ALL_AUTHZ_POLICY_COLUMNS;
  };

  const getCurrentData = () => {
    if (tabValue === 0) {
      return authzPolicy && typeof authzPolicy === 'object' && Object.keys(authzPolicy).length > 0 ? [authzPolicy] : [];
    }
    if (tabValue === 1) {
      return identityStore && typeof identityStore === 'object' && Object.keys(identityStore).length > 0 ? [identityStore] : [];
    }
    if (tabValue === 2) return Array.isArray(portalProfiles) ? portalProfiles : [];
    if (tabValue === 3) {
      return authProfile && typeof authProfile === 'object' && Object.keys(authProfile).length > 0 ? [authProfile] : [];
    }
    return [];
  };

  const sortedData = [...getCurrentData()].sort((a, b) => {
    const aVal = a[sortConfig.column] || '';
    const bVal = b[sortConfig.column] || '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const visibleColumnDefs = getCurrentColumns().filter((col) => visibleColumns.includes(col.id));

  const handleExport = async (format) => {
    try {
      const data = getCurrentData();
      if (format === 'csv') {
        exportToCSV(data, `central-nac-${getCurrentResourceType()}-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportToJSON(data, `central-nac-${getCurrentResourceType()}-${new Date().toISOString().split('T')[0]}.json`);
      }
      setExportDialogOpen(false);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  };

  const renderTable = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    const data = sortedData || [];
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {error ? 'Error loading data. Please try refreshing.' : 'No data available'}
          </Typography>
        </Box>
      );
    }

    return (
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
            {data.map((item, index) => (
              <TableRow key={item.id || item.name || index} hover>
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
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedItem(item);
                        setCreateDialogOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete this item?')) {
                          try {
                            if (tabValue === 0) {
                              await configAPI.centralNAC.deleteAuthzPolicy();
                            } else if (tabValue === 1) {
                              await configAPI.centralNAC.deleteIdentityStore();
                            } else if (tabValue === 2) {
                              await configAPI.centralNAC.deletePortalProfile(item.name);
                            } else if (tabValue === 3) {
                              await configAPI.centralNAC.deleteAuthProfile();
                            }
                            fetchData();
                          } catch (err) {
                            setError(err.message || 'Delete failed');
                          }
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Central NAC
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure authorization policies, identity stores, portal profiles, and authentication
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Import">
            <Button
              variant="outlined"
              startIcon={<ImportIcon />}
              onClick={() => setImportDialogOpen(true)}
            >
              Import
            </Button>
          </Tooltip>
          <Tooltip title="Export">
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={() => setExportDialogOpen(true)}
            >
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Create
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => {
            setTabValue(newValue);
            const defaults = {
              0: AUTHZ_POLICY_COLUMNS,
              1: IDENTITY_STORE_COLUMNS,
              2: PORTAL_PROFILE_COLUMNS,
              3: AUTH_PROFILE_COLUMNS,
            };
            const storageKey = `table:columns:central-nac-${['authz-policy', 'identity-store', 'portal-profiles', 'auth-profile'][newValue]}`;
            const saved = localStorage.getItem(storageKey);
            setVisibleColumns(saved ? JSON.parse(saved) : (defaults[newValue] || AUTHZ_POLICY_COLUMNS));
          }}>
            <Tab label="Authorization Policy" />
            <Tab label="Identity Store" />
            <Tab label={`Portal Profiles (${portalProfiles.length})`} />
            <Tab label="Auth Profile" />
          </Tabs>
        </Box>
        <CardContent>
          {renderTable()}
        </CardContent>
      </Card>

      {/* Column Selector Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" fontWeight={600}>
            Select Columns
          </Typography>
        </MenuItem>
        <MenuItem>
          <Button size="small" onClick={resetColumns}>
            Reset to Default
          </Button>
        </MenuItem>
        {getCurrentColumns().map((column) => (
          <MenuItem key={column.id} onClick={() => handleColumnToggle(column.id)}>
            <Checkbox checked={visibleColumns.includes(column.id)} />
            <Typography>{column.label}</Typography>
          </MenuItem>
        ))}
      </Menu>

      {/* Export Dialog */}
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

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a template format and upload your file
          </Typography>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }}>
            Download CSV Template
            <input type="file" hidden accept=".csv" />
          </Button>
          <Button variant="outlined" component="label" fullWidth>
            Download JSON Template
            <input type="file" hidden accept=".json" />
          </Button>
          <TextField
            fullWidth
            type="file"
            margin="normal"
            inputProps={{ accept: '.csv,.json' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            setImportDialogOpen(false);
          }}>
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Details</DialogTitle>
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

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedItem ? 'Edit' : 'Create New'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Configuration form will be implemented based on API schema
          </Alert>
          <TextField
            fullWidth
            label="Name"
            margin="normal"
            defaultValue={selectedItem?.name || ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            setCreateDialogOpen(false);
            fetchData();
          }}>
            {selectedItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default CentralNACPage;
