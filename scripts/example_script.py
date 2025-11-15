#!/usr/bin/env python3
"""Example automation script for Aruba Central API.

This script demonstrates how to use the ArubaClient to interact with the API.
"""

import sys
from pathlib import Path

# Add parent directory to path to import utils
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import ArubaClient, load_config
from rich.console import Console
from rich.table import Table

console = Console()


def main():
    """Main function."""
    console.print("[bold blue]Aruba Central API Example Script[/bold blue]")

    # Load configuration
    config = load_config()
    aruba_config = config["aruba_central"]

    # Initialize client
    client = ArubaClient(
        base_url=aruba_config["base_url"],
        client_id=aruba_config["client_id"],
        client_secret=aruba_config["client_secret"],
        customer_id=aruba_config["customer_id"],
        username=aruba_config.get("username"),
        password=aruba_config.get("password"),
    )

    try:
        # No explicit authentication needed - happens automatically on first API call
        console.print("Connecting to Aruba Central...")

        # Example: Get devices (authentication happens automatically)
        devices = client.get("/monitoring/v1/devices")
        console.print(f"[green]Connected successfully![/green]")
        console.print(f"Found {len(devices.get('devices', []))} devices")

        console.print("[yellow]Add your automation logic here![/yellow]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
