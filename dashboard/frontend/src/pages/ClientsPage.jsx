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
} from '@mui/material';
import {
  Wifi as WifiIcon,
  Cable as CableIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  CheckCircle as CheckCircleIcon,
  List as ListIcon,
  BarChart as BarChartIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { getClients, getClientTrends, getTopClients } from '../services/api';

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('connected');
  const [selectedTypes, setSelectedTypes] = useState(['wireless', 'wired']);
  const [viewMode, setViewMode] = useState('list');

  const siteId = '54819475093'; // Your site ID

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [clientsData, topData, trendsData] = await Promise.all([
        getClients(siteId),
        getTopClients(siteId),
        getClientTrends(siteId),
      ]);

      setClients(clientsData?.items || []);
      setTopClients(topData?.items || []);
      setTrends(trendsData);
    } catch (err) {
      console.error('Error loading client data:', err);
      setError(err.message || 'Failed to load client data');
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

  // Calculate counts for status filters
  const statusCounts = {
    connected: clients.filter((c) => c.status?.toLowerCase() === 'connected').length,
    failed: clients.filter((c) => c.status?.toLowerCase() === 'failed').length,
    connecting: clients.filter((c) => c.status?.toLowerCase() === 'connecting').length,
    disconnected: clients.filter((c) => c.status?.toLowerCase() === 'disconnected').length,
  };

  // Calculate counts for type filters
  const typeCounts = {
    wireless: clients.filter((c) => c.type?.toLowerCase() === 'wireless').length,
    wired: clients.filter((c) => c.type?.toLowerCase() === 'wired').length,
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
      client.connectedTo?.toLowerCase().includes(search);

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

  const handleStatusClick = (status) => {
    setSelectedStatus(status === selectedStatus ? null : status);
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box m={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

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
              color={selectedStatus === 'connected' ? 'success' : 'inherit'}
              size="small"
              onClick={() => handleStatusClick('connected')}
              startIcon={selectedStatus === 'connected' && <CheckCircleIcon />}
            >
              Connected ({statusCounts.connected})
            </Button>
            <Button
              variant={selectedStatus === 'failed' ? 'contained' : 'outlined'}
              color={selectedStatus === 'failed' ? 'error' : 'inherit'}
              size="small"
              onClick={() => handleStatusClick('failed')}
            >
              Failed ({statusCounts.failed})
            </Button>
            <Button
              variant={selectedStatus === 'connecting' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleStatusClick('connecting')}
              sx={{
                ...(selectedStatus === 'connecting' && {
                  backgroundColor: 'rgb(249, 192, 0)',
                  color: 'rgba(0, 0, 0, 0.87)',
                  '&:hover': {
                    backgroundColor: 'rgb(230, 178, 0)',
                  },
                }),
                ...(selectedStatus !== 'connecting' && {
                  borderColor: 'rgb(249, 192, 0)',
                  color: 'rgb(249, 192, 0)',
                  '&:hover': {
                    borderColor: 'rgb(230, 178, 0)',
                    backgroundColor: 'rgba(249, 192, 0, 0.04)',
                  },
                }),
              }}
            >
              Connecting ({statusCounts.connecting})
            </Button>
            <Button
              variant={selectedStatus === 'disconnected' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleStatusClick('disconnected')}
              sx={{
                ...(selectedStatus === 'disconnected' && {
                  backgroundColor: 'rgb(249, 192, 0)',
                  color: 'rgba(0, 0, 0, 0.87)',
                  '&:hover': {
                    backgroundColor: 'rgb(230, 178, 0)',
                  },
                }),
                ...(selectedStatus !== 'disconnected' && {
                  borderColor: 'rgb(249, 192, 0)',
                  color: 'rgb(249, 192, 0)',
                  '&:hover': {
                    borderColor: 'rgb(230, 178, 0)',
                    backgroundColor: 'rgba(249, 192, 0, 0.04)',
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
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
          <IconButton
            size="small"
            color={viewMode === 'list' ? 'primary' : 'default'}
            onClick={() => setViewMode('list')}
          >
            <ViewListIcon />
          </IconButton>
          <IconButton
            size="small"
            color={viewMode === 'grid' ? 'primary' : 'default'}
            onClick={() => setViewMode('grid')}
          >
            <ViewModuleIcon />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="List View">
            <IconButton size="small">
              <ListIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Graph View">
            <IconButton size="small">
              <BarChartIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton size="small">
              <SettingsIcon />
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
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>MAC Address</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>VLAN</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClients.map((client, index) => {
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default ClientsPage;
