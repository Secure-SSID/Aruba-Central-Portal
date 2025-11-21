/**
 * High Availability Page
 * Configure switch stacks and VSX profiles
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

const STACK_COLUMNS = ['stackId', 'name', 'memberCount', 'status'];
const VSX_COLUMNS = ['name', 'status', 'description'];
const ALL_STACK_COLUMNS = [
  { id: 'stackId', label: 'Stack ID', default: true },
  { id: 'name', label: 'Name', default: true },
  { id: 'memberCount', label: 'Members', default: true },
  { id: 'status', label: 'Status', default: true },
];
const ALL_VSX_COLUMNS = [
  { id: 'name', label: 'Profile Name', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'description', label: 'Description', default: true },
];

function HighAvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [stacks, setStacks] = useState([]);
  const [vsxProfiles, setVsxProfiles] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:ha-stacks');
    return saved ? JSON.parse(saved) : STACK_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:ha-stacks');
    return saved ? JSON.parse(saved) : { column: 'name', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      if (tabValue === 0) {
        try {
          const response = await apiClient.get('/config/stack');
          setStacks(response.data?.items || response.data || []);
        } catch (err) {
          setStacks([]);
          if (err.response?.status && err.response.status >= 500) {
            setError(err.message || 'Failed to load stacks');
          }
        }
      } else {
        // VSX profiles - would need to fetch individually or have list endpoint
        setVsxProfiles([]);
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
      const storageKey = `table:sort:ha-${tabValue === 0 ? 'stacks' : 'vsx'}`;
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      const storageKey = `table:columns:ha-${tabValue === 0 ? 'stacks' : 'vsx'}`;
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    const defaults = tabValue === 0 ? STACK_COLUMNS : VSX_COLUMNS;
    setVisibleColumns(defaults);
    const storageKey = `table:columns:ha-${tabValue === 0 ? 'stacks' : 'vsx'}`;
    localStorage.setItem(storageKey, JSON.stringify(defaults));
  };

  const getCurrentData = () => tabValue === 0 ? stacks : vsxProfiles;
  const getCurrentColumns = () => tabValue === 0 ? ALL_STACK_COLUMNS : ALL_VSX_COLUMNS;

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
        exportToCSV(data, `ha-${tabValue === 0 ? 'stacks' : 'vsx'}-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportToJSON(data, `ha-${tabValue === 0 ? 'stacks' : 'vsx'}-${new Date().toISOString().split('T')[0]}.json`);
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
            High Availability
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure switch stacks and VSX profiles
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
          <Tabs value={tabValue} onChange={(e, newValue) => {
            setTabValue(newValue);
            const defaults = newValue === 0 ? STACK_COLUMNS : VSX_COLUMNS;
            const storageKey = `table:columns:ha-${newValue === 0 ? 'stacks' : 'vsx'}`;
            const saved = localStorage.getItem(storageKey);
            setVisibleColumns(saved ? JSON.parse(saved) : defaults);
          }}>
            <Tab label={`Stacks (${stacks.length})`} />
            <Tab label={`VSX Profiles (${vsxProfiles.length})`} />
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
                    <TableRow key={item.stackId || item.name || index} hover>
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
    </Box>
  );
}

export default HighAvailabilityPage;
