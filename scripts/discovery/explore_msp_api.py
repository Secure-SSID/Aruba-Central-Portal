#!/usr/bin/env python3
"""Explore MSP-specific API endpoints."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table

console = Console()


def test_endpoint(client, endpoint, description):
    """Test an API endpoint."""
    try:
        response = client.get(endpoint)
        console.print(f"[green]✓ {description}[/green]")
        return response
    except Exception as e:
        console.print(f"[red]✗ {description}[/red]: {str(e)[:100]}")
        return None


def main():
    """Test MSP-specific API endpoints."""
    console.print("[bold blue]Exploring Aruba Central MSP API[/bold blue]\n")

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

    console.print("Testing MSP API endpoints...\n")

    # MSP-specific endpoints
    endpoints = [
        ("/msp_api/v1/customers", "MSP Customers"),
        ("/msp_api/v1/tenants", "MSP Tenants"),
        ("/central/v2/customers", "Customers (v2)"),
        ("/platform/rbac/v1/users", "Users"),
        ("/monitoring/v1/switches", "Switches"),
        ("/monitoring/v2/switches", "Switches (v2)"),
        ("/monitoring/v1/networks", "Networks"),
        ("/platform/licensing/v1/services/config", "Licensing Config"),
    ]

    successful = []
    for endpoint, description in endpoints:
        result = test_endpoint(client, endpoint, description)
        if result:
            successful.append((endpoint, description, result))

    # Display successful endpoints with data
    if successful:
        console.print(f"\n[bold green]✓ Successfully accessed {len(successful)} endpoint(s)[/bold green]\n")

        for endpoint, description, data in successful:
            console.print(f"\n[bold cyan]━━━ {description} ━━━[/bold cyan]")
            console.print(f"[dim]Endpoint: {endpoint}[/dim]\n")

            if isinstance(data, dict):
                # Show structure
                console.print(f"Response keys: [yellow]{', '.join(data.keys())}[/yellow]")

                # Show counts
                for key in ['total', 'count', 'customers', 'tenants', 'devices', 'switches', 'networks']:
                    if key in data:
                        value = data[key]
                        if isinstance(value, list):
                            console.print(f"  • {key}: {len(value)} items")
                        else:
                            console.print(f"  • {key}: {value}")

                # For customers/tenants, show first few
                if 'customers' in data and data['customers']:
                    console.print("\n[yellow]Customers:[/yellow]")
                    for i, customer in enumerate(data['customers'][:5]):
                        if isinstance(customer, dict):
                            name = customer.get('customer_name', customer.get('name', 'N/A'))
                            cid = customer.get('customer_id', customer.get('id', 'N/A'))
                            console.print(f"  {i+1}. {name} (ID: {cid})")

                if 'items' in data and data['items']:
                    console.print(f"\n[yellow]Items ({len(data['items'])}):[/yellow]")
                    for i, item in enumerate(data['items'][:3]):
                        if isinstance(item, dict):
                            # Show first few keys
                            preview = {k: v for k, v in list(item.items())[:3]}
                            console.print(f"  {i+1}. {preview}")

            console.print()
    else:
        console.print("\n[red]No endpoints were successfully accessed.[/red]")


if __name__ == "__main__":
    main()
