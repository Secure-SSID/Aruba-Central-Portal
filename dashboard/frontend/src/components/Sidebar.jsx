/**
 * Enhanced Sidebar Navigation Component
 * Features: Nested menus, search, recent pages, favorites
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import ApiIcon from '@mui/icons-material/Api';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import SecurityIcon from '@mui/icons-material/Security';
import BugReportIcon from '@mui/icons-material/BugReport';
import TuneIcon from '@mui/icons-material/Tune';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WifiIcon from '@mui/icons-material/Wifi';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudIcon from '@mui/icons-material/Cloud';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShieldIcon from '@mui/icons-material/Shield';

const DRAWER_WIDTH = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
];

const menuGroups = [
  {
    id: 'main',
    title: 'Main',
    icon: <DashboardIcon />,
    items: menuItems,
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    icon: <NetworkCheckIcon />,
    items: [
      { text: 'Devices', icon: <DevicesIcon />, path: '/devices' },
      { text: 'Clients', icon: <GroupsIcon />, path: '/clients' },
      { text: 'Sites', icon: <LocationOnIcon />, path: '/sites' },
      { text: 'WLANs', icon: <WifiIcon />, path: '/wlans' },
      { text: 'NAC', icon: <SecurityIcon />, path: '/nac' },
      { text: 'Alerts', icon: <NotificationsIcon />, path: '/alerts' },
      { text: 'Analytics', icon: <AssessmentIcon />, path: '/analytics' },
      { text: 'Reporting', icon: <DescriptionIcon />, path: '/reporting' },
    ],
  },
  {
    id: 'config',
    title: 'Configuration',
    icon: <TuneIcon />,
    items: [
      { text: 'Site Config', icon: <LocationOnIcon />, path: '/configuration/scope-management' },
      { text: 'Application Experience', icon: <VisibilityIcon />, path: '/configuration/application-experience' },
      { text: 'Extensions', icon: <DescriptionIcon />, path: '/configuration/extensions' },
      { text: 'High Availability', icon: <NetworkCheckIcon />, path: '/configuration/high-availability' },
      { text: 'Interfaces', icon: <NetworkCheckIcon />, path: '/configuration/interfaces' },
      { text: 'Wireless', icon: <WifiIcon />, path: '/configuration/wireless' },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    icon: <SettingsIcon />,
    items: [
      { text: 'Firmware', icon: <SystemUpdateIcon />, path: '/firmware' },
      { text: 'Troubleshoot', icon: <BugReportIcon />, path: '/troubleshoot' },
      { text: 'API Explorer', icon: <ApiIcon />, path: '/api-explorer' },
      { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ],
  },
  {
    id: 'gl',
    title: 'GreenLake',
    icon: <CloudIcon />,
    items: [
      { text: 'Devices', icon: <DevicesIcon />, path: '/gl/devices' },
      { text: 'Locations', icon: <LocationOnIcon />, path: '/gl/locations' },
      { text: 'Tags', icon: <DescriptionIcon />, path: '/gl/tags' },
      { text: 'Subscriptions', icon: <AssessmentIcon />, path: '/gl/subscriptions' },
      { text: 'Users', icon: <PeopleIcon />, path: '/gl/users' },
      { text: 'Roles', icon: <ShieldIcon />, path: '/gl/roles' },
      { text: 'Permissions', icon: <SecurityIcon />, path: '/gl/permissions' },
    ],
  },
  {
    id: 'msp',
    title: 'MSP',
    icon: <GroupsIcon />,
    items: [
      { text: 'Workspaces', icon: <GroupsIcon />, path: '/gl/workspaces' },
    ],
  },
];

function Sidebar({ open, onToggle, onSearchOpen }) {
  const location = useLocation();
  const prevLocationRef = useRef(location.pathname + location.search);
  const [expandedGroups, setExpandedGroups] = useState(['main', 'monitoring']); // keep Administration and Configuration collapsed by default, Monitoring expanded
  const [clickedGroups, setClickedGroups] = useState([]); // Track which dropdown headers were clicked (for highlighting)
  const [favorites, setFavorites] = useState([]);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = JSON.parse(localStorage.getItem('navFavorites') || '[]');
    setFavorites(savedFavorites);
  }, []);

  // Clear dropdown highlights when route changes to a page item (not on initial load or when already on a page)
  useEffect(() => {
    const currentLocation = location.pathname + location.search;
    const prevLocation = prevLocationRef.current;
    
    // Only clear if location actually changed (not initial render)
    if (currentLocation !== prevLocation) {
      // Find which group has an active item and clear only that group's highlight
      menuGroups.forEach(group => {
        if (group.id === 'main') return; // Skip main group
        
        const hasActiveItem = group.items.some(item => {
          if (item.path.includes('?tab=')) {
            const [pathname, search] = item.path.split('?');
            const params = new URLSearchParams(search);
            const tabParam = params.get('tab');
            const currentParams = new URLSearchParams(location.search);
            return location.pathname === pathname && currentParams.get('tab') === tabParam;
          } else {
            return location.pathname === item.path && !location.search;
          }
        });

        // If this group has an active item, remove it from clicked groups
        if (hasActiveItem) {
          setClickedGroups((prev) => prev.filter((id) => id !== group.id));
        }
      });
    }
    
    prevLocationRef.current = currentLocation;
  }, [location.pathname, location.search]);

  const toggleGroup = (groupId) => {
    const isCurrentlyExpanded = expandedGroups.includes(groupId);
    
    setExpandedGroups((prev) => {
      if (isCurrentlyExpanded) {
        // If closing this dropdown, just remove it
        return prev.filter((id) => id !== groupId);
      } else {
        // If opening this dropdown, close all others first (except 'main')
        return ['main', groupId];
      }
    });
    
    // Highlight the dropdown header when clicked
    setClickedGroups((prev) => {
      if (isCurrentlyExpanded) {
        // If already clicked, remove highlight when collapsing
        return prev.filter((id) => id !== groupId);
      } else {
        // If opening, clear other highlights and add this one
        return [groupId];
      }
    });
  };

  // Clear dropdown highlight when a page item is clicked
  const handleMenuItemClick = (groupId) => {
    setClickedGroups((prev) => prev.filter((id) => id !== groupId));
  };

  const toggleFavorite = (path, e) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      localStorage.setItem('navFavorites', JSON.stringify(updated));
      return updated;
    });
  };

  const renderMenuItem = (item, isNested = false, groupId = null) => {
    // For Configuration items, check both pathname and search params
    let isActive = false;
    if (item.path.includes('?tab=')) {
      const [pathname, search] = item.path.split('?');
      const params = new URLSearchParams(search);
      const tabParam = params.get('tab');
      const currentParams = new URLSearchParams(location.search);
      isActive = location.pathname === pathname && currentParams.get('tab') === tabParam;
    } else {
      // Strict path matching - Dashboard (/) only active on exact root path
      if (item.path === '/') {
        isActive = location.pathname === '/' && !location.search;
      } else {
        // For other paths, match exactly
        isActive = location.pathname === item.path && !location.search;
      }
    }
    const isFavorite = favorites.includes(item.path);

    // Clear dropdown highlight when a page item is clicked
    const handleClick = () => {
      if (groupId) {
        handleMenuItemClick(groupId);
      }
    };

    return (
      <ListItem key={item.path} disablePadding>
        <ListItemButton
          component={Link}
          to={item.path}
          onClick={handleClick}
          sx={{
            mx: 1,
            mb: 0.5,
            pl: isNested ? 4 : 2,
            borderRadius: 1,
            backgroundColor: isActive ? 'primary.main' : 'transparent',
            '&:hover': {
              backgroundColor: isActive
                ? 'primary.dark'
                : 'rgba(255, 102, 0, 0.08)',
            },
            transition: 'all 0.2s',
          }}
        >
          <ListItemIcon
            sx={{
              color: isActive ? 'white' : 'text.secondary',
              minWidth: 40,
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            sx={{
              '& .MuiTypography-root': {
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'white' : 'text.primary',
                fontSize: isNested ? '0.875rem' : '1rem',
              },
            }}
          />
          <IconButton
            size="small"
            onClick={(e) => toggleFavorite(item.path, e)}
            sx={{
              color: isFavorite
                ? 'warning.main'
                : isActive
                ? 'rgba(255, 255, 255, 0.5)'
                : 'rgba(255, 255, 255, 0.3)',
              '&:hover': {
                color: 'warning.main',
              },
            }}
          >
            {isFavorite ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo/Title */}
        <Box
          sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <NetworkCheckIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FF6600 0%, #FF9933 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aruba Central
          </Typography>
        </Box>

        {/* Search Button */}
        <Box sx={{ px: 2, mb: 2 }}>
          <ListItemButton
            onClick={onSearchOpen}
            sx={{
              borderRadius: 1,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              '&:hover': {
                backgroundColor: 'rgba(255, 102, 0, 0.08)',
                borderColor: 'primary.main',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SearchIcon />
            </ListItemIcon>
            <ListItemText
              primary="Search..."
              sx={{
                '& .MuiTypography-root': {
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ⌘K
            </Typography>
          </ListItemButton>
        </Box>

        <Divider sx={{ mx: 2, mb: 2 }} />

        {/* Main Navigation with Nested Groups */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <List>
            {menuGroups.map((group) => {
              if (group.id === 'main') {
                return group.items.map((item) => renderMenuItem(item));
              }

              const isExpanded = expandedGroups.includes(group.id);
              const isGroupClicked = clickedGroups.includes(group.id);
              // Check if any item in this group is currently active
              const hasActiveItem = group.items.some(item => {
                if (item.path.includes('?tab=')) {
                  const [pathname, search] = item.path.split('?');
                  const params = new URLSearchParams(search);
                  const tabParam = params.get('tab');
                  const currentParams = new URLSearchParams(location.search);
                  return location.pathname === pathname && currentParams.get('tab') === tabParam;
                } else {
                  return location.pathname === item.path && !location.search;
                }
              });
              // Highlight if clicked, but remove highlight when a page item becomes active
              const shouldHighlight = isGroupClicked && !hasActiveItem;

              return (
                <Box key={group.id}>
                  <ListItemButton
                    onClick={() => toggleGroup(group.id)}
                    disableRipple
                    selected={false}
                    sx={{
                      mx: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      backgroundColor: shouldHighlight ? 'primary.main' : 'transparent',
                      '&:hover': {
                        backgroundColor: shouldHighlight
                          ? 'primary.dark'
                          : 'rgba(255, 102, 0, 0.08)',
                      },
                      '&:focus': {
                        backgroundColor: shouldHighlight ? 'primary.main' : 'transparent',
                      },
                      '&:active': {
                        backgroundColor: shouldHighlight ? 'primary.dark' : 'transparent',
                      },
                      '&.Mui-selected': {
                        backgroundColor: shouldHighlight ? 'primary.main' : 'transparent',
                        '&:hover': {
                          backgroundColor: shouldHighlight
                            ? 'primary.dark'
                            : 'rgba(255, 102, 0, 0.08)',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ 
                      color: shouldHighlight ? 'white' : 'text.secondary', 
                      minWidth: 40 
                    }}>
                      {group.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={group.title}
                      sx={{
                        '& .MuiTypography-root': {
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: shouldHighlight ? 'white' : 'text.primary',
                        },
                      }}
                    />
                    {isExpanded ? (
                      <ExpandLessIcon sx={{ color: shouldHighlight ? 'white' : 'text.secondary' }} />
                    ) : (
                      <ExpandMoreIcon sx={{ color: shouldHighlight ? 'white' : 'text.secondary' }} />
                    )}
                  </ListItemButton>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {group.items.map((item) => renderMenuItem(item, true, group.id))}
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            display="block"
          >
            Aruba Central Dashboard v2.0
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            display="block"
          >
            Powered by HPE Aruba Networking APIs
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
