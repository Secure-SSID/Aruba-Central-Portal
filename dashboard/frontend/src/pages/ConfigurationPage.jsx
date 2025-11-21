/**
 * Configuration Page - Enhanced with Bulk Operations
 * Manage sites, groups, templates, and bulk configuration tasks
 * Enhanced Configuration Page
 * Comprehensive configuration management for Aruba Central
 * Categories: Sites, Groups, Templates, Scope Management, Application Experience, Central NAC, NAC Services
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { getErrorMessage } from '../utils/errorUtils';
import DeviceSelector from '../components/DeviceSelector';

function ConfigurationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Get tab from URL parameter, default to 0
  const tabFromUrl = parseInt(searchParams.get('tab') || '0', 10);
  const [tabValue, setTabValue] = useState(tabFromUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Update tab when URL parameter changes
  useEffect(() => {
    const tab = parseInt(searchParams.get('tab') || '0', 10);
    if (tab >= 0 && tab <= 8) {
      setTabValue(tab);
    }
  }, [searchParams]);

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

  // Switch Configuration state
  const [selectedSwitchSerial, setSelectedSwitchSerial] = useState('');
  const [switchProfiles, setSwitchProfiles] = useState(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchProfileCategories, setSwitchProfileCategories] = useState({
    miscellaneous: null,
    namedObjects: null,
    networkServices: null,
    rolesPolicies: null,
    routingOverlay: null,
    security: null,
    services: null,
    system: null,
    telemetry: null,
    tunnels: null,
    vlansNetworks: null,
  });

  // Wireless Configuration state
  const [selectedWirelessSerial, setSelectedWirelessSerial] = useState('');
  const [wirelessProfiles, setWirelessProfiles] = useState(null);
  const [wirelessLoading, setWirelessLoading] = useState(false);
  const [wirelessProfileCategories, setWirelessProfileCategories] = useState({
    radios: null,
    wlans: null,
    system: null,
  });

  useEffect(() => {
    fetchConfigData();
  }, []);

  // Set default tab parameter if missing (only on mount)
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: '0' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConfigData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all configuration data in parallel
      // Use New Central Configuration API (network-config/v1alpha1) for sites
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
        configAPI.scopeManagement.getSites({ limit: 100, offset: 0 }), // Use New Central API
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

      // Process basic config - New Central API returns items array directly or in response
      if (sitesData.status === 'fulfilled') {
        const sitesValue = sitesData.value;
        // New Central API /network-config/v1alpha1/sites returns items array
        if (Array.isArray(sitesValue)) {
          setSites(sitesValue);
        } else if (sitesValue?.items) {
          setSites(sitesValue.items);
        } else if (sitesValue?.sites) {
          setSites(sitesValue.sites);
        } else if (sitesValue?.data) {
          setSites(sitesValue.data);
        } else {
          setSites([]);
        }
      } else {
        console.warn('Failed to fetch sites:', sitesData.reason);
        setSites([]);
      }
      
      if (groupsData.status === 'fulfilled') {
        const groupsValue = groupsData.value;
        if (Array.isArray(groupsValue)) {
          setGroups(groupsValue);
        } else {
          setGroups(groupsValue?.data || groupsValue?.items || groupsValue?.groups || []);
        }
      }
      
      if (templatesData.status === 'fulfilled') {
        const templatesValue = templatesData.value;
        if (Array.isArray(templatesValue)) {
          setTemplates(templatesValue);
        } else {
          setTemplates(templatesValue?.templates || templatesValue?.items || templatesValue?.data || []);
        }
      }

      // Process scope management
      if (labelsData.status === 'fulfilled') {
        const labelsValue = labelsData.value;
        if (Array.isArray(labelsValue)) {
          setLabels(labelsValue);
        } else {
          setLabels(labelsValue?.labels || labelsValue?.items || labelsValue?.data || []);
        }
      }
      
      if (geofencesData.status === 'fulfilled') {
        const geofencesValue = geofencesData.value;
        if (Array.isArray(geofencesValue)) {
          setGeofences(geofencesValue);
        } else {
          setGeofences(geofencesValue?.geofences || geofencesValue?.items || geofencesValue?.data || []);
        }
      }
      
      if (hierarchyData.status === 'fulfilled') {
        setSiteHierarchy(hierarchyData.value);
      }

      // Process application experience
      if (applicationsData.status === 'fulfilled') {
        const appsValue = applicationsData.value;
        if (Array.isArray(appsValue)) {
          setApplications(appsValue);
        } else {
          setApplications(appsValue?.applications || appsValue?.items || appsValue?.data || []);
        }
      }
      
      if (appCategoriesData.status === 'fulfilled') {
        const catsValue = appCategoriesData.value;
        if (Array.isArray(catsValue)) {
          setAppCategories(catsValue);
        } else {
          setAppCategories(catsValue?.categories || catsValue?.items || catsValue?.data || []);
        }
      }
      
      if (qosData.status === 'fulfilled') {
        const qosValue = qosData.value;
        if (Array.isArray(qosValue)) {
          setQosPolicies(qosValue);
        } else {
          setQosPolicies(qosValue?.policies || qosValue?.items || qosValue?.data || []);
        }
      }
      
      if (dpiData.status === 'fulfilled') {
        setDpiSettings(dpiData.value);
      }

      // Process NAC data
      if (nacRolesData.status === 'fulfilled') {
        const rolesValue = nacRolesData.value;
        if (Array.isArray(rolesValue)) {
          setNacUserRoles(rolesValue);
        } else {
          setNacUserRoles(rolesValue?.roles || rolesValue?.items || rolesValue?.data || []);
        }
      }
      
      if (nacProfilesData.status === 'fulfilled') {
        const profilesValue = nacProfilesData.value;
        if (Array.isArray(profilesValue)) {
          setNacDeviceProfiles(profilesValue);
        } else {
          setNacDeviceProfiles(profilesValue?.profiles || profilesValue?.items || profilesValue?.data || []);
        }
      }
      
      if (nacPoliciesData.status === 'fulfilled') {
        const policiesValue = nacPoliciesData.value;
        if (Array.isArray(policiesValue)) {
          setNacPolicies(policiesValue);
        } else {
          setNacPolicies(policiesValue?.policies || policiesValue?.items || policiesValue?.data || []);
        }
      }
      
      if (nacCertsData.status === 'fulfilled') {
        const certsValue = nacCertsData.value;
        if (Array.isArray(certsValue)) {
          setNacCertificates(certsValue);
        } else {
          setNacCertificates(certsValue?.certificates || certsValue?.items || certsValue?.data || []);
        }
      }
      
      if (radiusData.status === 'fulfilled') {
        const radiusValue = radiusData.value;
        if (Array.isArray(radiusValue)) {
          setRadiusProfiles(radiusValue);
        } else {
          setRadiusProfiles(radiusValue?.servers || radiusValue?.items || radiusValue?.data || []);
        }
      }
      
      if (onboardingData.status === 'fulfilled') {
        const onboardingValue = onboardingData.value;
        if (Array.isArray(onboardingValue)) {
          setOnboardingRules(onboardingValue);
        } else {
          setOnboardingRules(onboardingValue?.rules || onboardingValue?.items || onboardingValue?.data || []);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load configuration data'));
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
      setError(getErrorMessage(err, 'Bulk operation failed'));
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
      csvContent = 'serial,new_name\nSERIAL_NUMBER_1,DEVICE_NAME_1\nSERIAL_NUMBER_2,DEVICE_NAME_2';
    } else if (operation === 'group-assign') {
      csvContent = 'serial,group\nSERIAL_NUMBER_1,GROUP_NAME_1\nSERIAL_NUMBER_2,GROUP_NAME_2';
    } else if (operation === 'site-assign') {
      csvContent = 'serial,site_id\nSERIAL_NUMBER_1,SITE_ID_HERE\nSERIAL_NUMBER_2,SITE_ID_HERE';
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
              {bulkOperation === 'ap-rename' && 'serial,new_name\nSERIAL_NUMBER_1,DEVICE_NAME_1'}
              {bulkOperation === 'group-assign' && 'serial,group\nSERIAL_NUMBER_1,GROUP_NAME_1'}
              {bulkOperation === 'site-assign' && 'serial,site_id\nSERIAL_NUMBER_1,SITE_ID_HERE'}
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
              <TableCell>Scope ID</TableCell>
              <TableCell>Address</TableCell>
              {showAdvanced && (
                <>
                  <TableCell>City</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>ZIP Code</TableCell>
                  <TableCell>Device Count</TableCell>
                </>
              )}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sites.map((site, index) => (
              <TableRow key={site.scopeId || site.site_id || site.id || index} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {site.scopeName || site.site_name || site.name || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>{site.scopeId || site.site_id || site.id || 'N/A'}</TableCell>
                <TableCell>
                  {site.address?.address || site.address || site.addressParams?.address || 'N/A'}
                </TableCell>
                {showAdvanced && (
                  <>
                    <TableCell>
                      {site.address?.city || site.city || site.addressParams?.city || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {site.address?.state || site.state || site.addressParams?.state || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {site.address?.country || site.country || site.addressParams?.country || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {site.address?.zipcode || site.zipcode || site.addressParams?.zipcode || 'N/A'}
                    </TableCell>
                    <TableCell>{site.deviceCount || 0}</TableCell>
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

  // Fetch switch profile data when device is selected
  const fetchSwitchProfile = async (serial) => {
    if (!serial) {
      setSwitchProfiles(null);
      setSwitchProfileCategories({
        miscellaneous: null,
        namedObjects: null,
        networkServices: null,
        rolesPolicies: null,
        routingOverlay: null,
        security: null,
        services: null,
        system: null,
        telemetry: null,
        tunnels: null,
        vlansNetworks: null,
      });
      return;
    }

    setSwitchLoading(true);
    setError('');

    try {
      // Fetch all switch profile categories in parallel
      const [
        profileData,
        miscData,
        namedObjectsData,
        networkServicesData,
        rolesPoliciesData,
        routingOverlayData,
        securityData,
        servicesData,
        systemData,
        telemetryData,
        tunnelsData,
        vlansNetworksData,
      ] = await Promise.allSettled([
        configAPI.switchProfiles.getProfile(serial),
        configAPI.switchProfiles.getMiscellaneous(serial),
        configAPI.switchProfiles.getNamedObjects(serial),
        configAPI.switchProfiles.getNetworkServices(serial),
        configAPI.switchProfiles.getRolesPolicies(serial),
        configAPI.switchProfiles.getRoutingOverlay(serial),
        configAPI.switchProfiles.getSecurity(serial),
        configAPI.switchProfiles.getServices(serial),
        configAPI.switchProfiles.getSystem(serial),
        configAPI.switchProfiles.getTelemetry(serial),
        configAPI.switchProfiles.getTunnels(serial),
        configAPI.switchProfiles.getVLANsNetworks(serial),
      ]);

      if (profileData.status === 'fulfilled') {
        setSwitchProfiles(profileData.value);
      }

      // Process category data
      if (miscData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, miscellaneous: miscData.value }));
      }
      if (namedObjectsData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, namedObjects: namedObjectsData.value }));
      }
      if (networkServicesData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, networkServices: networkServicesData.value }));
      }
      if (rolesPoliciesData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, rolesPolicies: rolesPoliciesData.value }));
      }
      if (routingOverlayData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, routingOverlay: routingOverlayData.value }));
      }
      if (securityData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, security: securityData.value }));
      }
      if (servicesData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, services: servicesData.value }));
      }
      if (systemData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, system: systemData.value }));
      }
      if (telemetryData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, telemetry: telemetryData.value }));
      }
      if (tunnelsData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, tunnels: tunnelsData.value }));
      }
      if (vlansNetworksData.status === 'fulfilled') {
        setSwitchProfileCategories(prev => ({ ...prev, vlansNetworks: vlansNetworksData.value }));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load switch profile'));
    } finally {
      setSwitchLoading(false);
    }
  };

  // Fetch wireless profile data when device is selected
  const fetchWirelessProfile = async (serial) => {
    if (!serial) {
      setWirelessProfiles(null);
      setWirelessProfileCategories({
        radios: null,
        wlans: null,
        system: null,
      });
      return;
    }

    setWirelessLoading(true);
    setError('');

    try {
      const [profileData, radiosData, wlansData, systemData] = await Promise.allSettled([
        configAPI.wirelessProfiles.getProfile(serial),
        configAPI.wirelessProfiles.getRadios(serial),
        configAPI.wirelessProfiles.getWLANs(serial),
        configAPI.wirelessProfiles.getSystem(serial),
      ]);

      if (profileData.status === 'fulfilled') {
        setWirelessProfiles(profileData.value);
      }

      if (radiosData.status === 'fulfilled') {
        setWirelessProfileCategories(prev => ({ ...prev, radios: radiosData.value }));
      }
      if (wlansData.status === 'fulfilled') {
        setWirelessProfileCategories(prev => ({ ...prev, wlans: wlansData.value }));
      }
      if (systemData.status === 'fulfilled') {
        setWirelessProfileCategories(prev => ({ ...prev, system: systemData.value }));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load wireless profile'));
    } finally {
      setWirelessLoading(false);
    }
  };

  // Handle switch device selection
  useEffect(() => {
    if (tabValue === 7 && selectedSwitchSerial) {
      fetchSwitchProfile(selectedSwitchSerial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSwitchSerial, tabValue]);

  // Handle wireless device selection
  useEffect(() => {
    if (tabValue === 8 && selectedWirelessSerial) {
      fetchWirelessProfile(selectedWirelessSerial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWirelessSerial, tabValue]);

  const renderSwitchConfiguration = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Switch Configuration Profiles
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Select a switch to view and manage its configuration profiles including Miscellaneous, Named Objects, Network Services, Roles & Policies, Security, Services, System, Telemetry, Tunnels, and VLANs & Networks.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <DeviceSelector
            value={selectedSwitchSerial}
            onChange={(serial) => setSelectedSwitchSerial(serial)}
            deviceType="SWITCH"
            label="Select Switch"
            helperText="Choose a switch to view its configuration profiles"
            fullWidth
          />
        </Box>

        {switchLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {selectedSwitchSerial && !switchLoading && (
          <Box>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Miscellaneous</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.miscellaneous ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.miscellaneous, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No miscellaneous configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Named Objects</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.namedObjects ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.namedObjects, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No named objects available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Network Services</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.networkServices ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.networkServices, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No network services configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Roles & Policies</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.rolesPolicies ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.rolesPolicies, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No roles & policies available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Routing Overlay</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.routingOverlay ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.routingOverlay, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No routing overlay configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Security</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.security ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.security, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No security configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Services</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.services ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.services, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No services configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">System</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.system ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.system, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No system configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Telemetry</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.telemetry ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.telemetry, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No telemetry configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Tunnels</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.tunnels ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.tunnels, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No tunnels configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">VLANs & Networks</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {switchProfileCategories.vlansNetworks ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(switchProfileCategories.vlansNetworks, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No VLANs & networks configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </Box>
    );
  };

  const renderWirelessConfiguration = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Wireless Configuration Profiles
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Select an Access Point to view and manage its configuration profiles including Radios, WLANs, and System settings.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <DeviceSelector
            value={selectedWirelessSerial}
            onChange={(serial) => setSelectedWirelessSerial(serial)}
            deviceType="AP"
            label="Select Access Point"
            helperText="Choose an Access Point to view its configuration profiles"
            fullWidth
          />
        </Box>

        {wirelessLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {selectedWirelessSerial && !wirelessLoading && (
          <Box>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Radios</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {wirelessProfileCategories.radios ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(wirelessProfileCategories.radios, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No radio configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">WLANs</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {wirelessProfileCategories.wlans ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(wirelessProfileCategories.wlans, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No WLAN configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">System</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {wirelessProfileCategories.system ? (
                  <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                      {JSON.stringify(wirelessProfileCategories.system, null, 2)}
                    </pre>
                  </Paper>
                ) : (
                  <Typography color="text.secondary">No system configuration available</Typography>
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
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
            onChange={(e, newValue) => {
              setTabValue(newValue);
              setSearchParams({ tab: newValue.toString() });
            }}
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
            <Tab label={`Switch Configuration`} />
            <Tab label={`Wireless Configuration`} />
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
              {tabValue === 7 && renderSwitchConfiguration()}
              {tabValue === 8 && renderWirelessConfiguration()}
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
