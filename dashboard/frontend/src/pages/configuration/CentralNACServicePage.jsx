/**
 * Central NAC Service Page
 * Manage MAC/MPSK registrations, visitors, jobs, images, and certificates
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
const MAC_REGISTRATION_COLUMNS = ['macAddress', 'deviceType', 'description', 'status'];
const MPSK_REGISTRATION_COLUMNS = ['name', 'passphrase', 'ssid', 'status'];
const VISITOR_COLUMNS = ['name', 'email', 'status', 'expiresAt'];
const JOB_COLUMNS = ['jobId', 'type', 'status', 'createdAt'];
const IMAGE_COLUMNS = ['name', 'type', 'size', 'uploadedAt'];
const CERTIFICATE_COLUMNS = ['name', 'type', 'status', 'expiresAt'];

const ALL_MAC_REGISTRATION_COLUMNS = [
  { id: 'macAddress', label: 'MAC Address', default: true },
  { id: 'deviceType', label: 'Device Type', default: true },
  { id: 'description', label: 'Description', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'userId', label: 'User ID', default: false },
  { id: 'createdAt', label: 'Created', default: false },
  { id: 'expiresAt', label: 'Expires', default: false },
];

const ALL_MPSK_REGISTRATION_COLUMNS = [
  { id: 'name', label: 'Name', default: true },
  { id: 'passphrase', label: 'Passphrase', default: true },
  { id: 'ssid', label: 'SSID', default: true },
  { id: 'status', label: 'Status', default: true },
];

const ALL_VISITOR_COLUMNS = [
  { id: 'name', label: 'Name', default: true },
  { id: 'email', label: 'Email', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'expiresAt', label: 'Expires', default: true },
];

const ALL_JOB_COLUMNS = [
  { id: 'jobId', label: 'Job ID', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'createdAt', label: 'Created', default: true },
];

const ALL_IMAGE_COLUMNS = [
  { id: 'name', label: 'Name', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'size', label: 'Size', default: true },
  { id: 'uploadedAt', label: 'Uploaded', default: true },
];

const ALL_CERTIFICATE_COLUMNS = [
  { id: 'name', label: 'Name', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'expiresAt', label: 'Expires', default: true },
];

function CentralNACServicePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Data states
  const [macRegistrations, setMacRegistrations] = useState([]);
  const [mpskRegistrations, setMpskRegistrations] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [images, setImages] = useState([]);
  const [certificates, setCertificates] = useState([]);
  
  // Table customization
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:nac-service-mac-registrations');
    return saved ? JSON.parse(saved) : MAC_REGISTRATION_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:nac-service-mac-registrations');
    return saved ? JSON.parse(saved) : { column: 'macAddress', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (tabValue === 0) {
        // MAC Registrations
        try {
          const data = await configAPI.nacService.getMACRegistrations();
          setMacRegistrations(data?.items || data || []);
        } catch (err) {
          setMacRegistrations([]);
          // Don't show error for 400/404 - API might not be available
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load MAC registrations');
          }
        }
      } else if (tabValue === 1) {
        // MPSK Registrations
        try {
          const data = await configAPI.nacService.getMPSKRegistrations();
          setMpskRegistrations(data?.items || data || []);
        } catch (err) {
          setMpskRegistrations([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load MPSK registrations');
          }
        }
      } else if (tabValue === 2) {
        // Visitors
        try {
          const data = await configAPI.nacService.getVisitors();
          setVisitors(data?.items || data || []);
        } catch (err) {
          setVisitors([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load visitors');
          }
        }
      } else if (tabValue === 3) {
        // Jobs
        try {
          const data = await configAPI.nacService.getJobs();
          setJobs(data?.items || data || []);
        } catch (err) {
          setJobs([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load jobs');
          }
        }
      } else if (tabValue === 4) {
        // Images
        try {
          const data = await configAPI.nacService.getImages();
          setImages(data?.items || data || []);
        } catch (err) {
          setImages([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load images');
          }
        }
      } else if (tabValue === 5) {
        // Certificates
        try {
          const data = await configAPI.nacService.getUserCertificates();
          setCertificates(data?.items || data || []);
        } catch (err) {
          setCertificates([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load certificates');
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
      const storageKey = `table:sort:nac-service-${getCurrentResourceType()}`;
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const getCurrentResourceType = () => {
    const types = ['mac-registrations', 'mpsk-registrations', 'visitors', 'jobs', 'images', 'certificates'];
    return types[tabValue] || 'mac-registrations';
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      const storageKey = `table:columns:nac-service-${getCurrentResourceType()}`;
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    const defaults = {
      0: MAC_REGISTRATION_COLUMNS,
      1: MPSK_REGISTRATION_COLUMNS,
      2: VISITOR_COLUMNS,
      3: JOB_COLUMNS,
      4: IMAGE_COLUMNS,
      5: CERTIFICATE_COLUMNS,
    };
    const defaultCols = defaults[tabValue] || MAC_REGISTRATION_COLUMNS;
    setVisibleColumns(defaultCols);
    const storageKey = `table:columns:nac-service-${getCurrentResourceType()}`;
    localStorage.setItem(storageKey, JSON.stringify(defaultCols));
  };

  const getCurrentColumns = () => {
    const columnSets = {
      0: ALL_MAC_REGISTRATION_COLUMNS,
      1: ALL_MPSK_REGISTRATION_COLUMNS,
      2: ALL_VISITOR_COLUMNS,
      3: ALL_JOB_COLUMNS,
      4: ALL_IMAGE_COLUMNS,
      5: ALL_CERTIFICATE_COLUMNS,
    };
    return columnSets[tabValue] || ALL_MAC_REGISTRATION_COLUMNS;
  };

  const getCurrentData = () => {
    if (tabValue === 0) return macRegistrations;
    if (tabValue === 1) return mpskRegistrations;
    if (tabValue === 2) return visitors;
    if (tabValue === 3) return jobs;
    if (tabValue === 4) return images;
    if (tabValue === 5) return certificates;
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
      if (tabValue === 0) {
        // MAC Registrations have special export endpoint
        const blob = await configAPI.nacService.exportMACRegistrations();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mac-registrations-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = getCurrentData();
        if (format === 'csv') {
          exportToCSV(data, `nac-service-${getCurrentResourceType()}-${new Date().toISOString().split('T')[0]}.csv`);
        } else {
          exportToJSON(data, `nac-service-${getCurrentResourceType()}-${new Date().toISOString().split('T')[0]}.json`);
        }
      }
      setExportDialogOpen(false);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    try {
      if (tabValue === 0) {
        // MAC Registrations have special import endpoint
        await configAPI.nacService.importMACRegistrations(selectedFile);
      } else {
        // For other resources, use generic import
        const formData = new FormData();
        formData.append('file', selectedFile);
        // TODO: Implement generic import endpoint
      }
      setImportDialogOpen(false);
      setSelectedFile(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Import failed');
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
            {data.map((item, index) => {
              if (!item || typeof item !== 'object') return null;
              return (
                <TableRow key={item.id || item.macId || item.macAddress || item.jobId || item.name || index} hover>
                  {visibleColumnDefs.map((column) => (
                    <TableCell key={column.id}>
                      {column.id === 'status' ? (
                        <Chip label={item[column.id] || 'N/A'} color="primary" size="small" />
                      ) : column.id === 'macAddress' ? (
                        <Typography variant="body2" fontFamily="monospace">
                          {item[column.id] || 'N/A'}
                        </Typography>
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
                    {tabValue !== 3 && ( // Jobs are read-only
                      <>
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
                                    await configAPI.nacService.deleteMACRegistration(item.macId || item.id);
                                  } else if (tabValue === 1) {
                                    await configAPI.nacService.deleteMPSKRegistration(item.id);
                                  } else if (tabValue === 2) {
                                    await configAPI.nacService.deleteVisitor(item.id);
                                  } else if (tabValue === 4) {
                                    await configAPI.nacService.deleteImage(item.id);
                                  } else if (tabValue === 5) {
                                    await configAPI.nacService.deleteUserCertificate(item.id);
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
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
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
            Central NAC Service
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage MAC/MPSK registrations, visitors, jobs, images, and certificates
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
          {tabValue !== 3 && ( // Jobs don't have create
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
              Create
            </Button>
          )}
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
              0: MAC_REGISTRATION_COLUMNS,
              1: MPSK_REGISTRATION_COLUMNS,
              2: VISITOR_COLUMNS,
              3: JOB_COLUMNS,
              4: IMAGE_COLUMNS,
              5: CERTIFICATE_COLUMNS,
            };
            const storageKey = `table:columns:nac-service-${['mac-registrations', 'mpsk-registrations', 'visitors', 'jobs', 'images', 'certificates'][newValue]}`;
            const saved = localStorage.getItem(storageKey);
            setVisibleColumns(saved ? JSON.parse(saved) : (defaults[newValue] || MAC_REGISTRATION_COLUMNS));
          }}>
            <Tab label={`MAC Registrations (${macRegistrations.length})`} />
            <Tab label={`MPSK Registrations (${mpskRegistrations.length})`} />
            <Tab label={`Visitors (${visitors.length})`} />
            <Tab label={`Jobs (${jobs.length})`} />
            <Tab label={`Images (${images.length})`} />
            <Tab label={`Certificates (${certificates.length})`} />
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
          <Button 
            variant="outlined" 
            component="label" 
            fullWidth 
            sx={{ mb: 2 }}
            onClick={() => {
              // Generate CSV template
              const headers = getCurrentColumns().map(col => col.label);
              const template = headers.join(',') + '\n';
              const blob = new Blob([template], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${getCurrentResourceType()}-template.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download CSV Template
          </Button>
          <TextField
            fullWidth
            type="file"
            margin="normal"
            inputProps={{ accept: '.csv,.json' }}
            onChange={(e) => setSelectedFile(e.target.files[0])}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setImportDialogOpen(false);
            setSelectedFile(null);
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleImport} disabled={!selectedFile}>
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
            label={tabValue === 0 ? 'MAC Address' : 'Name'}
            margin="normal"
            defaultValue={selectedItem?.macAddress || selectedItem?.name || ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setSelectedItem(null);
          }}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            try {
              // TODO: Implement create/update with proper data
              setCreateDialogOpen(false);
              setSelectedItem(null);
              fetchData();
            } catch (err) {
              setError(err.message || 'Operation failed');
            }
          }}>
            {selectedItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default CentralNACServicePage;
