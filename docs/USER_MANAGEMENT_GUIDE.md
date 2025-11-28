# User Management Guide

## Overview

The User Management script provides comprehensive tools for viewing and managing users, roles, and permissions in your Aruba Central MSP environment.

## Usage

### Command Line Mode

#### List All Users
```bash
python3 scripts/users/user_management.py --list
```

Displays a detailed table of all users including:
- Full name
- Username
- Email address
- Assigned roles (with application context)
- Permission scopes (groups, sites, labels)
- System user status

#### View Specific User Details
```bash
python3 scripts/users/user_management.py --user <username>
```

Example:
```bash
python3 scripts/users/user_management.py --user user@example.com
```

Shows detailed information with a tree view of:
- User profile information
- All applications the user has access to
- Roles within each application
- Detailed scope breakdown

#### View Available Roles
```bash
python3 scripts/users/user_management.py --roles
```

Attempts to retrieve system roles (may not be available in all API versions).

### Interactive Mode

Run without arguments for interactive menu:
```bash
python3 scripts/users/user_management.py
```

**Interactive Menu Options:**
1. **View All Users** - Display comprehensive user list
2. **View User Detail** - Search and view specific user
3. **View Available Roles** - List system roles
4. **Export Users to JSON** - Save user data to `users_export.json`
5. **Exit** - Close the program

## Understanding the Output

### User Table Columns

| Column | Description |
|--------|-------------|
| **Name** | User's first and last name |
| **Username** | Login username (often email address) |
| **Email** | User's email address |
| **Role** | Primary role with application context in parentheses |
| **Scope** | Permission scope (groups, sites, labels) |
| **System User** | Whether user is a system account |

### Role Display Format

Roles are shown as:
```
Aruba Central Administrator
(nms)
```

Where:
- First line: Role name
- Parentheses: Application (nms = Network Management System)

### Scope Indicators

- **All Groups**: User has access to all device groups
- **All Sites**: User has access to all physical sites
- **All Labels**: User has access to all device labels
- **Groups: N**: User has access to N specific groups
- **Limited**: User has restricted scope

## Current Environment Summary

Your Aruba Central instance currently has:

**Total Users**: 13

**User Breakdown**:
- **12 Full Administrators**: Complete access to NMS and workspace settings
- **1 API Service Account**: Workspace administrator only (`api@example.com`)
- **1 User Without Roles**: No active permissions

**Common Administrator Profile**:
- Role 1: **Aruba Central Administrator** (nms)
  - Scope: All groups, All sites, All labels
- Role 2: **Workspace Administrator** (account_setting)
  - Scope: All groups

## Exporting User Data

To export all user data to JSON:
```bash
# Interactive mode - choose option 4
./venv/bin/python scripts/users/user_management.py

# Or use Python API directly:
./venv/bin/python -c "
from utils import CentralAPIClient, TokenManager, load_config
import json
config = load_config()
aruba_config = config['aruba_central']
token_manager = TokenManager(aruba_config['client_id'], aruba_config['client_secret'])
client = CentralAPIClient(aruba_config['base_url'], token_manager)
users = client.get('/platform/rbac/v1/users')
with open('users_export.json', 'w') as f:
    json.dump(users, f, indent=2)
print('Exported!')
"
```

Output file: `users_export.json`

## Programmatic Usage

### Python Script Example

```python
from utils import CentralAPIClient, TokenManager, load_config

# Initialize client
config = load_config()
aruba_config = config["aruba_central"]
token_manager = TokenManager(aruba_config["client_id"], aruba_config["client_secret"])
client = CentralAPIClient(aruba_config["base_url"], token_manager)

# Get all users
users = client.get("/platform/rbac/v1/users")
for user in users['items']:
    name = user.get('name', {})
    print(f"{name.get('firstname')} {name.get('lastname')}")

# Get specific user
user_detail = client.get("/platform/rbac/v1/users/user@example.com")
print(user_detail)
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/platform/rbac/v1/users` | GET | List all users |
| `/platform/rbac/v1/users/{username}` | GET | Get user details |
| `/platform/rbac/v1/roles` | GET | List available roles (may not be available) |

## Troubleshooting

### "403 Forbidden" Error
- Your API credentials don't have permission to access user management
- Contact your Aruba Central administrator

### "404 Not Found" Error
- Endpoint may not be available in your API version
- Try using `/platform/rbac/v1/users` instead

### Empty User List
- Verify authentication is successful
- Check that you're querying the correct customer_id
- Ensure MSP mode is properly configured

## Security Considerations

⚠️ **Important**: User management data contains sensitive information:
- Never commit `users_export.json` to git
- Protect exported files with appropriate permissions
- Regularly audit who has administrator access
- Use service accounts for API automation

## Next Steps

After viewing users, you might want to:
1. **Audit Permissions**: Review who has admin access
2. **Create Service Accounts**: Separate API users from human users
3. **Implement Least Privilege**: Reduce overly broad permissions
4. **Monitor Changes**: Track user additions/modifications
5. **Automate Reports**: Schedule regular user access reports

## Related Documentation

- [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) - Detailed role descriptions
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [README.md](../README.md) - Project overview
