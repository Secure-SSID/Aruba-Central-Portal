/**
 * Configuration Index Page
 * Landing page for Configuration section with category cards
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Apps as AppsIcon,
  Security as SecurityIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  HealthAndSafety as HealthIcon,
  Extension as ExtensionIcon,
  SwapHoriz as HAIcon,
  NetworkCheck as InterfaceIcon,
  Lock as LockIcon,
  Router as RouterIcon,
  DeviceHub as VLanIcon,
  Wifi as WirelessIcon,
} from '@mui/icons-material';

const configurationCategories = [
  {
    id: 'scope-management',
    title: 'Site Configuration',
    description: 'Manage sites, site collections, device groups, and scope hierarchy',
    icon: <LocationIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/scope-management',
    color: '#FF6600',
  },
  {
    id: 'application-experience',
    title: 'Application Experience',
    description: 'Configure Airgroup, Application Recognition Control, UCC, and policies',
    icon: <AppsIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/application-experience',
    color: '#2196F3',
  },
  {
    id: 'central-nac',
    title: 'Central NAC',
    description: 'Configure authorization policies, identity stores, portal profiles, and authentication',
    icon: <SecurityIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/central-nac',
    color: '#4CAF50',
  },
  {
    id: 'central-nac-service',
    title: 'Central NAC Service',
    description: 'Manage MAC/MPSK registrations, visitors, jobs, images, and certificates',
    icon: <PeopleIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/central-nac-service',
    color: '#9C27B0',
  },
  {
    id: 'config-management',
    title: 'Config Management',
    description: 'Manage configuration checkpoints and backups',
    icon: <StorageIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/config-management',
    color: '#FF9800',
  },
  {
    id: 'health',
    title: 'Configuration Health',
    description: 'Monitor device configuration health and issues',
    icon: <HealthIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/health',
    color: '#F44336',
  },
  {
    id: 'extensions',
    title: 'Extensions',
    description: 'Configure extension integrations like vSphere',
    icon: <ExtensionIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/extensions',
    color: '#00BCD4',
  },
  {
    id: 'high-availability',
    title: 'High Availability',
    description: 'Configure switch stacks and VSX profiles',
    icon: <HAIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/high-availability',
    color: '#795548',
  },
  {
    id: 'interface',
    title: 'Interface',
    description: 'Manage device profiles and interface configurations',
    icon: <InterfaceIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/interface',
    color: '#607D8B',
  },
  {
    id: 'interface-security',
    title: 'Interface Security',
    description: 'Configure MAC lockout and MACsec policies',
    icon: <LockIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/interface-security',
    color: '#E91E63',
  },
  {
    id: 'interfaces',
    title: 'Interfaces',
    description: 'Configure loopback, management, tunnel, and other interface types',
    icon: <RouterIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/interfaces',
    color: '#3F51B5',
  },
  {
    id: 'vlans-networks',
    title: 'VLANs & Networks',
    description: 'Manage VLANs, VRRP, MVRP, STP, and network configurations',
    icon: <VLanIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/vlans-networks',
    color: '#009688',
  },
  {
    id: 'wireless',
    title: 'Wireless',
    description: 'Configure WLANs, radios, Hotspot2, Passpoint, Mesh, and IDS',
    icon: <WirelessIcon sx={{ fontSize: 48 }} />,
    path: '/configuration/wireless',
    color: '#FF6600',
  },
];

function ConfigurationIndexPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleCategoryClick = (path) => {
    navigate(path);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Configuration Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage all network configuration settings organized by category
        </Typography>
      </Box>

      {/* Category Grid */}
      <Grid container spacing={3}>
        {configurationCategories.map((category) => (
          <Grid item xs={12} sm={6} md={4} key={category.id}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardActionArea
                onClick={() => handleCategoryClick(category.path)}
                sx={{ height: '100%', p: 2 }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        color: category.color,
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {category.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {category.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {category.description}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default ConfigurationIndexPage;

