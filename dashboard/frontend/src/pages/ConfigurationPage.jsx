/**
 * Configuration Page - Enhanced with Bulk Operations
 * Manage sites, groups, templates, and bulk configuration tasks
 * Enhanced Configuration Page
 * Comprehensive configuration management for Aruba Central
 * Categories: Sites, Groups, Templates, Scope Management, Application Experience, Central NAC, NAC Services
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Button,
  TextField,
  Paper,
  LinearProgress,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  UploadFile as UploadFileIcon,
  CloudUpload as CloudUploadIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  Label as LabelIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkCheckIcon,
} from '@mui/icons-material';
import { configAPI, bulkConfigAPI, scopeAPI, appExperienceAPI, nacAPI } from '../services/api';

function ConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Basic configuration data
  const [sites, setSites] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Bulk operations state
  const [bulkOperation, setBulkOperation] = useState(null); // 'ap-rename', 'group-assign', 'site-assign'
  const [csvData, setCsvData] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  // Scope management data
  const [labels, setLabels] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [siteHierarchy, setSiteHierarchy] = useState(null);

  // Application experience data
  const [applications, setApplications] = useState([]);
  const [appCategories, setAppCategories] = useState([]);
  const [qosPolicies, setQosPolicies] = useState([]);
  const [dpiSettings, setDpiSettings] = useState(null);

  // NAC data
  const [nacUserRoles, setNacUserRoles] = useState([]);
  const [nacDeviceProfiles, setNacDeviceProfiles] = useState([]);
  const [nacPolicies, setNacPolicies] = useState([]);
  const [nacCertificates, setNacCertificates] = useState([]);
  const [radiusProfiles, setRadiusProfiles] = useState([]);
  const [onboardingRules, setOnboardingRules] = useState([]);

  useEffect(() => {
    fetchConfigData();
  }, []);

  const fetchConfigData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all configuration data in parallel
      const [
        sitesData,
        groupsData,
        templatesData,
        labelsData,
        geofencesData,
        hierarchyData,
        applicationsData,
        appCategoriesData,
        qosData,
        dpiData,
        nacRolesData,
        nacProfilesData,
        nacPoliciesData,
        nacCertsData,
        radiusData,
        onboardingData,
      ] = await Promise.allSettled([
        configAPI.getSites(),
        configAPI.getGroups(),
        configAPI.getTemplates(),
        scopeAPI.getLabels(),
        scopeAPI.getGeofences(),
        scopeAPI.getSiteHierarchy(),
        appExperienceAPI.getApplications(),
        appExperienceAPI.getAppCategories(),
        appExperienceAPI.getQoSPolicies(),
        appExperienceAPI.getDPISettings(),
        nacAPI.getUserRoles(),
        nacAPI.getDeviceProfiles(),
        nacAPI.getPolicies(),
        nacAPI.getCertificates(),
        nacAPI.getRadiusProfiles(),
        nacAPI.getOnboardingRules(),
      ]);

      // Process basic config
      if (sitesData.status === 'fulfilled') {
        setSites(sitesData.value.sites || sitesData.value.items || []);
      }
      if (groupsData.status === 'fulfilled') {
        setGroups(groupsData.value.data || groupsData.value.items || []);
      }
      if (templatesData.status === 'fulfilled') {
        setTemplates(templatesData.value.templates || templatesData.value.items || []);
      }

      // Process scope management
      if (labelsData.status === 'fulfilled') {
        setLabels(labelsData.value.labels || labelsData.value.items || []);
      }
      if (geofencesData.status === 'fulfilled') {
        setGeofences(geofencesData.value.geofences || geofencesData.value.items || []);
      }
      if (hierarchyData.status === 'fulfilled') {
        setSiteHierarchy(hierarchyData.value);
      }

      // Process application experience
      if (applicationsData.status === 'fulfilled') {
        setApplications(applicationsData.value.applications || applicationsData.value.items || []);
      }
      if (appCategoriesData.status === 'fulfilled') {
        setAppCategories(appCategoriesData.value.categories || appCategoriesData.value.items || []);
      }
      if (qosData.status === 'fulfilled') {
        setQosPolicies(qosData.value.policies || qosData.value.items || []);
      }
      if (dpiData.status === 'fulfilled') {
        setDpiSettings(dpiData.value);
      }

      // Process NAC data
      if (nacRolesData.status === 'fulfilled') {
        setNacUserRoles(nacRolesData.value.roles || nacRolesData.value.items || []);
      }
      if (nacProfilesData.status === 'fulfilled') {
        setNacDeviceProfiles(nacProfilesData.value.profiles || nacProfilesData.value.items || []);
      }
      if (nacPoliciesData.status === 'fulfilled') {
        setNacPolicies(nacPoliciesData.value.policies || nacPoliciesData.value.items || []);
      }
      if (nacCertsData.status === 'fulfilled') {
        setNacCertificates(nacCertsData.value.certificates || nacCertsData.value.items || []);
      }
      if (radiusData.status === 'fulfilled') {
        setRadiusProfiles(radiusData.value.servers || radiusData.value.items || []);
      }
      if (onboardingData.status === 'fulfilled') {
        setOnboardingRules(onboardingData.value.rules || onboardingData.value.items || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        setError('CSV file must have at least a header and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        return row;
      });

      setCsvData(data);
      setError('');
    };

    reader.readAsText(file);
  };

  const handleBulkExecute = async () => {
    if (csvData.length === 0) {
      setError('Please upload a CSV file first');
      return;
    }

    setBulkProcessing(true);
    setError('');

    try {
      let response;

      if (bulkOperation === 'ap-rename') {
        const mappings = csvData.map(row => ({
          serial: row.serial,
          new_name: row.new_name,
        }));
        response = await bulkConfigAPI.bulkAPRename(mappings);
      } else if (bulkOperation === 'group-assign') {
        const mappings = csvData.map(row => ({
          serial: row.serial,
          group: row.group,
        }));
        response = await bulkConfigAPI.bulkGroupAssign(mappings);
      } else if (bulkOperation === 'site-assign') {
        const mappings = csvData.map(row => ({
          serial: row.serial,
          site_id: row.site_id,
        }));
        response = await bulkConfigAPI.bulkSiteAssign(mappings);
      }

      setBulkResults(response);
      setShowResultsDialog(true);
    } catch (err) {
      setError(err.message || 'Bulk operation failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const clearBulkOperation = () => {
    setCsvData([]);
    setCsvFile(null);
    setBulkResults(null);
    setBulkOperation(null);
  };

  const downloadTemplate = (operation) => {
    let csvContent = '';

    if (operation === 'ap-rename') {
      csvContent = 'serial,new_name\nCN12345678,Building-A-AP-01\nCN87654321,Building-A-AP-02';
    } else if (operation === 'group-assign') {
      csvContent = 'serial,group\nCN12345678,campus-wifi\nCN87654321,guest-wifi';
    } else if (operation === 'site-assign') {
      csvContent = 'serial,site_id\nCN12345678,54819475093\nCN87654321,54819475093';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${operation}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderBulkOperationsTab = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Bulk Configuration Operations
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Upload CSV files to perform bulk operations on multiple devices
        </Typography>

        {/* Operation Selection */}
        {!bulkOperation && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => setBulkOperation('ap-rename')}
            >
              Bulk AP Rename
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => setBulkOperation('group-assign')}
            >
              Bulk Group Assignment
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => setBulkOperation('site-assign')}
            >
              Bulk Site Assignment
            </Button>
          </Box>
        )}

        {/* CSV Upload Section */}
        {bulkOperation && (
          <Card sx={{ mb: 3, border: '2px dashed', borderColor: 'primary.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {bulkOperation === 'ap-rename' && 'Bulk AP Rename'}
                  {bulkOperation === 'group-assign' && 'Bulk Group Assignment'}
                  {bulkOperation === 'site-assign' && 'Bulk Site Assignment'}
                </Typography>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadTemplate(bulkOperation)}
                >
                  Download Template
                </Button>
              </Box>

              <Box sx={{ mb: 2 }}>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="csv-upload"
                  type="file"
                  onChange={handleFileUpload}
                />
                <label htmlFor="csv-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<UploadFileIcon />}
                    fullWidth
                  >
                    {csvFile ? `Loaded: ${csvFile.name}` : 'Upload CSV File'}
                  </Button>
                </label>
              </Box>

              {csvData.length > 0 && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Loaded {csvData.length} rows from CSV. Review below and click Execute.
                  </Alert>

                  <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {Object.keys(csvData[0]).map(header => (
                            <TableCell key={header}>
                              <strong>{header}</strong>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {csvData.map((row, idx) => (
                          <TableRow key={idx} hover>
                            {Object.values(row).map((value, vidx) => (
                              <TableCell key={vidx}>{value}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={bulkProcessing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                      onClick={handleBulkExecute}
                      disabled={bulkProcessing}
                      fullWidth
                    >
                      {bulkProcessing ? 'Processing...' : 'Execute Bulk Operation'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DeleteIcon />}
                      onClick={clearBulkOperation}
                      disabled={bulkProcessing}
                    >
                      Clear
                    </Button>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* CSV Format Help */}
        {bulkOperation && (
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              CSV Format for {bulkOperation}:
            </Typography>
            <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {bulkOperation === 'ap-rename' && 'serial,new_name\nCN12345678,Building-A-AP-01'}
              {bulkOperation === 'group-assign' && 'serial,group\nCN12345678,campus-wifi'}
              {bulkOperation === 'site-assign' && 'serial,site_id\nCN12345678,54819475093'}
            </Typography>
          </Alert>
        )}
      </Box>
    );
  };
  const handleItemClick = (item, type) => {
    setSelectedItem({ ...item, type });
    setDetailDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDetailDialogOpen(false);
    setSelectedItem(null);
  };

  // ========== Render Functions ==========

  const renderSitesTable = () => {
    if (sites.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No sites configured</Typography>
        </Box>
      );
    }

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Site Name</TableCell>
              <TableCell>Site ID</TableCell>
              <TableCell>Address</TableCell>
              {showAdvanced && (
                <>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>ZIP Code</TableCell>
                </>
              )}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sites.map((site, index) => (
              <TableRow key={site.site_id || index} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {site.site_name || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>{site.site_id || 'N/A'}</TableCell>
                <TableCell>{site.address || 'N/A'}</TableCell>
                {showAdvanced && (
                  <>
                    <TableCell>{site.city || 'N/A'}</TableCell>
                    <TableCell>{site.state || 'N/A'}</TableCell>
                    <TableCell>{site.country || 'N/A'}</TableCell>
                    <TableCell>{site.zipcode || 'N/A'}</TableCell>
                  </>
                )}
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleItemClick(site, 'site')}>
                      <VisibilityIcon fontSize="small" />
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

  const renderGroupsTable = () => {
    if (groups.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No configuration groups found</Typography>
        </Box>
      );
    }

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Group Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Template Group</TableCell>
              <TableCell>Devices</TableCell>
              {showAdvanced && (
                <>
                  <TableCell>Allowed Device Types</TableCell>
                  <TableCell>Architecture</TableCell>
                </>
              )}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group, index) => (
              <TableRow key={group.group || index} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {group.group || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={group.group_type || 'N/A'} size="small" />
                </TableCell>
                <TableCell>{group.template_info?.template_group || 'N/A'}</TableCell>
                <TableCell>{group.device_count || 0}</TableCell>
                {showAdvanced && (
                  <>
                    <TableCell>
                      {group.allowed_device_types?.join(', ') || 'All'}
                    </TableCell>
                    <TableCell>{group.architecture || 'N/A'}</TableCell>
                  </>
                )}
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleItemClick(group, 'group')}>
                      <VisibilityIcon fontSize="small" />
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

  const renderTemplatesTable = () => {
    if (templates.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No templates configured</Typography>
        </Box>
      );
    }

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Template Name</TableCell>
              <TableCell>Device Type</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Model</TableCell>
              {showAdvanced && (
                <>
                  <TableCell>Group</TableCell>
                  <TableCell>Last Modified</TableCell>
                </>
              )}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template, index) => (
              <TableRow key={template.name || index} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {template.name || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={template.device_type || 'N/A'} size="small" />
                </TableCell>
                <TableCell>{template.version || 'N/A'}</TableCell>
                <TableCell>{template.model || 'All'}</TableCell>
                {showAdvanced && (
                  <>
                    <TableCell>{template.group || 'N/A'}</TableCell>
                    <TableCell>
                      {template.template_modified_date
                        ? new Date(template.template_modified_date * 1000).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                  </>
                )}
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleItemClick(template, 'template')}>
                      <VisibilityIcon fontSize="small" />
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

  const renderScopeManagement = () => {
    return (
      <Box>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LabelIcon color="primary" />
              <Typography variant="h6">Labels ({labels.length})</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {labels.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No labels configured
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {labels.map((label, index) => (
                  <Grid item xs={12} sm={6} md={4} key={label.label_id || index}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleItemClick(label, 'label')}
                    >
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {label.label_name || 'Unnamed Label'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ID: {label.label_id || 'N/A'}
                        </Typography>
                        {showAdvanced && (
                          <>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                              Category: {label.category || 'N/A'}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Associations: {label.association_count || 0}
                            </Typography>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" />
              <Typography variant="h6">Site Hierarchy</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {!siteHierarchy ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No hierarchy data available
              </Typography>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Total Sites: {siteHierarchy.total || 0}
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Site</TableCell>
                        <TableCell>Location</TableCell>
                        {showAdvanced && (
                          <>
                            <TableCell>Latitude</TableCell>
                            <TableCell>Longitude</TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {siteHierarchy.sites?.slice(0, 10).map((site, index) => (
                        <TableRow key={site.site_id || index} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {site.site_name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {site.city}, {site.country}
                          </TableCell>
                          {showAdvanced && (
                            <>
                              <TableCell>{site.latitude || 'N/A'}</TableCell>
                              <TableCell>{site.longitude || 'N/A'}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {showAdvanced && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NetworkCheckIcon color="primary" />
                <Typography variant="h6">Geofences ({geofences.length})</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {geofences.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No geofences configured
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {geofences.map((geofence, index) => (
                    <Grid item xs={12} sm={6} key={geofence.id || index}>
                      <Card>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {geofence.name || 'Unnamed Geofence'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Type: {geofence.type || 'N/A'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    );
  };

  const renderApplicationExperience = () => {
    return (
      <Box>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon color="primary" />
              <Typography variant="h6">Applications ({applications.length})</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {applications.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No application data available
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Application Name</TableCell>
                      <TableCell>Category</TableCell>
                      {showAdvanced && (
                        <>
                          <TableCell>Traffic</TableCell>
                          <TableCell>Users</TableCell>
                          <TableCell>Risk Level</TableCell>
                        </>
                      )}
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {applications.slice(0, 10).map((app, index) => (
                      <TableRow key={app.app_name || index} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {app.app_name || 'Unknown'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={app.category || 'Uncategorized'} size="small" />
                        </TableCell>
                        {showAdvanced && (
                          <>
                            <TableCell>{app.traffic || 'N/A'}</TableCell>
                            <TableCell>{app.user_count || 0}</TableCell>
                            <TableCell>
                              <Chip
                                label={app.risk_level || 'Low'}
                                size="small"
                                color={app.risk_level === 'High' ? 'error' : 'default'}
                              />
                            </TableCell>
                          </>
                        )}
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleItemClick(app, 'application')}
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
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon color="primary" />
              <Typography variant="h6">
                Application Categories ({appCategories.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {appCategories.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No categories available
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {appCategories.map((category, index) => (
                  <Grid item xs={12} sm={6} md={3} key={category.id || index}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {category.name || 'Unnamed'}
                        </Typography>
                        {showAdvanced && (
                          <Typography variant="caption" color="text.secondary">
                            Apps: {category.app_count || 0}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>

        {showAdvanced && (
          <>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NetworkCheckIcon color="primary" />
                  <Typography variant="h6">QoS Policies ({qosPolicies.length})</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {qosPolicies.length === 0 ? (
                  <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No QoS policies configured
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Policy Name</TableCell>
                          <TableCell>Priority</TableCell>
                          <TableCell>Bandwidth</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {qosPolicies.map((policy, index) => (
                          <TableRow key={policy.name || index} hover>
                            <TableCell>{policy.name || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip label={policy.priority || 'Normal'} size="small" />
                            </TableCell>
                            <TableCell>{policy.bandwidth || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6">DPI Settings</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {!dpiSettings ? (
                  <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No DPI settings available
                  </Typography>
                ) : (
                  <Box>
                    <Typography variant="body2">
                      Status: <Chip label={dpiSettings.enabled ? 'Enabled' : 'Disabled'} size="small" />
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Engine: {dpiSettings.engine || 'N/A'}
                    </Typography>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </>
        )}
      </Box>
    );
  };

  const renderCentralNAC = () => {
    return (
      <Box>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              <Typography variant="h6">User Roles ({nacUserRoles.length})</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {nacUserRoles.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No NAC user roles configured
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {nacUserRoles.map((role, index) => (
                  <Grid item xs={12} sm={6} md={4} key={role.role_id || index}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleItemClick(role, 'nac_role')}
                    >
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {role.role_name || 'Unnamed Role'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Type: {role.type || 'N/A'}
                        </Typography>
                        {showAdvanced && (
                          <>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                              Access Level: {role.access_level || 'Standard'}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Users: {role.user_count || 0}
                            </Typography>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" />
              <Typography variant="h6">
                Device Profiles ({nacDeviceProfiles.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {nacDeviceProfiles.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No device profiles configured
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Profile Name</TableCell>
                      <TableCell>Device Type</TableCell>
                      {showAdvanced && (
                        <>
                          <TableCell>OS Type</TableCell>
                          <TableCell>Devices</TableCell>
                        </>
                      )}
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nacDeviceProfiles.map((profile, index) => (
                      <TableRow key={profile.profile_id || index} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {profile.profile_name || 'Unnamed Profile'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={profile.device_type || 'N/A'} size="small" />
                        </TableCell>
                        {showAdvanced && (
                          <>
                            <TableCell>{profile.os_type || 'N/A'}</TableCell>
                            <TableCell>{profile.device_count || 0}</TableCell>
                          </>
                        )}
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleItemClick(profile, 'nac_profile')}
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
          </AccordionDetails>
        </Accordion>

        {showAdvanced && (
          <>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon color="primary" />
                  <Typography variant="h6">Authentication Policies ({nacPolicies.length})</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {nacPolicies.length === 0 ? (
                  <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No authentication policies configured
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Policy Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {nacPolicies.map((policy, index) => (
                          <TableRow key={policy.policy_id || index} hover>
                            <TableCell>{policy.policy_name || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip label={policy.auth_type || 'N/A'} size="small" />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={policy.enabled ? 'Active' : 'Inactive'}
                                size="small"
                                color={policy.enabled ? 'success' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6">Certificates ({nacCertificates.length})</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {nacCertificates.length === 0 ? (
                  <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No certificates configured
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Certificate Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Expiration</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {nacCertificates.map((cert, index) => (
                          <TableRow key={cert.cert_id || index} hover>
                            <TableCell>{cert.cert_name || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip label={cert.cert_type || 'N/A'} size="small" />
                            </TableCell>
                            <TableCell>
                              {cert.expiration_date
                                ? new Date(cert.expiration_date * 1000).toLocaleDateString()
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={cert.valid ? 'Valid' : 'Invalid'}
                                size="small"
                                color={cert.valid ? 'success' : 'error'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </AccordionDetails>
            </Accordion>
          </>
        )}
      </Box>
    );
  };

  const renderNACServices = () => {
    return (
      <Box>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NetworkCheckIcon color="primary" />
              <Typography variant="h6">RADIUS Profiles ({radiusProfiles.length})</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {radiusProfiles.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No RADIUS profiles configured
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Server Name</TableCell>
                      <TableCell>Host</TableCell>
                      {showAdvanced && (
                        <>
                          <TableCell>Port</TableCell>
                          <TableCell>Protocol</TableCell>
                          <TableCell>Status</TableCell>
                        </>
                      )}
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {radiusProfiles.map((server, index) => (
                      <TableRow key={server.server_id || index} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {server.server_name || 'Unnamed Server'}
                          </Typography>
                        </TableCell>
                        <TableCell>{server.host || 'N/A'}</TableCell>
                        {showAdvanced && (
                          <>
                            <TableCell>{server.port || '1812'}</TableCell>
                            <TableCell>{server.protocol || 'RADIUS'}</TableCell>
                            <TableCell>
                              <Chip
                                label={server.status || 'Unknown'}
                                size="small"
                                color={server.status === 'Active' ? 'success' : 'default'}
                              />
                            </TableCell>
                          </>
                        )}
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleItemClick(server, 'radius')}
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
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon color="primary" />
              <Typography variant="h6">
                Device Onboarding Rules ({onboardingRules.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {onboardingRules.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No onboarding rules configured
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {onboardingRules.map((rule, index) => (
                  <Grid item xs={12} sm={6} key={rule.rule_id || index}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleItemClick(rule, 'onboarding_rule')}
                    >
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {rule.rule_name || 'Unnamed Rule'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Type: {rule.device_type || 'N/A'}
                        </Typography>
                        {showAdvanced && (
                          <>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                              Action: {rule.action || 'N/A'}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Priority: {rule.priority || 0}
                            </Typography>
                          </>
                        )}
                        <Chip
                          label={rule.enabled ? 'Enabled' : 'Disabled'}
                          size="small"
                          color={rule.enabled ? 'success' : 'default'}
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };

  const renderDetailDialog = () => {
    if (!selectedItem) return null;

    return (
      <Dialog open={detailDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem.type.replace('_', ' ').toUpperCase()} Details
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {Object.entries(selectedItem)
              .filter(([key]) => key !== 'type')
              .map(([key, value]) => (
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Configuration Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive network configuration and policy management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
                color="primary"
              />
            }
            label="Advanced Options"
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchConfigData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Configuration Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={`Sites (${sites.length})`} />
            <Tab label={`Groups (${groups.length})`} />
            <Tab label={`Templates (${templates.length})`} />
            <Tab label={`Scope Management`} />
            <Tab label={`Application Experience`} />
            <Tab label={`Central NAC`} />
            <Tab label={`NAC Services`} />
          </Tabs>
        </Box>

        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {tabValue === 0 && renderSitesTable()}
              {tabValue === 1 && renderGroupsTable()}
              {tabValue === 2 && renderTemplatesTable()}
              {tabValue === 3 && renderScopeManagement()}
              {tabValue === 4 && renderApplicationExperience()}
              {tabValue === 5 && renderCentralNAC()}
              {tabValue === 6 && renderNACServices()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog
        open={showResultsDialog}
        onClose={() => setShowResultsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Bulk Operation Results
        </DialogTitle>
        <DialogContent>
          {bulkResults && (
            <Box>
              <Alert severity={bulkResults.failed === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Total:</strong> {bulkResults.total} |
                  <strong> Successful:</strong> {bulkResults.successful} |
                  <strong> Failed:</strong> {bulkResults.failed}
                </Typography>
              </Alert>

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Serial</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bulkResults.results.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{result.serial}</TableCell>
                        <TableCell>
                          {result.status === 'success' ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Success"
                              color="success"
                              size="small"
                            />
                          ) : (
                            <Chip
                              icon={<ErrorIcon />}
                              label="Failed"
                              color="error"
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {result.status === 'success'
                            ? (result.new_name || result.group || result.site_id)
                            : result.error
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResultsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Detail Dialog */}
      {renderDetailDialog()}
    </Box>
  );
}

export default ConfigurationPage;
