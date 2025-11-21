import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Alert, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper } from '@mui/material';
import apiClient from '../services/api';

function GLWorkspacesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);

  const fetchTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await apiClient.get('/greenlake/workspaces');
      setTenants(resp.data?.items || resp.data?.tenants || resp.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load MSP tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>MSP Workspaces (GreenLake)</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tenant ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((t, idx) => (
                  <TableRow key={t.id || t.tenantId || idx}>
                    <TableCell>{t.id || t.tenantId || '-'}</TableCell>
                    <TableCell>{t.name || t.displayName || '-'}</TableCell>
                    <TableCell>{t.status || '-'}</TableCell>
                    <TableCell>{t.createdAt || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

export default GLWorkspacesPage;


