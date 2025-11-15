/**
 * Breadcrumb Navigation Component
 * Provides hierarchical navigation with automatic route parsing
 */

import { Link, useLocation, useParams } from 'react-router-dom';
import { Breadcrumbs, Typography, Box } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

// Map routes to readable labels
const routeLabels = {
  '': 'Dashboard',
  'devices': 'Devices',
  'clients': 'Clients',
  'sites': 'Sites',
  'wlans': 'WLANs',
  'configuration': 'Configuration',
  'users': 'Users',
  'nac': 'Network Access Control',
  'alerts': 'Alerts',
  'analytics': 'Analytics',
  'firmware': 'Firmware',
  'troubleshoot': 'Troubleshoot',
  'network-monitor': 'Network Monitor',
  'api-explorer': 'API Explorer',
  'settings': 'Settings',
};

function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't show breadcrumb on login page or root dashboard
  if (location.pathname === '/login' || pathnames.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2, mt: 1 }}>
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-separator': {
            color: 'text.secondary',
          },
        }}
      >
        {/* Home/Dashboard link */}
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <HomeIcon
            sx={{ mr: 0.5, color: 'primary.main' }}
            fontSize="small"
          />
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
              transition: 'color 0.2s',
            }}
          >
            Dashboard
          </Typography>
        </Link>

        {/* Dynamic path segments */}
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;

          // Check if this is a parameter (like device serial)
          const isParam = Object.values(params).includes(value);
          const label = isParam ? value : (routeLabels[value] || value);

          return isLast ? (
            <Typography
              key={to}
              variant="body2"
              sx={{
                color: 'text.primary',
                fontWeight: 600,
              }}
            >
              {label}
            </Typography>
          ) : (
            <Link
              key={to}
              to={to}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                  transition: 'color 0.2s',
                }}
              >
                {label}
              </Typography>
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}

export default Breadcrumb;
