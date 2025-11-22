/**
 * VLANs & Networks Page
 * Manage VLANs, VRRP, MVRP, STP, and network configurations
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
import { configAPI } from '../../services/api';
import { exportToCSV, exportToJSON } from '../../utils/exportUtils';

const VLAN_COLUMNS = ['vlanId', 'name', 'description', 'status'];
const ALL_VLAN_COLUMNS = [
  { id: 'vlanId', label: 'VLAN ID', default: true },
  { id: 'name', label: 'Name', default: true },
  { id: 'description', label: 'Description', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'subnet', label: 'Subnet', default: false },
  { id: 'gateway', label: 'Gateway', default: false },
];

function VLANsNetworksPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vlans, setVlans] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:vlans-networks-vlans');
    return saved ? JSON.parse(saved) : VLAN_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:vlans-networks-vlans');
    return saved ? JSON.parse(saved) : { column: 'vlanId', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      try {
        const data = await configAPI.vlansNetworks.getVLANs();
        setVlans(data?.items || data || []);
      } catch (err) {
        setVlans([]);
        if (err.response?.status && err.response.status >= 500) {
          setError(err.message || 'Failed to load VLANs');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load VLANs');
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
      localStorage.setItem('table:sort:vlans-networks-vlans', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem('table:columns:vlans-networks-vlans', JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(VLAN_COLUMNS);
    localStorage.setItem('table:columns:vlans-networks-vlans', JSON.stringify(VLAN_COLUMNS));
  };

  const sortedData = [...vlans].sort((a, b) => {
    const aVal = a[sortConfig.column] || '';
    const bVal = b[sortConfig.column] || '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const visibleColumnDefs = ALL_VLAN_COLUMNS.filter((col) => visibleColumns.includes(col.id));

  const handleExport = async (format) => {
    try {
      if (format === 'csv') {
        exportToCSV(vlans, `vlans-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        exportToJSON(vlans, `vlans-${new Date().toISOString().split('T')[0]}.json`);
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
            VLANs & Networks
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage VLANs, VRRP, MVRP, STP, and network configurations
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
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : sortedData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No VLANs configured</Typography>
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
                    <TableRow key={item.vlanId || item.id || index} hover>
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
        {ALL_VLAN_COLUMNS.map((column) => (
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
        <DialogTitle>VLAN Details</DialogTitle>
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

export default VLANsNetworksPage;
