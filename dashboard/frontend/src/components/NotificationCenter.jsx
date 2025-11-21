/**
 * Notification Center Component
 * Displays alerts and notifications with badge counts
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { alertsAPI } from '../services/api';

const NotificationCenter = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await alertsAPI.getAll();
      const alerts = response.alerts || [];

      // Get top 5 most recent unacknowledged alerts
      const recent = alerts
        .filter((alert) => !alert.acknowledged)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

      setNotifications(recent);
      setUnreadCount(alerts.filter((alert) => !alert.acknowledged).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/alerts');
  };

  const handleNotificationClick = (alertId) => {
    handleClose();
    navigate(`/alerts?highlight=${alertId}`);
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <ErrorOutlineIcon color="error" />;
      case 'warning':
        return <WarningAmberIcon color="warning" />;
      case 'info':
        return <InfoOutlinedIcon color="info" />;
      default:
        return <CheckCircleOutlineIcon color="success" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'success';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            mt: 1,
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        {/* Notifications List */}
        {notifications.length > 0 ? (
          <>
            {notifications.map((notification, index) => (
              <MenuItem
                key={notification.alert_id || index}
                onClick={() => handleNotificationClick(notification.alert_id)}
                sx={{
                  py: 1.5,
                  px: 2,
                  alignItems: 'flex-start',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 102, 0, 0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                  {getSeverityIcon(notification.severity)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                        {notification.description || 'Alert'}
                      </Typography>
                      <Chip
                        label={notification.severity || 'Info'}
                        size="small"
                        color={getSeverityColor(notification.severity)}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {formatTimestamp(notification.timestamp)}
                    </Typography>
                  }
                />
              </MenuItem>
            ))}
            <Divider />
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Button
                fullWidth
                variant="text"
                onClick={handleViewAll}
                sx={{ color: 'primary.main' }}
              >
                View All Alerts
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleOutlineIcon
              sx={{ fontSize: 48, color: 'success.main', mb: 2 }}
            />
            <Typography variant="body1" color="text.secondary">
              No new notifications
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              You're all caught up!
            </Typography>
          </Box>
        )}
      </Menu>
    </>
  );
};

export default NotificationCenter;
