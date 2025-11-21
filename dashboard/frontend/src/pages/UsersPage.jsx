import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  TextField,
  InputAdornment,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import apiClient from '../services/api';

function UsersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [updateGiven, setUpdateGiven] = useState('');
  const [updateFamily, setUpdateFamily] = useState('');
  const [updateDisplay, setUpdateDisplay] = useState('');
  const [sortBy, setSortBy] = useState('username');
  const [sortDir, setSortDir] = useState('asc');
  const [groups, setGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [roleToAdd, setRoleToAdd] = useState('');
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameGroupOpen, setRenameGroupOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [renameGroupName, setRenameGroupName] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        offset: (page - 1) * limit,
        limit,
      };
      if (search.trim()) {
        params.filter = `username eq '${search.trim()}'`;
      }
      // SCIM list users
      const resp = await apiClient.get('/greenlake/scim/users', { params: { startIndex: params.offset || 0, count: params.limit || 25 } });
      let items = resp.data?.Resources || [];
      // client-side sort
      items = [...items].sort((a, b) => {
        const aU = a.userName || a.username || '';
        const bU = b.userName || b.username || '';
        const aFirst = a.name?.givenName || a.firstName || '';
        const bFirst = b.name?.givenName || b.firstName || '';
        const aLast = a.name?.familyName || a.lastName || '';
        const bLast = b.name?.familyName || b.lastName || '';
        const aCreated = a.meta?.created || a.createdAt || '';
        const bCreated = b.meta?.created || b.createdAt || '';
        const aLogin = a.meta?.lastLogin || a.lastLogin || '';
        const bLogin = b.meta?.lastLogin || b.lastLogin || '';
        const av = (sortBy === 'username' ? aU :
                    sortBy === 'firstName' ? aFirst :
                    sortBy === 'lastName' ? aLast :
                    sortBy === 'lastLogin' ? aLogin :
                    sortBy === 'createdAt' ? aCreated : '').toString().toLowerCase();
        const bv = (sortBy === 'username' ? bU :
                    sortBy === 'firstName' ? bFirst :
                    sortBy === 'lastName' ? bLast :
                    sortBy === 'lastLogin' ? bLogin :
                    sortBy === 'createdAt' ? bCreated : '').toString().toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      setUsers(items);
      setTotal(resp.data?.totalResults || resp.data?.total || 0);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const headers = ['Email','Status','First Name','Last Name','Last Login','Created'];
    const rows = users.map((u) => [
      u.username || '',
      u.userStatus || '',
      u.firstName || '',
      u.lastName || '',
      u.lastLogin || '',
      u.createdAt || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'greenlake_users.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const inviteUser = async () => {
    try {
      // SCIM create user
      const payload = {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: inviteEmail,
        displayName: inviteEmail,
        emails: [{ primary: true, value: inviteEmail }],
      };
      await apiClient.post('/greenlake/scim/users', payload);
      setInviteOpen(false);
      setInviteEmail('');
      setPage(1);
      fetchUsers();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to invite user');
    }
  };

  const updateUser = async () => {
    if (!selectedUserId) return;
    try {
      const ops = [];
      if (updateDisplay) {
        ops.push({ op: 'replace', path: 'displayName', value: updateDisplay });
      }
      if (updateGiven || updateFamily) {
        const nameObj = {};
        if (updateGiven) nameObj.givenName = updateGiven;
        if (updateFamily) nameObj.familyName = updateFamily;
        ops.push({ op: 'replace', path: 'name', value: nameObj });
      }
      if (ops.length === 0) return;
      await apiClient.patch(`/greenlake/scim/users/${selectedUserId}`, {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: ops
      });
      fetchUsers();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update user');
    }
  };

  const deleteUser = async () => {
    if (!selectedUserId) return;
    try {
      await apiClient.delete(`/greenlake/scim/users/${selectedUserId}`);
      setSelectedUserId('');
      fetchUsers();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete user');
    }
  };

  // Load groups once
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiClient.get('/greenlake/scim/groups', { params: { count: 200 } });
        const resources = resp.data?.Resources || resp.data?.items || [];
        setGroups(resources);
      } catch (e) {
        // best-effort
      }
    })();
  }, []);

  // Load selected user's groups
  useEffect(() => {
    if (!selectedUserId) {
      setUserGroups([]);
      return;
    }
    (async () => {
      try {
        const resp = await apiClient.get(`/greenlake/scim/users/${selectedUserId}/groups`);
        const resources = resp.data?.Resources || resp.data?.items || [];
        setUserGroups(resources);
      } catch (e) {
        setUserGroups([]);
      }
    })();
  }, [selectedUserId]);

  const addRole = async () => {
    if (!selectedUserId || !roleToAdd) return;
    try {
      // SCIM PATCH add member
      const payload = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [
          {
            op: 'add',
            path: 'members',
            value: [{ value: selectedUserId }],
          },
        ],
      };
      await apiClient.patch(`/greenlake/scim/groups/${roleToAdd}`, payload);
      // refresh memberships
      const resp = await apiClient.get(`/greenlake/scim/users/${selectedUserId}/groups`);
      setUserGroups(resp.data?.Resources || []);
      setRoleToAdd('');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add role');
    }
  };

  const removeRole = async (groupId) => {
    if (!selectedUserId || !groupId) return;
    try {
      const payload = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [
          {
            op: 'remove',
            path: `members[value eq "${selectedUserId}"]`,
          },
        ],
      };
      await apiClient.patch(`/greenlake/scim/groups/${groupId}`, payload);
      const resp = await apiClient.get(`/greenlake/scim/users/${selectedUserId}/groups`);
      setUserGroups(resp.data?.Resources || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to remove role');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            GL Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Users from HPE GreenLake Identity
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search by email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchUsers())}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" onClick={() => setInviteOpen(true)}>Invite User</Button>
          <Button variant="outlined" onClick={exportCsv}>Export CSV</Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {/* Roles (Groups) Management */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Roles</Typography>
            <TextField
              select
              size="small"
              label="Add to role"
              sx={{ minWidth: 260 }}
              value={roleToAdd}
              onChange={(e) => setRoleToAdd(e.target.value)}
              disabled={!selectedUserId}
            >
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>{g.displayName || g.id}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={addRole} disabled={!selectedUserId || !roleToAdd}>Add Role</Button>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {userGroups.map((g) => (
                <Button key={g.id} size="small" variant="outlined" color="inherit" onClick={() => removeRole(g.id)}>
                  {g.displayName || g.id} ✕
                </Button>
              ))}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              select
              label="Select User"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              size="small"
              sx={{ minWidth: 260 }}
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.username}</MenuItem>
              ))}
            </TextField>
            <TextField label="Given Name" size="small" value={updateGiven} onChange={(e)=>setUpdateGiven(e.target.value)} />
            <TextField label="Family Name" size="small" value={updateFamily} onChange={(e)=>setUpdateFamily(e.target.value)} />
            <TextField label="Display Name" size="small" value={updateDisplay} onChange={(e)=>setUpdateDisplay(e.target.value)} />
            <Button variant="outlined" onClick={updateUser} disabled={!selectedUserId}>Update</Button>
            <Button variant="outlined" color="error" onClick={deleteUser} disabled={!selectedUserId}>Delete</Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell onClick={()=>handleSort('username')} sx={{ cursor: 'pointer' }}>
                    Email {sortBy==='username' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </TableCell>
                  <TableCell onClick={()=>handleSort('status')} sx={{ cursor: 'pointer' }}>
                    Status {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </TableCell>
                  <TableCell onClick={()=>handleSort('firstName')} sx={{ cursor: 'pointer' }}>
                    First Name {sortBy==='firstName' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </TableCell>
                  <TableCell onClick={()=>handleSort('lastName')} sx={{ cursor: 'pointer' }}>
                    Last Name {sortBy==='lastName' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </TableCell>
                  <TableCell onClick={()=>handleSort('lastLogin')} sx={{ cursor: 'pointer' }}>
                    Last Login {sortBy==='lastLogin' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </TableCell>
                  <TableCell onClick={()=>handleSort('createdAt')} sx={{ cursor: 'pointer' }}>
                    Created {sortBy==='createdAt' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.userName || u.username}</TableCell>
                    <TableCell>{u['urn:ietf:params:scim:schemas:extensions:hpe-greenlake:2.0:User']?.status || '-'}</TableCell>
                    <TableCell>{u.name?.givenName || '-'}</TableCell>
                    <TableCell>{u.name?.familyName || '-'}</TableCell>
                    <TableCell>{u.meta?.lastLogin || '-'}</TableCell>
                    <TableCell>{u.meta?.created || '-'}</TableCell>
                  </TableRow>
                ))}
                {!loading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No users found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Pagination
              count={Math.max(1, Math.ceil(total / limit))}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={newGroupOpen} onClose={() => setNewGroupOpen(false)}>
        <DialogTitle>Create Role (Group)</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Name"
            fullWidth
            variant="standard"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewGroupOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              const payload = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                displayName: newGroupName,
              };
              await apiClient.post('/greenlake/scim/groups', payload);
              setNewGroupOpen(false);
              setNewGroupName('');
              const resp = await apiClient.get('/greenlake/scim/groups', { params: { count: 200 } });
              setGroups(resp.data?.Resources || []);
            } catch (e) {
              setError(e.response?.data?.error || 'Failed to create group');
            }
          }} disabled={!newGroupName}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Rename/Delete/Clone Group Dialog */}
      <Dialog open={renameGroupOpen} onClose={() => setRenameGroupOpen(false)}>
        <DialogTitle>Manage Role (Group)</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, mt: 1 }}>
          <TextField
            select
            label="Select Group"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>{g.displayName || g.id}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="New Name"
            value={renameGroupName}
            onChange={(e) => setRenameGroupName(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary">
            Use "Clone" to duplicate a role with the same members.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameGroupOpen(false)}>Close</Button>
          <Button color="error" onClick={async () => {
            if (!selectedGroupId) return;
            try {
              await apiClient.delete(`/greenlake/scim/groups/${selectedGroupId}`);
              setSelectedGroupId('');
              const resp = await apiClient.get('/greenlake/scim/groups', { params: { count: 200 } });
              setGroups(resp.data?.Resources || []);
            } catch (e) {
              setError(e.response?.data?.error || 'Failed to delete group');
            }
          }} disabled={!selectedGroupId}>Delete</Button>
          <Button onClick={async () => {
            if (!selectedGroupId || !renameGroupName) return;
            try {
              const payload = { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'displayName', value: renameGroupName }] };
              await apiClient.patch(`/greenlake/scim/groups/${selectedGroupId}`, payload);
              setRenameGroupName('');
              const resp = await apiClient.get('/greenlake/scim/groups', { params: { count: 200 } });
              setGroups(resp.data?.Resources || []);
            } catch (e) {
              setError(e.response?.data?.error || 'Failed to rename group');
            }
          }} disabled={!selectedGroupId || !renameGroupName}>Rename</Button>
          <Button onClick={async () => {
            if (!selectedGroupId || !renameGroupName) return;
            try {
              // Get source group (for members)
              const src = await apiClient.get(`/greenlake/scim/groups/${selectedGroupId}`);
              const members = src.data?.members || [];
              // Create new group
              const created = await apiClient.post('/greenlake/scim/groups', {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                displayName: renameGroupName
              });
              const newGroupId = created.data?.id;
              // Copy members
              if (newGroupId && Array.isArray(members) && members.length) {
                await apiClient.patch(`/greenlake/scim/groups/${newGroupId}`, {
                  schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                  Operations: [{
                    op: 'add',
                    path: 'members',
                    value: members.map(m => ({ value: m.value }))
                  }]
                });
              }
              setRenameGroupName('');
              const resp = await apiClient.get('/greenlake/scim/groups', { params: { count: 200 } });
              setGroups(resp.data?.Resources || []);
            } catch (e) {
              setError(e.response?.data?.error || 'Failed to clone group');
            }
          }} disabled={!selectedGroupId || !renameGroupName}>Clone</Button>
        </DialogActions>
      </Dialog>

      {/* Quick actions for Groups */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="outlined" onClick={() => setNewGroupOpen(true)}>Create Role</Button>
        <Button variant="outlined" onClick={() => setRenameGroupOpen(true)}>Manage Roles</Button>
      </Box>
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <DialogTitle>Invite User</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            variant="standard"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button onClick={inviteUser} disabled={!inviteEmail}>Send Invite</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UsersPage;
