/**
 * Wireless Page
 * Configure WLANs, radios, Hotspot2, Passpoint, Mesh, and IDS
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
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewColumn as ViewColumnIcon,
  GetApp as ExportIcon,
  FileUpload as ImportIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { configAPI } from '../../services/api';
import { exportToCSV, exportToJSON } from '../../utils/exportUtils';

const WLAN_COLUMNS = ['name', 'ssid', 'type', 'status'];
const RADIO_COLUMNS = ['name', 'type', 'status'];
const ALL_WLAN_COLUMNS = [
  { id: 'name', label: 'WLAN Name', default: true },
  { id: 'ssid', label: 'SSID', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'encryption', label: 'Encryption', default: false },
  { id: 'clientCount', label: 'Clients', default: false },
];
const ALL_RADIO_COLUMNS = [
  { id: 'name', label: 'Profile Name', default: true },
  { id: 'type', label: 'Type', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: false },
];

function WirelessPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [wlans, setWlans] = useState([]);
  const [radioProfiles, setRadioProfiles] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:wireless-wlans');
    return saved ? JSON.parse(saved) : WLAN_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:wireless-wlans');
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
        try {
          const data = await configAPI.wireless.getWLANs();
          setWlans(data?.items || data || []);
        } catch (err) {
          setWlans([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load WLANs');
          }
        }
      } else {
        // Radio profiles - would need list endpoint
        setRadioProfiles([]);
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
      const storageKey = `table:sort:wireless-${tabValue === 0 ? 'wlans' : 'radio'}`;
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      const storageKey = `table:columns:wireless-${tabValue === 0 ? 'wlans' : 'radio'}`;
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    const defaults = tabValue === 0 ? WLAN_COLUMNS : RADIO_COLUMNS;
    setVisibleColumns(defaults);
    const storageKey = `table:columns:wireless-${tabValue === 0 ? 'wlans' : 'radio'}`;
    localStorage.setItem(storageKey, JSON.stringify(defaults));
  };

  const getCurrentData = () => tabValue === 0 ? wlans : radioProfiles;
  const getCurrentColumns = () => tabValue === 0 ? ALL_WLAN_COLUMNS : ALL_RADIO_COLUMNS;

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
        exportToCSV(data, `wireless-${tabValue === 0 ? 'wlans' : 'radio'}-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportToJSON(data, `wireless-${tabValue === 0 ? 'wlans' : 'radio'}-${new Date().toISOString().split('T')[0]}.json`);
      }
      setExportDialogOpen(false);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Wireless
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure WLANs, radios, Hotspot2, Passpoint, Mesh, and IDS
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
          {tabValue === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
              Create WLAN
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => {
            setTabValue(newValue);
            const defaults = newValue === 0 ? WLAN_COLUMNS : RADIO_COLUMNS;
            const storageKey = `table:columns:wireless-${newValue === 0 ? 'wlans' : 'radio'}`;
            const saved = localStorage.getItem(storageKey);
            setVisibleColumns(saved ? JSON.parse(saved) : defaults);
          }}>
            <Tab label={`WLANs (${wlans.length})`} />
            <Tab label={`Radio Profiles (${radioProfiles.length})`} />
          </Tabs>
        </Box>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : sortedData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No data available</Typography>
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
                        {tabValue === 0 && (
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
                                  if (window.confirm('Are you sure you want to delete this WLAN?')) {
                                    try {
                                      await configAPI.wireless.deleteWLAN(item.name);
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
        {getCurrentColumns().map((column) => (
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

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedItem ? 'Edit WLAN' : 'Create New WLAN'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Configuration form will be implemented based on API schema
          </Alert>
          <TextField
            fullWidth
            label="WLAN Name"
            margin="normal"
            defaultValue={selectedItem?.name || ''}
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

export default WirelessPage;
