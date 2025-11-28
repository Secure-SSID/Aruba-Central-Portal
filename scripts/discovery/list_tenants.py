#!/usr/bin/env python3
"""List tenants/customers in MSP environment."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
import json

console = Console()


def test_endpoint(client, endpoint, description):
    """Test an API endpoint and return data if successful."""
    try:
        console.print(f"[cyan]Testing:[/cyan] {endpoint}")
        response = client.get(endpoint)
        console.print(f"[green]✓ Success[/green]: {description}\n")
        return response
    except Exception as e:
        console.print(f"[red]✗ Failed[/red]: {str(e)[:100]}\n")
        return None


def main():
    """Explore tenant/customer endpoints."""
    console.print(Panel.fit(
        "[bold blue]MSP Tenants & Customers Explorer[/bold blue]",
        border_style="blue"
    ))
    console.print()

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

    console.print("[bold]Testing various tenant/customer endpoints...[/bold]\n")

    # Try different endpoints
    endpoints = [
        # MSP specific
        ("/msp_api/v1/customers", "MSP Customers (v1)"),
        ("/msp_api/v2/customers", "MSP Customers (v2)"),
        ("/msp_api/v1/tenants", "MSP Tenants (v1)"),

        # Central API
        ("/central/v2/customers", "Customers (v2)"),
        ("/platform/v1/customers", "Customers (Platform v1)"),

        # Account/Tenant info
        ("/platform/v1/msp/customers", "MSP Platform Customers"),
        ("/account/v1/customers", "Account Customers"),

        # Customer details
        ("/configuration/v1/customers", "Customer Configuration"),

        # Try getting current account info
        ("/platform/v1/account", "Account Info"),
        ("/platform/device_inventory/v1/msp/devices", "MSP Device Inventory"),
    ]

    successful = []
    for endpoint, description in endpoints:
        result = test_endpoint(client, endpoint, description)
        if result:
            successful.append((endpoint, description, result))

    # Display results
    console.print("\n" + "="*70 + "\n")

    if successful:
        console.print(f"[bold green]Found {len(successful)} working endpoint(s)![/bold green]\n")

        for endpoint, description, data in successful:
            console.print(Panel.fit(
                f"[bold cyan]{description}[/bold cyan]\n"
                f"[dim]Endpoint: {endpoint}[/dim]",
                border_style="cyan"
            ))

            # Display data structure
            if isinstance(data, dict):
                console.print(f"\n[yellow]Response Keys:[/yellow] {', '.join(data.keys())}\n")

                # Look for customer/tenant lists
                for key in ['customers', 'tenants', 'items', 'data', 'msp_customers']:
                    if key in data:
                        items = data[key]
                        if isinstance(items, list):
                            console.print(f"[green]{key}:[/green] {len(items)} items")

                            if items:
                                # Display first item structure
                                console.print(f"\n[yellow]Sample {key[:-1]} structure:[/yellow]")
                                sample = items[0]
                                if isinstance(sample, dict):
                                    for k, v in list(sample.items())[:10]:
                                        console.print(f"  • {k}: {v}")

                                # Create table if we have customer/tenant data
                                if len(items) > 0 and isinstance(items[0], dict):
                                    table = Table(title=f"{description} - {len(items)} items")

                                    # Add columns based on first item
                                    common_keys = ['name', 'customer_name', 'tenant_name', 'id', 'customer_id', 'tenant_id', 'description', 'status']
                                    cols_added = []
                                    for col in common_keys:
                                        if col in items[0]:
                                            table.add_column(col.replace('_', ' ').title(), style="cyan")
                                            cols_added.append(col)

                                    # Add rows
                                    for item in items[:10]:  # Show first 10
                                        row_data = [str(item.get(col, 'N/A')) for col in cols_added]
                                        table.add_row(*row_data)

                                    console.print("\n")
                                    console.print(table)

                        elif isinstance(items, int):
                            console.print(f"[green]{key}:[/green] {items}")

                # Show raw data for small responses
                if len(str(data)) < 500:
                    console.print(f"\n[yellow]Full Response:[/yellow]")
                    console.print(json.dumps(data, indent=2))

            console.print("\n" + "-"*70 + "\n")

    else:
        console.print("[red]No tenant/customer endpoints were accessible.[/red]\n")
        console.print("[yellow]This might indicate:[/yellow]")
        console.print("  • Your account is not in MSP mode")
        console.print("  • You're already in a tenant context (not at MSP level)")
        console.print("  • API permissions don't include MSP management")
        console.print("  • Different API version or endpoint structure")

    # Show current customer context
    console.print("\n")
    console.print(Panel.fit(
        f"[bold]Current Context[/bold]\n"
        f"Customer ID: {aruba_config['customer_id']}\n"
        f"Base URL: {aruba_config['base_url']}\n"
        f"Username: {aruba_config['username']}",
        title="Configuration",
        border_style="blue"
    ))


if __name__ == "__main__":
    main()
