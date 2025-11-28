#!/usr/bin/env python3
"""MSP User Management and Rights Audit Script.

This script checks user management and user rights across all MSP tenant accounts
in Aruba Central. It retrieves:
- List of all tenant/customer accounts
- Users associated with each tenant
- User roles and permissions for each tenant
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


def get_all_customers(client: CentralAPIClient, limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieve all MSP customer/tenant accounts.

    Args:
        client: Authenticated CentralAPIClient instance
        limit: Maximum number of customers per API call

    Returns:
        List of customer dictionaries
    """
    customers = []
    offset = 0

    while True:
        try:
            response = client.get(
                "/msp_api/v1/customers",
                params={"limit": limit, "offset": offset}
            )

            customer_list = response.get("customers", [])
            if not customer_list:
                break

            customers.extend(customer_list)

            # Check if there are more customers to fetch
            total = response.get("total", 0)
            offset += limit
            if offset >= total:
                break

        except Exception as e:
            console.print(f"[red]Error fetching customers at offset {offset}: {e}[/red]")
            break

    return customers


def get_customer_users(client: CentralAPIClient, customer_id: str) -> List[Dict[str, Any]]:
    """Retrieve all users for a specific customer/tenant.

    Args:
        client: Authenticated CentralAPIClient instance
        customer_id: Customer ID to query

    Returns:
        List of user dictionaries
    """
    try:
        # MSP endpoint to get users for a specific customer
        response = client.get(f"/platform/rbac/v1/users", params={"customer_id": customer_id})
        return response.get("users", [])
    except Exception as e:
        console.print(f"[yellow]Warning: Could not fetch users for customer {customer_id}: {e}[/yellow]")
        return []


def get_user_roles(client: CentralAPIClient, customer_id: str, username: str) -> Dict[str, Any]:
    """Retrieve role information for a specific user.

    Args:
        client: Authenticated CentralAPIClient instance
        customer_id: Customer ID
        username: Username to query

    Returns:
        Dictionary containing role information
    """
    try:
        response = client.get(
            f"/platform/rbac/v1/users/{username}",
            params={"customer_id": customer_id}
        )
        return response
    except Exception as e:
        console.print(f"[yellow]Warning: Could not fetch roles for user {username}: {e}[/yellow]")
        return {}


def display_customer_summary(customers: List[Dict[str, Any]]) -> None:
    """Display a summary table of all customers.

    Args:
        customers: List of customer dictionaries
    """
    table = Table(
        title="MSP Customer/Tenant Accounts",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )

    table.add_column("Customer ID", style="green")
    table.add_column("Customer Name", style="blue")
    table.add_column("Description", style="white")
    table.add_column("Status", style="yellow")

    for customer in customers:
        table.add_row(
            customer.get("customer_id", "N/A"),
            customer.get("customer_name", "N/A"),
            customer.get("description", "N/A"),
            customer.get("provisioning_status", "N/A")
        )

    console.print(table)
    console.print(f"\n[bold]Total Customers:[/bold] {len(customers)}\n")


def display_user_details(customer_name: str, users: List[Dict[str, Any]],
                        user_roles: Dict[str, Dict[str, Any]]) -> None:
    """Display detailed user information for a customer.

    Args:
        customer_name: Name of the customer
        users: List of user dictionaries
        user_roles: Dictionary mapping usernames to their role information
    """
    tree = Tree(f"[bold blue]{customer_name}[/bold blue] - Users & Roles")

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

            # Add role information if available
            if username in user_roles:
                role_info = user_roles[username]
                applications = role_info.get("applications", {})

                if applications:
                    roles_branch = user_branch.add("[cyan]Roles & Permissions:[/cyan]")

                    for app_name, app_data in applications.items():
                        app_branch = roles_branch.add(f"[yellow]{app_name}[/yellow]")

                        # Add MSP role if present
                        if "msp_role" in app_data:
                            app_branch.add(f"MSP Role: {app_data['msp_role']}")

                        # Add tenant role if present
                        if "role" in app_data:
                            app_branch.add(f"Tenant Role: {app_data['role']}")

                        # Add group information if present
                        if "groups" in app_data:
                            groups = app_data["groups"]
                            if groups:
                                group_str = ", ".join(groups)
                                app_branch.add(f"Groups: {group_str}")

    console.print(tree)
    console.print()


def display_user_table(customer_name: str, users: List[Dict[str, Any]],
                      user_roles: Dict[str, Dict[str, Any]]) -> None:
    """Display user information in a table format.

    Args:
        customer_name: Name of the customer
        users: List of user dictionaries
        user_roles: Dictionary mapping usernames to their role information
    """
    table = Table(
        title=f"Users for {customer_name}",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan"
    )

    table.add_column("Username", style="green")
    table.add_column("Email", style="blue")
    table.add_column("Status", style="yellow")
    table.add_column("MSP Role", style="magenta")
    table.add_column("Tenant Role", style="cyan")

    if not users:
        console.print(f"[yellow]No users found for {customer_name}[/yellow]\n")
        return

    for user in users:
        username = user.get("username", "N/A")
        email = user.get("email", "N/A")
        status = user.get("status", "N/A")

        msp_role = "N/A"
        tenant_role = "N/A"

        # Extract role information
        if username in user_roles:
            role_info = user_roles[username]
            applications = role_info.get("applications", {})

            # Try to find Network Operations or first available application
            for app_name, app_data in applications.items():
                if "msp_role" in app_data:
                    msp_role = app_data["msp_role"]
                if "role" in app_data:
                    tenant_role = app_data["role"]
                break  # Use first application's roles

        table.add_row(username, email, status, msp_role, tenant_role)

    console.print(table)
    console.print()


def main():
    """Main function to audit MSP user management."""
    console.print(Panel.fit(
        "[bold blue]Aruba Central MSP User Management Audit[/bold blue]",
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

        # Get all customers/tenants (authentication happens automatically here)
        console.print("[bold]Fetching customer/tenant accounts...[/bold]")
        customers = get_all_customers(client)
        console.print("[green]✓ Connected successfully![/green]\n")

        if not customers:
            console.print("[yellow]No customers found.[/yellow]")
            return

        # Display customer summary
        display_customer_summary(customers)

        # Iterate through each customer and get user details
        console.print("[bold]Fetching user details for each customer...[/bold]\n")

        for customer in customers:
            customer_id = customer.get("customer_id")
            customer_name = customer.get("customer_name", "Unknown")

            console.print(f"[bold cyan]Processing: {customer_name} (ID: {customer_id})[/bold cyan]")

            # Get users for this customer
            users = get_customer_users(client, customer_id)

            # Get detailed role information for each user
            user_roles = {}
            for user in users:
                username = user.get("username")
                if username:
                    role_info = get_user_roles(client, customer_id, username)
                    user_roles[username] = role_info

            # Display results in table format (cleaner for many users)
            display_user_table(customer_name, users, user_roles)

            # Optionally, uncomment below to use tree format instead
            # display_user_details(customer_name, users, user_roles)

        console.print("[green]✓ Audit complete![/green]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        import traceback
        console.print(f"[red]{traceback.format_exc()}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
