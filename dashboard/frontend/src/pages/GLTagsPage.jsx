import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, Button, TextField, InputAdornment, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import apiClient from '../services/api';

function GLTagsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tags, setTags] = useState([]);
  const [sortBy, setSortBy] = useState('key');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    key: '',
    value: '',
    resourceType: '',
    resourceId: '',
  });

  const fetchTags = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await apiClient.get('/greenlake/tags');
      let items = resp.data?.items || resp.data?.tags || [];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        items = items.filter((t) =>
          (t.key || t.tagKey || '').toLowerCase().includes(q) ||
          (t.value || t.tagValue || '').toLowerCase().includes(q) ||
          (t.resourceType || '').toLowerCase().includes(q) ||
          (t.resourceId || '').toLowerCase().includes(q)
        );
      }
      items = [...items].sort((a, b) => {
        const av = (
          (sortBy === 'key'
            ? a.key || a.tagKey
            : sortBy === 'value'
            ? a.value || a.tagValue
            : sortBy === 'type'
            ? a.resourceType
            : sortBy === 'rid'
            ? a.resourceId
            : '') || ''
        )
          .toString()
          .toLowerCase();
        const bv = (
          (sortBy === 'key'
            ? b.key || b.tagKey
            : sortBy === 'value'
            ? b.value || b.tagValue
            : sortBy === 'type'
            ? b.resourceType
            : sortBy === 'rid'
            ? b.resourceId
            : '') || ''
        )
          .toString()
          .toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      setTags(items);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (c) => {
    if (sortBy === c) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(c);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const headers = ['Key', 'Value', 'Resource Type', 'Resource ID'];
    const rows = tags.map((t) => [
      t.key || t.tagKey || '',
      t.value || t.tagValue || '',
      t.resourceType || '',
      t.resourceId || '',
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'greenlake_tags.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.post('/greenlake/tags', formData);
      setSuccess('Tag created successfully');
      setCreateOpen(false);
      setFormData({ id: '', key: '', value: '', resourceType: '', resourceId: '' });
      await fetchTags();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create tag');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.patch(`/greenlake/tags/${formData.id}`, formData);
      setSuccess('Tag updated successfully');
      setEditOpen(false);
      setFormData({ id: '', key: '', value: '', resourceType: '', resourceId: '' });
      await fetchTags();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update tag');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tagId) => {
    if (!window.confirm('Delete this tag?')) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/greenlake/tags/${tagId}`);
      setSuccess('Tag deleted successfully');
      await fetchTags();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete tag');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (tag) => {
    setFormData({
      id: tag.id || tag.tagId,
      key: tag.key || tag.tagKey || '',
      value: tag.value || tag.tagValue || '',
      resourceType: tag.resourceType || '',
      resourceId: tag.resourceId || '',
    });
    setEditOpen(true);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Tags (GreenLake)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage resource tags for organization and filtering
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Tag
          </Button>
          <Button startIcon={<DownloadIcon />} onClick={exportCsv} variant="outlined">
            Export CSV
          </Button>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={fetchTags} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <TextField
            size="small"
            placeholder="Search tags by key, value, or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTags()}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start">🔎</InputAdornment> }}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell onClick={() => handleSort('key')} sx={{ cursor: 'pointer' }}>
                    Key {sortBy === 'key' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell onClick={() => handleSort('value')} sx={{ cursor: 'pointer' }}>
                    Value {sortBy === 'value' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell onClick={() => handleSort('type')} sx={{ cursor: 'pointer' }}>
                    Resource Type {sortBy === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell onClick={() => handleSort('rid')} sx={{ cursor: 'pointer' }}>
                    Resource ID {sortBy === 'rid' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No tags found. Create your first tag to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  tags.map((tag, idx) => {
                    const tagId = tag.id || tag.tagId;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{tag.key || tag.tagKey || '-'}</TableCell>
                        <TableCell>{tag.value || tag.tagValue || '-'}</TableCell>
                        <TableCell>{tag.resourceType || '-'}</TableCell>
                        <TableCell>{tag.resourceId || '-'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => openEditDialog(tag)}
                                disabled={loading}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(tagId)}
                                disabled={loading}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Tag</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Tag Key"
              fullWidth
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
            />
            <TextField
              label="Tag Value"
              fullWidth
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              required
            />
            <TextField
              label="Resource Type"
              fullWidth
              value={formData.resourceType}
              onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
              placeholder="e.g., device, subscription, workspace"
            />
            <TextField
              label="Resource ID"
              fullWidth
              value={formData.resourceId}
              onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
              placeholder="Optional resource identifier"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!formData.key || !formData.value || loading}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tag</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField label="Tag ID" fullWidth value={formData.id} disabled />
            <TextField
              label="Tag Key"
              fullWidth
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
            />
            <TextField
              label="Tag Value"
              fullWidth
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              required
            />
            <TextField
              label="Resource Type"
              fullWidth
              value={formData.resourceType}
              onChange={(e) => setFormData({ ...formData, resourceType: e.target.value })}
            />
            <TextField
              label="Resource ID"
              fullWidth
              value={formData.resourceId}
              onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={!formData.key || !formData.value || loading}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GLTagsPage;
