#!/usr/bin/env python3
"""Example automation script for Aruba Central API.

This script demonstrates how to use the CentralAPIClient to interact with the API.
Uses client credentials flow with automatic token refresh.
"""

import sys
from pathlib import Path

# Add parent directory to path to import utils
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console

console = Console()


def main():
    """Main function."""
    console.print("[bold blue]Aruba Central API Example Script[/bold blue]")

    # Load configuration
    config = load_config()
    aruba_config = config["aruba_central"]

    # Initialize token manager for automatic token refresh
    token_manager = TokenManager(
        client_id=aruba_config["client_id"],
        client_secret=aruba_config["client_secret"],
    )

    # Initialize API client with token manager
    client = CentralAPIClient(
        base_url=aruba_config["base_url"],
        token_manager=token_manager,
    )

    try:
        console.print("Connecting to Aruba Central...")

        # Example: Get devices (authentication happens automatically via TokenManager)
        devices = client.get("/monitoring/v1/devices")
        console.print("[green]Connected successfully![/green]")
        console.print(f"Found {len(devices.get('devices', []))} devices")

        console.print("[yellow]Add your automation logic here![/yellow]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
