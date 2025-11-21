/**
 * Enhanced Stats Card Component
 * Displays statistics with trends and sparklines
 */

import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  subtitle,
  onClick,
}) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up')
      return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
    if (trend === 'down')
      return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
    return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'success.main';
    if (trend === 'down') return 'error.main';
    return 'text.secondary';
  };

  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s',
        background: `linear-gradient(135deg, ${
          color === 'primary' ? 'rgba(255, 102, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)'
        } 0%, transparent 100%)`,
        '&:hover': onClick
          ? {
              transform: 'translateY(-4px)',
              boxShadow: `0 8px 24px rgba(255, 102, 0, 0.2)`,
            }
          : {},
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
            }}
          >
            {Icon && <Icon sx={{ color: 'white', fontSize: 28 }} />}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500, mb: 0.5 }}
            >
              {title}
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, ${
                  color === 'primary' ? '#FF6600' : '#ffffff'
                } 0%, ${color === 'primary' ? '#FF9933' : '#aaaaaa'} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {value}
            </Typography>
          </Box>
        </Box>

        {(subtitle || trend) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mt: 2,
              pt: 2,
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Chip
                icon={getTrendIcon()}
                label={trendValue || trend}
                size="small"
                sx={{
                  color: getTrendColor(),
                  backgroundColor: 'transparent',
                  border: `1px solid ${getTrendColor()}`,
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default StatsCard;
