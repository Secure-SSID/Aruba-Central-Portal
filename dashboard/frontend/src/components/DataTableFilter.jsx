/**
 * Data Table Filter Component
 * Reusable filter with search, sorting, and export functionality
 */

import { useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ClearIcon from '@mui/icons-material/Clear';

function DataTableFilter({
  searchValue,
  onSearchChange,
  sortOptions = [],
  currentSort,
  onSortChange,
  filterOptions = [],
  activeFilters = [],
  onFilterChange,
  onExportCSV,
  onExportJSON,
  placeholder = 'Search...',
}) {
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  const handleSortClick = (event) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleFilterClick = (event) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleSortSelect = (sortKey) => {
    onSortChange(sortKey);
    setSortAnchorEl(null);
  };

  const handleFilterSelect = (filterKey, value) => {
    onFilterChange(filterKey, value);
    setFilterAnchorEl(null);
  };

  const handleExportCSV = () => {
    onExportCSV();
    setExportAnchorEl(null);
  };

  const handleExportJSON = () => {
    onExportJSON();
    setExportAnchorEl(null);
  };

  const handleClearFilters = () => {
    onSearchChange('');
    onFilterChange(null, null); // Clear all filters
  };

  const hasActiveFilters = searchValue || activeFilters.length > 0;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {/* Search Field */}
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchValue && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => onSearchChange('')}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper',
            },
          }}
        />

        {/* Sort Button */}
        {sortOptions.length > 0 && (
          <Tooltip title="Sort">
            <IconButton
              onClick={handleSortClick}
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.12)',
                '&:hover': {
                  borderColor: 'primary.main',
                },
              }}
            >
              <SortIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Filter Button */}
        {filterOptions.length > 0 && (
          <Tooltip title="Filter">
            <IconButton
              onClick={handleFilterClick}
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.12)',
                '&:hover': {
                  borderColor: 'primary.main',
                },
              }}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Export Button */}
        {(onExportCSV || onExportJSON) && (
          <Tooltip title="Export">
            <IconButton
              onClick={handleExportClick}
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.12)',
                '&:hover': {
                  borderColor: 'primary.main',
                },
              }}
            >
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
          >
            Clear
          </Button>
        )}
      </Stack>

      {/* Active Filters Display */}
      {activeFilters.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {activeFilters.map((filter, index) => (
            <Chip
              key={index}
              label={`${filter.label}: ${filter.value}`}
              onDelete={() => onFilterChange(filter.key, null)}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
        </Stack>
      )}

      {/* Sort Menu */}
      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
      >
        {sortOptions.map((option) => (
          <MenuItem
            key={option.key}
            selected={currentSort === option.key}
            onClick={() => handleSortSelect(option.key)}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
      >
        {filterOptions.map((filterGroup) => (
          <Box key={filterGroup.key} sx={{ px: 2, py: 1 }}>
            <Box sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>
              {filterGroup.label}
            </Box>
            {filterGroup.options.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => handleFilterSelect(filterGroup.key, option.value)}
                sx={{ fontSize: '0.875rem' }}
              >
                {option.label}
              </MenuItem>
            ))}
          </Box>
        ))}
      </Menu>

      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        {onExportCSV && (
          <MenuItem onClick={handleExportCSV}>Export as CSV</MenuItem>
        )}
        {onExportJSON && (
          <MenuItem onClick={handleExportJSON}>Export as JSON</MenuItem>
        )}
      </Menu>
    </Box>
  );
}

export default DataTableFilter;
