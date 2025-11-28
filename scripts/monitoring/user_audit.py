#!/usr/bin/env python3
"""User Management and Rights Audit Script.

This script checks user management and user rights for Aruba Central accounts.
Works with both regular tenant accounts and MSP accounts.
"""

import sys
from pathlib import Path
from typing import Dict, List, Any

# Add parent directory to path to import utils
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import box
from requests.exceptions import HTTPError

console = Console()


def check_account_type(client: CentralAPIClient) -> str:
    """Determine if this is an MSP account or regular tenant account.

    Args:
        client: Authenticated CentralAPIClient instance

    Returns:
        "msp" if MSP account, "tenant" if regular account
    """
    try:
        # Try MSP endpoint
        client.get("/msp_api/v1/customers", params={"limit": 1})
        return "msp"
    except HTTPError as e:
        if e.response.status_code == 403:
            return "tenant"
        else:
            raise


def get_tenant_users(client: CentralAPIClient) -> List[Dict[str, Any]]:
    """Retrieve all users for the current tenant account.

    Args:
        client: Authenticated CentralAPIClient instance

    Returns:
        List of user dictionaries
    """
    try:
        response = client.get("/platform/rbac/v1/users")
        return response.get("users", [])
    except Exception as e:
        console.print(f"[yellow]Warning: Could not fetch users: {e}[/yellow]")
        return []


def get_user_details(client: CentralAPIClient, username: str) -> Dict[str, Any]:
    """Retrieve detailed information for a specific user.

    Args:
        client: Authenticated CentralAPIClient instance
        username: Username to query

    Returns:
        Dictionary containing user details and roles
    """
    try:
        response = client.get(f"/platform/rbac/v1/users/{username}")
        return response
    except Exception as e:
        console.print(f"[yellow]Warning: Could not fetch details for user {username}: {e}[/yellow]")
        return {}


def display_user_table(users: List[Dict[str, Any]], user_details: Dict[str, Dict[str, Any]]) -> None:
    """Display user information in a table format.

    Args:
        users: List of user dictionaries
        user_details: Dictionary mapping usernames to their detailed information
    """
    table = Table(
        title="User Management Audit",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )

    table.add_column("Username", style="green")
    table.add_column("Email", style="blue")
    table.add_column("Status", style="yellow")
    table.add_column("Roles", style="magenta")
    table.add_column("Applications", style="cyan")

    if not users:
        console.print("[yellow]No users found[/yellow]\n")
        return

    for user in users:
        username = user.get("username", "N/A")
        email = user.get("email", "N/A")
        status = user.get("status", "N/A")

        roles = []
        apps = []

        # Extract role and application information
        if username in user_details:
            details = user_details[username]
            applications = details.get("applications", {})

            for app_name, app_data in applications.items():
                apps.append(app_name)

                if "role" in app_data:
                    roles.append(app_data["role"])
                if "msp_role" in app_data:
                    roles.append(f"MSP: {app_data['msp_role']}")

        roles_str = ", ".join(roles) if roles else "N/A"
        apps_str = ", ".join(apps) if apps else "N/A"

        table.add_row(username, email, status, roles_str, apps_str)

    console.print(table)
    console.print(f"\n[bold]Total Users:[/bold] {len(users)}\n")


def display_user_tree(users: List[Dict[str, Any]], user_details: Dict[str, Dict[str, Any]]) -> None:
    """Display detailed user information in a tree format.

    Args:
        users: List of user dictionaries
        user_details: Dictionary mapping usernames to their detailed information
    """
    tree = Tree("[bold blue]User Management & Permissions[/bold blue]")

    if not users:
        tree.add("[yellow]No users found[/yellow]")
    else:
        for user in users:
            username = user.get("username", "Unknown")
            email = user.get("email", "N/A")
            status = user.get("status", "N/A")

            # Create user branch
            user_branch = tree.add(f"[green]{username}[/green] ({email})")
            user_branch.add(f"Status: {status}")

            # Add detailed information if available
            if username in user_details:
                details = user_details[username]
                applications = details.get("applications", {})

                if applications:
                    roles_branch = user_branch.add("[cyan]Applications & Roles:[/cyan]")

                    for app_name, app_data in applications.items():
                        app_branch = roles_branch.add(f"[yellow]{app_name}[/yellow]")

                        # Add role information
                        if "role" in app_data:
                            app_branch.add(f"Role: {app_data['role']}")

                        if "msp_role" in app_data:
                            app_branch.add(f"MSP Role: {app_data['msp_role']}")

                        # Add group information
                        if "groups" in app_data and app_data["groups"]:
                            groups = app_data["groups"]
                            group_str = ", ".join(groups)
                            app_branch.add(f"Groups: {group_str}")

    console.print(tree)
    console.print(f"\n[bold]Total Users:[/bold] {len(users)}\n")


def main():
    """Main function to audit user management."""
    console.print(Panel.fit(
        "[bold blue]Aruba Central User Management Audit[/bold blue]",
        border_style="blue"
    ))

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
        # No explicit authentication needed - happens automatically on first API call
        # The API client now handles rate limiting and retries automatically
        console.print("\n[bold]Connecting to Aruba Central...[/bold]")

        # Check account type (authentication happens automatically here)
        console.print("[bold]Checking account type...[/bold]")
        account_type = check_account_type(client)
        console.print("[green]✓ Connected successfully![/green]\n")

        if account_type == "msp":
            console.print("[cyan]✓ MSP account detected[/cyan]")
            console.print("[yellow]Please use msp_user_audit.py for MSP account auditing[/yellow]\n")
            sys.exit(0)
        else:
            console.print("[cyan]✓ Regular tenant account detected[/cyan]\n")

        # Get all users for this tenant
        console.print("[bold]Fetching users...[/bold]")
        users = get_tenant_users(client)

        if not users:
            console.print("[yellow]No users found.[/yellow]")
            return

        console.print(f"[green]✓ Found {len(users)} users[/green]\n")

        # Get detailed information for each user
        console.print("[bold]Fetching detailed user information...[/bold]")
        user_details = {}
        for user in users:
            username = user.get("username")
            if username:
                details = get_user_details(client, username)
                user_details[username] = details

        console.print(f"[green]✓ Retrieved details for {len(user_details)} users[/green]\n")

        # Display results (table format by default)
        display_user_table(users, user_details)

        # Optionally, uncomment below to use tree format instead
        # display_user_tree(users, user_details)

        console.print("[green]✓ Audit complete![/green]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        import traceback
        console.print(f"[red]{traceback.format_exc()}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
