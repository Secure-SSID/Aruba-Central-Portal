/**
 * NAC (Network Access Control) Page Component
 * Displays NAC user roles, device profiles, and client authentication status
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Security as SecurityIcon,
  DeviceHub as DeviceHubIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import { nacAPI } from '../services/api';

function NACPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [userRoles, setUserRoles] = useState([]);
  const [deviceProfiles, setDeviceProfiles] = useState([]);
  const [clientAuth, setClientAuth] = useState([]);

  useEffect(() => {
    fetchNACData();
  }, []);

  const fetchNACData = async () => {
    try {
      setLoading(true);
      setError('');

      const [rolesData, profilesData, authData] = await Promise.allSettled([
        nacAPI.getUserRoles(),
        nacAPI.getDeviceProfiles(),
        nacAPI.getClientAuth(),
      ]);

      if (rolesData.status === 'fulfilled') {
        setUserRoles(rolesData.value.user_roles || rolesData.value.items || []);
      }

      if (profilesData.status === 'fulfilled') {
        setDeviceProfiles(profilesData.value.device_profiles || profilesData.value.items || []);
      }

      if (authData.status === 'fulfilled') {
        setClientAuth(authData.value.items || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load NAC data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Network Access Control (NAC)
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage user roles, device profiles, and client authentication
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    User Roles
                  </Typography>
                  <Typography variant="h4">{userRoles.length}</Typography>
                </Box>
                <VerifiedUserIcon sx={{ fontSize: 40, color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Device Profiles
                  </Typography>
                  <Typography variant="h4">{deviceProfiles.length}</Typography>
                </Box>
                <DeviceHubIcon sx={{ fontSize: 40, color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Authenticated Clients
                  </Typography>
                  <Typography variant="h4">{clientAuth.length}</Typography>
                </Box>
                <SecurityIcon sx={{ fontSize: 40, color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* NAC Data Tables */}
      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
            <Tab label="User Roles" />
            <Tab label="Device Profiles" />
            <Tab label="Client Authentication" />
          </Tabs>

          {/* User Roles Tab */}
          {tabValue === 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Role Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Access Level</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userRoles.length > 0 ? (
                    userRoles.map((role, index) => (
                      <TableRow key={index}>
                        <TableCell>{role.name || role.rolename || 'Unknown'}</TableCell>
                        <TableCell>{role.type || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={role.access_level || role.permissions || 'Standard'}
                            color="primary"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={role.status || 'Active'}
                            color={role.status === 'Active' ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No user roles found or endpoint not available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Device Profiles Tab */}
          {tabValue === 1 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Profile Name</TableCell>
                    <TableCell>Device Type</TableCell>
                    <TableCell>Policy</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deviceProfiles.length > 0 ? (
                    deviceProfiles.map((profile, index) => (
                      <TableRow key={index}>
                        <TableCell>{profile.name || 'Unknown'}</TableCell>
                        <TableCell>{profile.device_type || 'N/A'}</TableCell>
                        <TableCell>{profile.policy || 'Default'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={profile.status || 'Active'}
                            color={profile.status === 'Active' ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No device profiles found or endpoint not available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Client Authentication Tab */}
          {tabValue === 2 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Client Name</TableCell>
                    <TableCell>MAC Address</TableCell>
                    <TableCell>Authentication Method</TableCell>
                    <TableCell>User Role</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientAuth.length > 0 ? (
                    clientAuth.slice(0, 50).map((client, index) => (
                      <TableRow key={index}>
                        <TableCell>{client.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {client.mac || client.macAddress}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={client.keyManagement || client.authentication || 'N/A'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{client.userRole || client.role || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={client.status || 'Connected'}
                            color={client.status === 'Connected' ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No authenticated clients found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default NACPage;
