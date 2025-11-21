/**
 * WLANs Management Page
 * View and manage wireless networks (SSIDs)
 */

import { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  Button,
  Chip,
  IconButton,
  Grid,
} from '@mui/material';
import {
  Wifi as WifiIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  SignalWifi4Bar as SignalIcon,
} from '@mui/icons-material';
import { wlanAPI } from '../services/api';

function WLANsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wlans, setWlans] = useState([]);

  useEffect(() => {
    fetchWLANs();
  }, []);

  const fetchWLANs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await wlanAPI.getAll();
      console.log('WLANs API Response:', response); // Debug log
      setWlans(response.wlans || response.items || response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load WLANs');
    } finally {
      setLoading(false);
    }
  };

  const getSecurityColor = (security) => {
    if (!security) return 'default';
    const sec = security.toLowerCase();
    if (sec.includes('wpa3') || sec.includes('802.1x')) return 'success';
    if (sec.includes('wpa2')) return 'primary';
    if (sec.includes('open')) return 'error';
    return 'default';
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
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            WLANs / SSIDs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage wireless networks
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchWLANs}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
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
                    Total WLANs
                  </Typography>
                  <Typography variant="h4">{wlans.length}</Typography>
                </Box>
                <WifiIcon sx={{ fontSize: 40, color: '#FF6600' }} />
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
                    Secure Networks
                  </Typography>
                  <Typography variant="h4">
                    {wlans.filter(w => w.security && !w.security.toLowerCase().includes('open')).length}
                  </Typography>
                </Box>
                <SecurityIcon sx={{ fontSize: 40, color: '#4caf50' }} />
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
                    Enabled
                  </Typography>
                  <Typography variant="h4">
                    {wlans.filter(w => w.status === 'enabled' || w.enabled).length}
                  </Typography>
                </Box>
                <SignalIcon sx={{ fontSize: 40, color: '#2196f3' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* WLANs Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>SSID Name</TableCell>
                  <TableCell>Security</TableCell>
                  <TableCell>Band</TableCell>
                  <TableCell>VLAN</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Broadcast</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {wlans.length > 0 ? (
                  wlans.map((wlan, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {wlan.ssid || wlan.essid || wlan.name || wlan.wlanName || wlan.ssid_name || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={wlan.security || wlan.keyManagement || 'N/A'}
                          color={getSecurityColor(wlan.security || wlan.keyManagement)}
                        />
                      </TableCell>
                      <TableCell>{wlan.band || wlan.type || 'N/A'}</TableCell>
                      <TableCell>{wlan.vlan || wlan.vlanId || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={wlan.status || (wlan.enabled ? 'enabled' : 'disabled')}
                          color={(wlan.status === 'enabled' || wlan.enabled) ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={wlan.broadcast !== false ? 'Yes' : 'Hidden'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No WLANs found or endpoint not available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

export default WLANsPage;
