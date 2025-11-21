# Aruba Central - Roles and Permissions

## Discovered Roles

Based on the current user configuration in your Aruba Central MSP instance:

### 1. Aruba Central Administrator
- **Application**: `nms` (Network Management System)
- **Full Access**: Complete administrative control
- **Scope Options**:
  - `allgroups`: Access to all device groups
  - `allsites`: Access to all sites
  - `alllabels`: Access to all labels

**Capabilities**:
- Full network management
- Device configuration and monitoring
- User management
- System configuration

### 2. Workspace Administrator
- **Application**: `account_setting`
- **Focus**: Account and workspace management
- **Scope Options**:
  - `allgroups`: Access to all groups

**Capabilities**:
- Account settings management
- Workspace configuration
- User and role assignments (within workspace context)

## Permission Scopes

### Group Scope
- `allgroups`: Access to all device groups in the tenant
- `[specific groups]`: Limited to specified group IDs

### Site Scope
- `allsites`: Access to all physical sites
- `[specific sites]`: Limited to specified site IDs

### Label Scope
- `alllabels`: Access to all device labels
- `[specific labels]`: Limited to specified label IDs

## MSP Mode Considerations

In MSP (Managed Service Provider) mode:
- Each tenant has isolated users and permissions
- MSP administrator can manage multiple tenants
- Roles are tenant-specific
- API authentication requires customer_id for tenant context

## Common Role Patterns

### Full Administrator
```json
{
  "applications": [
    {
      "name": "nms",
      "info": [{
        "role": "Aruba Central Administrator",
        "scope": {
          "groups": ["allgroups"],
          "sites": ["allsites"],
          "labels": ["alllabels"]
        }
      }]
    },
    {
      "name": "account_setting",
      "info": [{
        "role": "Workspace Administrator",
        "scope": {
          "groups": ["allgroups"]
        }
      }]
    }
  ]
}
```

### Limited Access User (Example)
```json
{
  "applications": [
    {
      "name": "nms",
      "info": [{
        "role": "Network Operations",
        "scope": {
          "groups": ["group1", "group2"],
          "sites": ["site1"],
          "labels": []
        }
      }]
    }
  ]
}
```

## User Management API Endpoints

### List Users
- **Endpoint**: `GET /platform/rbac/v1/users`
- **Returns**: All users with roles and permissions
- **Pagination**: Use `limit` and `offset` parameters

### Get User Detail
- **Endpoint**: `GET /platform/rbac/v1/users/{username}`
- **Returns**: Detailed user information with applications and scopes

### Create User (Example)
- **Endpoint**: `POST /platform/rbac/v1/users`
- **Body**: User object with name, email, username, applications, roles

### Update User
- **Endpoint**: `PATCH /platform/rbac/v1/users/{username}`
- **Body**: Updated user properties

### Delete User
- **Endpoint**: `DELETE /platform/rbac/v1/users/{username}`

## Security Best Practices

1. **Principle of Least Privilege**: Assign minimal required permissions
2. **Use Service Accounts**: Create dedicated API users (like `api@example.com`)
3. **Scope Restrictions**: Limit access to specific groups/sites when possible
4. **Regular Audits**: Review user permissions periodically
5. **Separate Roles**: Don't grant both nms and account_setting admin unless necessary

## Example Users Summary

A typical instance might have:
- Multiple users with full Aruba Central Administrator + Workspace Administrator roles
- Some users with no assigned roles
- Service accounts with Workspace Administrator only

All active administrators have:
- Full access to all groups, sites, and labels
- Both NMS and account_setting application access
- System user designation
