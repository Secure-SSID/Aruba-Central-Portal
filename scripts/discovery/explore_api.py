#!/usr/bin/env python3
"""Explore available API endpoints."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console

console = Console()


def test_endpoint(client, endpoint, description):
    """Test an API endpoint."""
    try:
        response = client.get(endpoint)
        console.print(f"[green]✓ {description}[/green]")
        return response
    except Exception as e:
        console.print(f"[red]✗ {description}[/red]: {str(e)[:80]}")
        return None


def main():
    """Test various API endpoints."""
    console.print("[bold blue]Exploring Aruba Central API[/bold blue]\n")

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

    console.print("Testing API endpoints...\n")

    # Try various common endpoints
    endpoints = [
        ("/platform/device_inventory/v1/devices", "Device Inventory"),
        ("/monitoring/v2/devices", "Devices (v2)"),
        ("/monitoring/v1/devices", "Devices (v1)"),
        ("/monitoring/v1/aps", "Access Points"),
        ("/monitoring/v1/switches", "Switches"),
        ("/configuration/v1/devices", "Device Configuration"),
        ("/central/v2/sites", "Sites"),
        ("/platform/rbac/v1/users", "Users"),
    ]

    successful = []
    for endpoint, description in endpoints:
        result = test_endpoint(client, endpoint, description)
        if result:
            successful.append((endpoint, description, result))

    # Display successful endpoints
    if successful:
        console.print(f"\n[bold green]Successfully accessed {len(successful)} endpoint(s)[/bold green]\n")

        for endpoint, description, data in successful:
            console.print(f"[cyan]{description}[/cyan] ({endpoint}):")

            # Try to display some info about the response
            if isinstance(data, dict):
                # Show keys
                console.print(f"  Keys: {', '.join(data.keys())}")

                # Show count if available
                for key in ['total', 'count', 'devices', 'aps', 'switches', 'sites']:
                    if key in data:
                        value = data[key]
                        if isinstance(value, list):
                            console.print(f"  {key}: {len(value)} items")
                        else:
                            console.print(f"  {key}: {value}")
            console.print()
    else:
        console.print("\n[yellow]No endpoints were successfully accessed.[/yellow]")
        console.print("[cyan]This might indicate API permission issues or API version changes.[/cyan]")


if __name__ == "__main__":
    main()
