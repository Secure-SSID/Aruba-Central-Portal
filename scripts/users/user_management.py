#!/usr/bin/env python3
"""User Management - View and manage users, roles, and permissions in Aruba Central."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
import json

console = Console()


def display_users(client):
    """Display all users with their roles and permissions."""
    console.print(Panel.fit("[bold cyan]User Management - Users & Roles[/bold cyan]", border_style="cyan"))
    console.print()

    try:
        # Get all users
        users_response = client.get("/platform/rbac/v1/users")

        if not users_response or 'items' not in users_response:
            console.print("[red]Failed to retrieve users[/red]")
            return

        users = users_response['items']
        total = users_response.get('total', len(users))

        console.print(f"[bold]Total Users:[/bold] [green]{total}[/green]\n")

        # Detailed user table
        table = Table(title=f"User Details ({len(users)} users)", show_lines=True)
        table.add_column("Name", style="cyan", no_wrap=True)
        table.add_column("Username", style="yellow")
        table.add_column("Email", style="green")
        table.add_column("Role", style="magenta")
        table.add_column("Scope", style="blue")
        table.add_column("System User", style="white")

        for user in users:
            # Parse name
            name_obj = user.get('name', {})
            full_name = f"{name_obj.get('firstname', '')} {name_obj.get('lastname', '')}".strip()
            if not full_name:
                full_name = "N/A"

            username = user.get('username', 'N/A')
            email = user.get('email', 'N/A')
            system_user = "Yes" if user.get('system_user', False) else "No"

            # Parse applications and roles
            apps = user.get('applications', [])

            if not apps:
                table.add_row(full_name, username, email, "No roles", "-", system_user)
            else:
                first_app = True
                for app in apps:
                    app_name = app.get('name', 'Unknown')
                    info_list = app.get('info', [])

                    if not info_list:
                        if first_app:
                            table.add_row(full_name, username, email, f"App: {app_name}", "-", system_user)
                            first_app = False
                        else:
                            table.add_row("", "", "", f"App: {app_name}", "-", "")
                    else:
                        for info in info_list:
                            role = info.get('role', 'N/A')
                            tenant_role = info.get('tenant_role', 'N/A')
                            scope = info.get('scope', {})

                            # Format scope
                            scope_parts = []
                            if scope.get('groups'):
                                groups = scope['groups']
                                if 'allgroups' in groups:
                                    scope_parts.append("All Groups")
                                else:
                                    scope_parts.append(f"Groups: {len(groups)}")
                            if scope.get('sites'):
                                sites = scope['sites']
                                if 'allsites' in sites:
                                    scope_parts.append("All Sites")
                                else:
                                    scope_parts.append(f"Sites: {len(sites)}")
                            if scope.get('labels'):
                                labels = scope['labels']
                                if 'alllabels' in labels:
                                    scope_parts.append("All Labels")
                                else:
                                    scope_parts.append(f"Labels: {len(labels)}")

                            scope_str = ", ".join(scope_parts) if scope_parts else "Limited"

                            if first_app:
                                table.add_row(
                                    full_name,
                                    username,
                                    email,
                                    f"{role}\n({app_name})",
                                    scope_str,
                                    system_user
                                )
                                first_app = False
                            else:
                                table.add_row(
                                    "",
                                    "",
                                    "",
                                    f"{role}\n({app_name})",
                                    scope_str,
                                    ""
                                )

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error fetching users: {e}[/red]")
        import traceback
        traceback.print_exc()


def display_roles(client):
    """Display available roles and their permissions."""
    console.print("\n")
    console.print(Panel.fit("[bold cyan]Available Roles[/bold cyan]", border_style="cyan"))
    console.print()

    try:
        # Try to get roles
        roles_response = client.get("/platform/rbac/v1/roles")

        if roles_response and 'roles' in roles_response:
            roles = roles_response['roles']

            table = Table(title="System Roles")
            table.add_column("Role Name", style="cyan")
            table.add_column("Description", style="yellow")
            table.add_column("Permissions", style="green")

            for role in roles:
                role_name = role.get('rolename', 'N/A')
                description = role.get('description', 'N/A')
                permissions = role.get('permissions', [])
                perm_str = f"{len(permissions)} permissions" if permissions else "N/A"

                table.add_row(role_name, description, perm_str)

            console.print(table)
        else:
            console.print("[yellow]Could not retrieve roles (endpoint may not be available)[/yellow]")

    except Exception as e:
        console.print(f"[yellow]Roles endpoint not accessible: {str(e)[:100]}[/yellow]")


def display_user_detail(client, username):
    """Display detailed information about a specific user."""
    console.print(Panel.fit(f"[bold cyan]User Detail: {username}[/bold cyan]", border_style="cyan"))
    console.print()

    try:
        # Get user detail
        user_response = client.get(f"/platform/rbac/v1/users/{username}")

        if not user_response:
            console.print(f"[red]User '{username}' not found[/red]")
            return

        # Display user info
        name_obj = user_response.get('name', {})
        full_name = f"{name_obj.get('firstname', '')} {name_obj.get('lastname', '')}".strip()

        console.print(f"[bold]Name:[/bold] {full_name}")
        console.print(f"[bold]Username:[/bold] {user_response.get('username', 'N/A')}")
        console.print(f"[bold]Email:[/bold] {user_response.get('email', 'N/A')}")
        console.print(f"[bold]System User:[/bold] {user_response.get('system_user', False)}")
        console.print()

        # Display applications and roles
        apps = user_response.get('applications', [])
        if apps:
            console.print("[bold]Applications & Roles:[/bold]")

            for app in apps:
                tree = Tree(f"[cyan]{app.get('name', 'Unknown')}[/cyan]")

                info_list = app.get('info', [])
                for info in info_list:
                    role_branch = tree.add(f"[yellow]Role:[/yellow] {info.get('role', 'N/A')}")
                    role_branch.add(f"[yellow]Tenant Role:[/yellow] {info.get('tenant_role', 'N/A')}")

                    scope = info.get('scope', {})
                    scope_branch = role_branch.add("[blue]Scope:[/blue]")

                    if scope.get('groups'):
                        scope_branch.add(f"Groups: {', '.join(scope['groups'])}")
                    if scope.get('sites'):
                        scope_branch.add(f"Sites: {', '.join(scope['sites'])}")
                    if scope.get('labels'):
                        scope_branch.add(f"Labels: {', '.join(scope['labels'])}")

                console.print(tree)

    except Exception as e:
        console.print(f"[red]Error fetching user detail: {e}[/red]")


def interactive_menu(client):
    """Interactive menu for user management."""
    while True:
        console.print("\n")
        console.print(Panel.fit(
            "[bold cyan]User Management Menu[/bold cyan]\n\n"
            "[1] View All Users\n"
            "[2] View User Detail\n"
            "[3] View Available Roles\n"
            "[4] Export Users to JSON\n"
            "[5] Exit",
            border_style="cyan"
        ))

        choice = input("\nEnter choice (1-5): ").strip()

        if choice == "1":
            console.print("\n")
            display_users(client)
        elif choice == "2":
            username = input("Enter username: ").strip()
            if username:
                console.print("\n")
                display_user_detail(client, username)
        elif choice == "3":
            display_roles(client)
        elif choice == "4":
            try:
                users_response = client.get("/platform/rbac/v1/users")
                with open("users_export.json", "w") as f:
                    json.dump(users_response, f, indent=2)
                console.print("[green]✓ Users exported to users_export.json[/green]")
            except Exception as e:
                console.print(f"[red]Error exporting users: {e}[/red]")
        elif choice == "5":
            console.print("[cyan]Goodbye![/cyan]")
            break
        else:
            console.print("[red]Invalid choice[/red]")


def main():
    """Main function."""
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

    # Check if running with arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--list":
            display_users(client)
        elif sys.argv[1] == "--roles":
            display_roles(client)
        elif sys.argv[1] == "--user" and len(sys.argv) > 2:
            display_user_detail(client, sys.argv[2])
        else:
            console.print("[red]Invalid arguments[/red]")
            console.print("Usage: python user_management.py [--list | --roles | --user <username>]")
    else:
        # Interactive mode
        interactive_menu(client)


if __name__ == "__main__":
    main()
