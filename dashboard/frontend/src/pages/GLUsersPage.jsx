import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Pagination,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import SearchIcon from '@mui/icons-material/Search';
import { greenlakeUserAPI } from '../services/api';

function StatusChip({ status }) {
  const color =
    status === 'ACTIVE' ? 'success' :
    status === 'UNVERIFIED' ? 'warning' :
    status === 'DISABLED' ? 'default' :
    'info';
  return <Chip size="small" color={color} label={status || 'UNKNOWN'} />;
}

export default function GLUsersPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');

  const filter = useMemo(() => {
    if (!search.trim()) return null;
    // GreenLake filter: username eq 'email@example.com'
    // For contains-like search, backend might not support; start with exact match
    return `username eq '${search.trim()}'`;
  }, [search]);

  const offset = (page - 1) * pageSize;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await greenlakeUserAPI.list({
        filter,
        limit: pageSize,
        offset,
      });
      // Expecting { items: [], count: N }
      setUsers(data.items || []);
      setCount(data.count || 0);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, pageSize]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    try {
      await greenlakeUserAPI.invite({ email: inviteEmail.trim(), sendWelcomeEmail: true });
      setInviteOpen(false);
      setInviteEmail('');
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Invite failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    try {
      await greenlakeUserAPI.delete(userId);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          GreenLake Users
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<PersonAddAlt1Icon />}
            onClick={() => setInviteOpen(true)}
          >
            Invite User
          </Button>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={load} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <SearchIcon />
            <TextField
              size="small"
              label="Search by username (email)"
              placeholder="user@example.com"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              sx={{ maxWidth: 360 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Box mb={2}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.username || '-'}</TableCell>
                <TableCell>{u.displayName || '-'}</TableCell>
                <TableCell><StatusChip status={u.userStatus} /></TableCell>
                <TableCell>{u.lastLogin || '-'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Delete">
                    <span>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => handleDelete(u.id)}
                        disabled={loading}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No users found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" justifyContent="flex-end" mt={2}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, p) => setPage(p)}
          color="primary"
          size="small"
        />
      </Stack>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <DialogTitle>Invite User</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvite} disabled={!inviteEmail || loading}>
            Send Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


