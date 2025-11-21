/**
 * Site Configuration Page
 * Manage sites, site collections, device groups, and scope hierarchy
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
  Chip,
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
  FormControlLabel,
  FormGroup,
  Grid,
  Select,
  FormControl,
  InputLabel,
  Divider,
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
import AddressAutocomplete from '../../components/AddressAutocomplete';

// Default columns for sites table
const DEFAULT_COLUMNS = ['scopeName', 'scopeId', 'address', 'deviceCount', 'status'];
const ALL_COLUMNS = [
  { id: 'scopeName', label: 'Site Name', default: true },
  { id: 'scopeId', label: 'Site ID', default: true },
  { id: 'address', label: 'Address', default: true },
  { id: 'deviceCount', label: 'Devices', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'city', label: 'City', default: false },
  { id: 'state', label: 'State', default: false },
  { id: 'country', label: 'Country', default: false },
  { id: 'zipcode', label: 'ZIP Code', default: false },
  { id: 'collectionId', label: 'Collection ID', default: false },
  { id: 'latitude', label: 'Latitude', default: false },
  { id: 'longitude', label: 'Longitude', default: false },
];

function ScopeManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [sites, setSites] = useState([]);
  const [siteCollections, setSiteCollections] = useState([]);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  
  // Table customization
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('table:columns:scope-management-sites');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const saved = localStorage.getItem('table:sort:scope-management-sites');
    return saved ? JSON.parse(saved) : { column: 'scopeName', direction: 'asc' };
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [newSite, setNewSite] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipcode: '',
    latitude: '',
    longitude: '',
    timezone: {
      rawOffset: null,
      timezoneId: '',
      timezoneName: '',
    },
    image: null,
  });

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (tabValue === 0) {
        const data = await configAPI.scopeManagement.getSites();
        setSites(data.items || data || []);
      } else if (tabValue === 1) {
        const data = await configAPI.scopeManagement.getSiteCollections();
        setSiteCollections(data.items || data || []);
      } else if (tabValue === 2) {
        const data = await configAPI.scopeManagement.getDeviceGroups();
        setDeviceGroups(data.items || data || []);
      } else if (tabValue === 3) {
        const data = await configAPI.scopeManagement.getScopeHierarchy();
        setHierarchy(data);
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
        direction:
          prev.column === columnId && prev.direction === 'asc' ? 'desc' : 'asc',
      };
      localStorage.setItem('table:sort:scope-management-sites', JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      const newColumns = prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem('table:columns:scope-management-sites', JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(DEFAULT_COLUMNS);
    localStorage.setItem('table:columns:scope-management-sites', JSON.stringify(DEFAULT_COLUMNS));
  };

  const handleCreateSite = async () => {
    try {
      setError('');
      setSuccess('');
      const siteData = {
        name: newSite.name,
        address: newSite.address,
        city: newSite.city,
        state: newSite.state,
        country: newSite.country,
        zipcode: newSite.zipcode,
      };
      if (newSite.latitude && newSite.longitude) {
        siteData.latitude = parseFloat(newSite.latitude);
        siteData.longitude = parseFloat(newSite.longitude);
      }
      if (newSite.timezone.timezoneId) {
        siteData.timezone = newSite.timezone;
      }
      if (newSite.image) {
        siteData.image = newSite.image;
      }
      await configAPI.scopeManagement.createSite(siteData);
      setSuccess('Site created successfully!');
      setOpenDialog(false);
      setNewSite({
        name: '',
        address: '',
        city: '',
        state: '',
        country: '',
        zipcode: '',
        latitude: '',
        longitude: '',
        timezone: { rawOffset: null, timezoneId: '', timezoneName: '' },
        image: null,
      });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create site');
    }
  };

  const handleEditSite = (site) => {
    setEditingSite(site);
    setNewSite({
      name: site.scopeName || site.name || '',
      address: site.address || '',
      city: site.city || '',
      state: site.state || '',
      country: site.country || '',
      zipcode: site.zipcode || '',
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
      timezone: site.timezone || { rawOffset: null, timezoneId: '', timezoneName: '' },
      image: site.image || null,
    });
    setOpenEditDialog(true);
  };

  const handleUpdateSite = async () => {
    try {
      setError('');
      setSuccess('');
      if (!editingSite || !editingSite.scopeId) {
        setError('Site ID is required for update');
        return;
      }
      const siteData = {
        scopeId: editingSite.scopeId,
        name: newSite.name,
        address: newSite.address,
        city: newSite.city,
        state: newSite.state,
        country: newSite.country,
        zipcode: newSite.zipcode,
      };
      if (newSite.latitude && newSite.longitude) {
        siteData.latitude = parseFloat(newSite.latitude);
        siteData.longitude = parseFloat(newSite.longitude);
      }
      if (newSite.timezone.timezoneId) {
        siteData.timezone = newSite.timezone;
      }
      if (newSite.image) {
        siteData.image = newSite.image;
      }
      await configAPI.scopeManagement.updateSite(siteData);
      setSuccess('Site updated successfully!');
      setOpenEditDialog(false);
      setEditingSite(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update site');
    }
  };

  const handleDeleteSite = async (scopeId) => {
    if (!window.confirm('Are you sure you want to delete this site?')) return;

    try {
      setError('');
      setSuccess('');
      await configAPI.scopeManagement.deleteSite(scopeId);
      setSuccess('Site deleted successfully!');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete site');
    }
  };

  const sortedSites = [...sites].sort((a, b) => {
    const aVal = a[sortConfig.column] || '';
    const bVal = b[sortConfig.column] || '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const visibleColumnDefs = ALL_COLUMNS.filter((col) => visibleColumns.includes(col.id));

  const renderSitesTable = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (sortedSites.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No sites configured</Typography>
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
            {sortedSites.map((site, index) => (
              <TableRow key={site.scopeId || index} hover>
                {visibleColumnDefs.map((column) => (
                  <TableCell key={column.id}>
                    {site[column.id] || 'N/A'}
                  </TableCell>
                ))}
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedItem(site);
                          setDetailDialogOpen(true);
                        }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Site">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditSite(site)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Site">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSite(site.scopeId || site.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
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
            Site Configuration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage sites, site collections, device groups, and scope hierarchy
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
            <Button variant="outlined" startIcon={<ExportIcon />}>
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Column Settings">
            <IconButton
              onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
            >
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Create Site
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label={`Sites (${sites.length})`} />
            <Tab label={`Site Collections (${siteCollections.length})`} />
            <Tab label={`Device Groups (${deviceGroups.length})`} />
            <Tab label="Scope Hierarchy" />
          </Tabs>
        </Box>
        <CardContent>
          {tabValue === 0 && renderSitesTable()}
          {tabValue === 1 && (
            <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              Site Collections view - Coming soon
            </Typography>
          )}
          {tabValue === 2 && (
            <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              Device Groups view - Coming soon
            </Typography>
          )}
          {tabValue === 3 && (
            <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              Scope Hierarchy view - Coming soon
            </Typography>
          )}
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
        {ALL_COLUMNS.map((column) => (
          <MenuItem key={column.id} onClick={() => handleColumnToggle(column.id)}>
            <Checkbox checked={visibleColumns.includes(column.id)} />
            <Typography>{column.label}</Typography>
          </MenuItem>
        ))}
      </Menu>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Site Details</DialogTitle>
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

      {/* Create Site Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Site</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Site Name"
              value={newSite.name}
              onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <AddressAutocomplete
              value={newSite.address}
              onChange={(val) => setNewSite({ ...newSite, address: val })}
              onResolved={(data) => {
                const tz = data.timezone
                  ? { ...newSite.timezone, timezoneId: data.timezone }
                  : newSite.timezone;
                setNewSite({
                  ...newSite,
                  latitude: data.lat != null ? String(data.lat) : newSite.latitude,
                  longitude: data.lon != null ? String(data.lon) : newSite.longitude,
                  timezone: tz,
                });
              }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={newSite.city}
                  onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>State</InputLabel>
                  <Select
                    label="State"
                    value={newSite.state}
                    onChange={(e) => setNewSite({ ...newSite, state: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'].map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={newSite.country}
                    onChange={(e) => setNewSite({ ...newSite, country: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['United States','Canada','United Kingdom','Australia','Germany','France','Netherlands','India','Japan','Singapore','Brazil','Mexico'].map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Zip Code"
                  value={newSite.zipcode}
                  onChange={(e) => setNewSite({ ...newSite, zipcode: e.target.value })}
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Geolocation (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  value={newSite.latitude}
                  onChange={(e) => setNewSite({ ...newSite, latitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  value={newSite.longitude}
                  onChange={(e) => setNewSite({ ...newSite, longitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Timezone (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Timezone ID (e.g., America/New_York)"
                  value={newSite.timezone.timezoneId}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneId: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Timezone Name"
                  value={newSite.timezone.timezoneName}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneName: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Raw Offset (seconds)"
                  type="number"
                  value={newSite.timezone.rawOffset || ''}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, rawOffset: e.target.value ? parseInt(e.target.value) : null }
                  })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSite}
            disabled={!newSite.name || newSite.name.trim() === ''}
          >
            Create Site
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={openEditDialog} onClose={() => {
        setOpenEditDialog(false);
        setEditingSite(null);
      }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Site</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Site Name"
              value={newSite.name}
              onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <AddressAutocomplete
              value={newSite.address}
              onChange={(val) => setNewSite({ ...newSite, address: val })}
              onResolved={(data) => {
                const tz = data.timezone
                  ? { ...newSite.timezone, timezoneId: data.timezone }
                  : newSite.timezone;
                setNewSite({
                  ...newSite,
                  latitude: data.lat != null ? String(data.lat) : newSite.latitude,
                  longitude: data.lon != null ? String(data.lon) : newSite.longitude,
                  timezone: tz,
                });
              }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={newSite.city}
                  onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>State</InputLabel>
                  <Select
                    label="State"
                    value={newSite.state}
                    onChange={(e) => setNewSite({ ...newSite, state: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'].map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={newSite.country}
                    onChange={(e) => setNewSite({ ...newSite, country: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {['United States','Canada','United Kingdom','Australia','Germany','France','Netherlands','India','Japan','Singapore','Brazil','Mexico'].map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Zip Code"
                  value={newSite.zipcode}
                  onChange={(e) => setNewSite({ ...newSite, zipcode: e.target.value })}
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Geolocation (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  value={newSite.latitude}
                  onChange={(e) => setNewSite({ ...newSite, latitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  value={newSite.longitude}
                  onChange={(e) => setNewSite({ ...newSite, longitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Timezone (Optional)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Timezone ID (e.g., America/New_York)"
                  value={newSite.timezone.timezoneId}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneId: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Timezone Name"
                  value={newSite.timezone.timezoneName}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, timezoneName: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Raw Offset (seconds)"
                  type="number"
                  value={newSite.timezone.rawOffset || ''}
                  onChange={(e) => setNewSite({
                    ...newSite,
                    timezone: { ...newSite.timezone, rawOffset: e.target.value ? parseInt(e.target.value) : null }
                  })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenEditDialog(false);
            setEditingSite(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateSite}
            disabled={!newSite.name || newSite.name.trim() === ''}
          >
            Update Site
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ScopeManagementPage;

