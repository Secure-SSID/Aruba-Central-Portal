/**
 * Configuration Health Page
 * Monitor device configuration health and issues
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
  TextField,
  Menu,
  MenuItem,
  Checkbox,
  Chip,
  Grid,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  ViewColumn as ViewColumnIcon,
  GetApp as ExportIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { configAPI } from '../../services/api';
import { exportToCSV, exportToJSON } from '../../utils/exportUtils';

const HEALTH_COLUMNS = ['deviceId', 'deviceName', 'status', 'issues'];
const ALL_HEALTH_COLUMNS = [
  { id: 'deviceId', label: 'Device ID', default: true },
  { id: 'deviceName', label: 'Device Name', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'issues', label: 'Issues', default: true },
  { id: 'lastChecked', label: 'Last Checked', default: false },
];

function ConfigurationHealthPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [healthData, setHealthData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:config-health');
    return saved ? JSON.parse(saved) : HEALTH_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:config-health');
    return saved ? JSON.parse(saved) : { column: 'deviceName', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError('');
      try {
        const data = await configAPI.configHealth.getHealthSummary();
        setSummary(data && typeof data === 'object' ? data : null);
        // If summary contains device list, use it
        if (data?.items) {
          setHealthData(data.items);
        } else {
          setHealthData([]);
        }
      } catch (err) {
        setSummary(null);
        setHealthData([]);
        if (err.response?.status && err.response.status >= 500) {
          setError(err.message || 'Failed to load health summary');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load health summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeviceHealth = async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      setError('');
      try {
        const data = await configAPI.configHealth.getDeviceHealth(deviceId);
        setHealthData(data && typeof data === 'object' ? [data] : []);
      } catch (err) {
        setHealthData([]);
        if (err.response?.status && err.response.status >= 500) {
          setError(err.message || 'Failed to load device health');
        } else {
          setError('Device not found or health data unavailable');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load device health');
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
      localStorage.setItem('table:sort:config-health', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem('table:columns:config-health', JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(HEALTH_COLUMNS);
    localStorage.setItem('table:columns:config-health', JSON.stringify(HEALTH_COLUMNS));
  };

  const sortedData = [...healthData].sort((a, b) => {
    const aVal = a[sortConfig.column] || '';
    const bVal = b[sortConfig.column] || '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const visibleColumnDefs = ALL_HEALTH_COLUMNS.filter((col) => visibleColumns.includes(col.id));

  const handleExport = async (format) => {
    try {
      if (format === 'csv') {
        exportToCSV(healthData, `config-health-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportToJSON(healthData, `config-health-${new Date().toISOString().split('T')[0]}.json`);
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
            Configuration Health
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor device configuration health and issues
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
            <IconButton onClick={fetchSummary}>
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

      {summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Total Devices</Typography>
                <Typography variant="h4">{summary.totalDevices || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Healthy</Typography>
                <Typography variant="h4" color="success.main">{summary.healthyDevices || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Issues</Typography>
                <Typography variant="h4" color="error.main">{summary.issuesCount || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              size="small"
            />
            <Button variant="contained" onClick={fetchDeviceHealth}>Check Device</Button>
            <Button variant="outlined" onClick={() => {
              setDeviceId('');
              fetchSummary();
            }}>Show All</Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : sortedData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No health data available</Typography>
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
                    <TableRow key={item.deviceId || index} hover>
                      {visibleColumnDefs.map((column) => (
                        <TableCell key={column.id}>
                          {column.id === 'status' ? (
                            <Chip 
                              label={item[column.id] || 'N/A'} 
                              color={item[column.id] === 'healthy' ? 'success' : 'error'} 
                              size="small" 
                            />
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
        {ALL_HEALTH_COLUMNS.map((column) => (
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
        <DialogTitle>Health Details</DialogTitle>
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

export default ConfigurationHealthPage;
