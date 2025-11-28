#!/usr/bin/env python3
"""Export users to CSV format."""

import sys
import csv
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console

console = Console()


def export_users_to_csv(output_file="users_export.csv"):
    """Export all users to CSV file."""
    console.print("[bold blue]Exporting Users to CSV[/bold blue]\n")

    # Load configuration
    config = load_config()
    aruba_config = config["aruba_central"]

    # Initialize token manager and client
    token_manager = TokenManager(
        client_id=aruba_config["client_id"],
        client_secret=aruba_config["client_secret"],
    )
    client = CentralAPIClient(
        base_url=aruba_config["base_url"],
        token_manager=token_manager,
    )

    try:
        # Get all users
        console.print("Fetching users from Aruba Central...")
        users_response = client.get("/platform/rbac/v1/users")

        if not users_response or 'items' not in users_response:
            console.print("[red]Failed to retrieve users[/red]")
            return

        users = users_response['items']
        console.print(f"[green]Found {len(users)} users[/green]\n")

        # Prepare CSV data
        csv_data = []

        for user in users:
            # Parse name
            name_obj = user.get('name', {})
            first_name = name_obj.get('firstname', '')
            last_name = name_obj.get('lastname', '')
            full_name = f"{first_name} {last_name}".strip()

            username = user.get('username', '')
            email = user.get('email', '')
            system_user = 'Yes' if user.get('system_user', False) else 'No'

            # Parse applications and roles
            apps = user.get('applications', [])

            if not apps:
                # User with no roles
                csv_data.append({
                    'First Name': first_name,
                    'Last Name': last_name,
                    'Full Name': full_name,
                    'Username': username,
                    'Email': email,
                    'Application': '',
                    'Role': 'No roles',
                    'Tenant Role': '',
                    'Groups': '',
                    'Sites': '',
                    'Labels': '',
                    'System User': system_user
                })
            else:
                # User with roles - create row for each app/role combination
                for app in apps:
                    app_name = app.get('name', '')
                    info_list = app.get('info', [])

                    if not info_list:
                        csv_data.append({
                            'First Name': first_name,
                            'Last Name': last_name,
                            'Full Name': full_name,
                            'Username': username,
                            'Email': email,
                            'Application': app_name,
                            'Role': '',
                            'Tenant Role': '',
                            'Groups': '',
                            'Sites': '',
                            'Labels': '',
                            'System User': system_user
                        })
                    else:
                        for info in info_list:
                            role = info.get('role', '')
                            tenant_role = info.get('tenant_role', '')
                            scope = info.get('scope', {})

                            # Format scope
                            groups = ', '.join(scope.get('groups', []))
                            sites = ', '.join(scope.get('sites', []))
                            labels = ', '.join(scope.get('labels', []))

                            csv_data.append({
                                'First Name': first_name,
                                'Last Name': last_name,
                                'Full Name': full_name,
                                'Username': username,
                                'Email': email,
                                'Application': app_name,
                                'Role': role,
                                'Tenant Role': tenant_role,
                                'Groups': groups,
                                'Sites': sites,
                                'Labels': labels,
                                'System User': system_user
                            })

        # Write to CSV
        console.print(f"Writing to {output_file}...")
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'First Name', 'Last Name', 'Full Name', 'Username', 'Email',
                'Application', 'Role', 'Tenant Role',
                'Groups', 'Sites', 'Labels', 'System User'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            writer.writerows(csv_data)

        console.print(f"[green]✓ Successfully exported {len(csv_data)} rows to {output_file}[/green]")
        console.print(f"\nFile size: {Path(output_file).stat().st_size} bytes")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Main function."""
    output_file = "users_export.csv"

    if len(sys.argv) > 1:
        output_file = sys.argv[1]

    export_users_to_csv(output_file)


if __name__ == "__main__":
    main()
