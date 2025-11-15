/**
 * Devices Page
 * Displays and manages network devices
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { deviceAPI } from '../services/api';
import DataTableFilter from '../components/DataTableFilter';
import {
  exportToCSV,
  exportToJSON,
  formatDevicesForExport,
  generateFilename,
} from '../utils/exportUtils';

function DevicesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [switches, setSwitches] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all device types in parallel
      const [devicesData, switchesData, apsData] = await Promise.allSettled([
        deviceAPI.getAll(),
        deviceAPI.getSwitches(),
        deviceAPI.getAccessPoints(),
      ]);

      // Process devices
      if (devicesData.status === 'fulfilled') {
        const deviceList = devicesData.value.devices || devicesData.value.items || [];
        setDevices(deviceList);
      }

      // Process switches
      if (switchesData.status === 'fulfilled') {
        const switchList = switchesData.value.switches || switchesData.value.items || [];
        setSwitches(switchList);
      }

      // Process APs
      if (apsData.status === 'fulfilled') {
        const apList = apsData.value.aps || apsData.value.items || [];
        setAccessPoints(apList);
      }
    } catch (err) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (!status) return 'default';
    const statusLower = status.toLowerCase();
    if (statusLower === 'up' || statusLower === 'online') return 'success';
    if (statusLower === 'down' || statusLower === 'offline') return 'error';
    return 'warning';
  };

  const getCurrentDeviceList = () => {
    if (tabValue === 1) return switches;
    if (tabValue === 2) return accessPoints;
    return devices;
  };

  const handleExportCSV = () => {
    const currentList = getCurrentDeviceList();
    const filtered = filterAndSortDevices(currentList);
    const formatted = formatDevicesForExport(
      filtered.map((d) => ({
        serial: d.serialNumber,
        name: d.deviceName,
        model: d.model,
        device_type: d.deviceType,
        status: d.status,
        ip_address: d.ipv4,
        macaddr: d.macAddress,
        firmware_version: d.firmwareVersion,
        site: d.site,
        group_name: d.group,
      }))
    );
    const filename = generateFilename('devices', 'csv');
    exportToCSV(formatted, filename);
  };

  const handleExportJSON = () => {
    const currentList = getCurrentDeviceList();
    const filtered = filterAndSortDevices(currentList);
    const filename = generateFilename('devices', 'json');
    exportToJSON(filtered, filename);
  };

  const handleFilterChange = (key, value) => {
    if (key === 'status') {
      setStatusFilter(value);
    } else if (key === null) {
      // Clear all filters
      setStatusFilter(null);
    }
  };

  const getActiveFilters = () => {
    const filters = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: statusFilter });
    }
    return filters;
  };

  const filterAndSortDevices = (deviceList) => {
    let filtered = deviceList;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (device) =>
          device.deviceName?.toLowerCase().includes(term) ||
          device.serialNumber?.toLowerCase().includes(term) ||
          device.model?.toLowerCase().includes(term) ||
          device.macAddress?.toLowerCase().includes(term) ||
          device.ipv4?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((device) => device.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.deviceName || '').localeCompare(b.deviceName || '');
        case 'serial':
          return (a.serialNumber || '').localeCompare(b.serialNumber || '');
        case 'model':
          return (a.model || '').localeCompare(b.model || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'ip':
          return (a.ipv4 || '').localeCompare(b.ipv4 || '');
        default:
          return 0;
      }
    });

    return sorted;
  };

  const renderDeviceTable = (deviceList, type = 'general') => {
    const filtered = filterAndSortDevices(deviceList);

    if (filtered.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {searchTerm ? 'No devices match your search' : 'No devices found'}
          </Typography>
        </Box>
      );
    }

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Serial Number</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>MAC Address</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>IP Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((device, index) => (
              <TableRow
                key={device.serialNumber || index}
                hover
                onClick={() => navigate(`/devices/${device.serialNumber}`)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {device.deviceName || 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {device.deviceType}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {device.serialNumber || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>{device.model || 'N/A'}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {device.macAddress || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={device.status || 'Unknown'}
                    size="small"
                    color={getStatusColor(device.status)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {device.ipv4 || 'N/A'}
                  </Typography>
                  {device.ipv6 && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      {device.ipv6}
                    </Typography>
                  )}
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Network Devices
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage all devices in your network
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <DataTableFilter
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        sortOptions={[
          { key: 'name', label: 'Sort by Name' },
          { key: 'serial', label: 'Sort by Serial Number' },
          { key: 'model', label: 'Sort by Model' },
          { key: 'status', label: 'Sort by Status' },
          { key: 'ip', label: 'Sort by IP Address' },
        ]}
        currentSort={sortBy}
        onSortChange={setSortBy}
        filterOptions={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'Up', label: 'Online/Up' },
              { value: 'Down', label: 'Offline/Down' },
            ],
          },
        ]}
        activeFilters={getActiveFilters()}
        onFilterChange={handleFilterChange}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        placeholder="Search devices by name, serial, model, or MAC address..."
      />

      {/* Device Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label={`All Devices (${devices.length})`} />
            <Tab label={`Switches (${switches.length})`} />
            <Tab label={`Access Points (${accessPoints.length})`} />
          </Tabs>
        </Box>

        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {tabValue === 0 && renderDeviceTable(devices, 'all')}
              {tabValue === 1 && renderDeviceTable(switches, 'switches')}
              {tabValue === 2 && renderDeviceTable(accessPoints, 'aps')}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default DevicesPage;
