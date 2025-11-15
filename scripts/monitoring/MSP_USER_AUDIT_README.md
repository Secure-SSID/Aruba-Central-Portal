# MSP User Audit Script

## Overview

`msp_user_audit.py` is a comprehensive script for auditing user management and permissions across all MSP tenant/customer accounts in Aruba Central.

## Features

- **Customer Account Discovery**: Automatically retrieves all MSP tenant/customer accounts
- **User Enumeration**: Lists all users associated with each tenant
- **Permission Auditing**: Displays user roles and permissions for each tenant
- **Rich Formatted Output**: Uses tables and formatted console output for easy reading
- **Error Handling**: Gracefully handles API errors and continues processing remaining tenants

## Requirements

- Python 3.9+
- Valid Aruba Central MSP credentials configured in `.env`
- MSP-level access token (the API client must have MSP administrator privileges)

## Usage

### Basic Usage

```bash
python scripts/monitoring/msp_user_audit.py
```

### Expected Output

The script produces three main sections:

1. **Customer Summary Table**: Lists all tenant accounts with their IDs, names, descriptions, and provisioning status

2. **User Details Per Customer**: For each tenant, displays:
   - Username
   - Email address
   - Account status
   - MSP role (e.g., "admin", "readonly")
   - Tenant role (e.g., "admin", "readonly", "custom_role")

3. **Completion Status**: Confirms successful audit completion

### Sample Output

```
╭────────────────────────────────────────────────────╮
│ Aruba Central MSP User Management Audit           │
╰────────────────────────────────────────────────────╯

Authenticating with Aruba Central...
✓ Authentication successful!

Fetching customer/tenant accounts...

╭─────────────────────── MSP Customer/Tenant Accounts ───────────────────────╮
│ Customer ID  │ Customer Name     │ Description        │ Status              │
├──────────────┼───────────────────┼────────────────────┼─────────────────────┤
│ CUST001      │ Acme Corp         │ Main customer      │ provisioned         │
│ CUST002      │ Widget Inc        │ Secondary customer │ provisioned         │
╰──────────────────────────────────────────────────────────────────────────────╯

Total Customers: 2

Fetching user details for each customer...

Processing: Acme Corp (ID: CUST001)

╭─────────────────── Users for Acme Corp ───────────────────╮
│ Username    │ Email              │ Status │ MSP Role │ Tenant Role │
├─────────────┼────────────────────┼────────┼──────────┼─────────────┤
│ user1       │ user1@acme.com     │ active │ admin    │ admin       │
│ user2       │ user2@acme.com     │ active │ readonly │ readonly    │
╰───────────────────────────────────────────────────────────────────────╯

✓ Audit complete!
```

## API Endpoints Used

The script uses the following Aruba Central API endpoints:

1. **List Customers**: `GET /msp_api/v1/customers`
   - Retrieves all MSP customer/tenant accounts
   - Supports pagination with `limit` and `offset` parameters

2. **List Users**: `GET /platform/rbac/v1/users`
   - Retrieves users for a specific customer
   - Requires `customer_id` parameter

3. **Get User Details**: `GET /platform/rbac/v1/users/{username}`
   - Retrieves detailed role and permission information for a specific user
   - Requires `customer_id` parameter

## Configuration

Ensure your `.env` file contains MSP-level credentials:

```bash
ARUBA_BASE_URL=https://apigw-prod2.central.arubanetworks.com
ARUBA_CLIENT_ID=your_msp_client_id
ARUBA_CLIENT_SECRET=your_msp_client_secret
ARUBA_CUSTOMER_ID=your_msp_customer_id
```

**Important**: The credentials must have MSP administrator access to query tenant information and users.

## Understanding User Roles

### MSP Roles
- **admin**: Full administrative access to MSP functions and all tenants
- **readonly**: Read-only access to MSP functions and tenant data
- **custom roles**: Organization-specific roles with defined permissions

### Tenant Roles
- **admin**: Full administrative access to the tenant account
- **readonly**: Read-only access to tenant resources
- **network_operations**: Access to network operations features
- **guest_operations**: Access to guest network management
- **custom roles**: Tenant-specific custom roles

## Troubleshooting

### Common Issues

**Error: "401 Unauthorized"**
- Verify your credentials in `.env` are correct
- Ensure the API client has MSP administrator privileges
- Check that the access token hasn't expired

**Error: "403 Forbidden"**
- The API client doesn't have sufficient MSP permissions
- Contact your Aruba Central administrator to grant MSP access

**Warning: "Could not fetch users for customer X"**
- The customer account may not have RBAC configured
- The customer account may not be fully provisioned
- Network connectivity issues

**No customers found**
- Verify you're using MSP-level credentials
- Check that you have tenant accounts created in Aruba Central
- Ensure the API client has the correct permissions

## Customization

### Changing Output Format

The script includes two display options:

1. **Table Format** (default): Clean, compact view suitable for many users
   ```python
   display_user_table(customer_name, users, user_roles)
   ```

2. **Tree Format**: Hierarchical view showing detailed role breakdown
   ```python
   display_user_details(customer_name, users, user_roles)
   ```

To switch formats, comment/uncomment the appropriate function call in the `main()` function.

### Adjusting Pagination

To change the number of customers fetched per API call:

```python
customers = get_all_customers(client, limit=200)  # Default is 100
```

### Filtering Customers

To audit specific customers only, add filtering logic:

```python
customers = get_all_customers(client)
# Filter for specific customer names
customers = [c for c in customers if c.get("customer_name") in ["Acme Corp", "Widget Inc"]]
```

## Export Options

To export results to a file, you can redirect output:

```bash
python scripts/monitoring/msp_user_audit.py > user_audit_$(date +%Y%m%d).txt
```

For structured data export (JSON/CSV), you can modify the script to use Python's `json` or `csv` modules.

## Security Considerations

- Never share audit output containing usernames and email addresses publicly
- Store audit reports securely with appropriate access controls
- Rotate MSP API credentials regularly
- Review user permissions periodically and remove unnecessary access
- Audit logs should be retained according to your organization's compliance requirements

## Related Scripts

- `scripts/example_script.py`: Basic API usage example
- Other monitoring scripts in `scripts/monitoring/`

## Support

For issues with the script, check:
1. [Aruba Central API Documentation](https://developer.arubanetworks.com/aruba-central/docs)
2. Project README.md
3. CLAUDE.md for development guidelines
