/**
 * Users Page
 * Note: User management API not available in v1alpha1
 */

import { Box, Card, CardContent, Typography, Alert, Paper } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonOffIcon from '@mui/icons-material/PersonOff';

function UsersPage() {
  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage user accounts and permissions
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          User Management API Not Available
        </Typography>
        <Typography variant="body2">
          The User Management endpoints (
          <code>/platform/rbac/v1/users</code>) are not available in the HPE
          Aruba Networking Central API v1alpha1. This feature may be added in
          future API versions.
        </Typography>
      </Alert>

      {/* Empty State Card */}
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              textAlign: 'center',
            }}
          >
            <PersonOffIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              User Management Unavailable
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
              User and role management features are currently unavailable in the New
              Central API v1alpha1. For now, please use the Aruba Central web interface to
              manage users and permissions.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'background.default' }}>
        <Typography variant="subtitle2" gutterBottom>
          Alternative Options:
        </Typography>
        <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
          <li>Use the HPE Aruba Networking Central web portal for user management</li>
          <li>
            Check the{' '}
            <a
              href="https://developer.arubanetworks.com/new-central-config/reference"
              target="_blank"
              rel="noopener noreferrer"
            >
              API documentation
            </a>{' '}
            for future updates
          </li>
          <li>Monitor API changelog for when user management endpoints become available</li>
        </Typography>
      </Paper>
    </Box>
  );
}

export default UsersPage;
