#!/usr/bin/env python3
"""Test script to verify API access and list some basic info."""

import sys
from pathlib import Path
# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table

console = Console()


def main():
    """Test API calls."""
    console.print("[bold blue]Aruba Central API Test[/bold blue]\n")

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
        # Test API call - Get monitoring devices (auth happens automatically if needed)
        console.print("Fetching devices...")
        try:
            devices_response = client.get("/monitoring/v1/devices")

            if "devices" in devices_response:
                devices = devices_response["devices"]
                console.print(f"[green]✓ Found {len(devices)} device(s)[/green]\n")

                if devices:
                    # Create table
                    table = Table(title="Devices")
                    table.add_column("Serial", style="cyan")
                    table.add_column("Name", style="green")
                    table.add_column("Type", style="yellow")
                    table.add_column("Status", style="magenta")

                    for device in devices[:10]:  # Show first 10
                        table.add_row(
                            device.get("serial", "N/A"),
                            device.get("name", "N/A"),
                            device.get("device_type", "N/A"),
                            device.get("status", "N/A")
                        )

                    console.print(table)
                else:
                    console.print("[yellow]No devices found in your Aruba Central instance[/yellow]")
            else:
                console.print(f"[yellow]Unexpected response format: {devices_response}[/yellow]")

        except Exception as e:
            console.print(f"[yellow]Could not fetch devices: {e}[/yellow]")
            console.print("[cyan]This might be due to API permissions or endpoint availability[/cyan]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
