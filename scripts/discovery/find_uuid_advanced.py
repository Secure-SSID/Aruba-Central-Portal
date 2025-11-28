#!/usr/bin/env python3
"""
Advanced UUID search - checks more endpoints including template groups, webhooks, etc.
"""

import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from rich.console import Console
from rich.json import JSON
from utils import CentralAPIClient, TokenManager, load_config
import requests

console = Console()


def search_uuid(client, uuid):
    """Search for UUID across various API endpoints."""

    results = []
    endpoints_to_check = [
        # (endpoint_path, result_key, id_fields, description)
        ("/configuration/v2/groups", "data", ["group_name", "template_group"], "Template Groups"),
        ("/monitoring/v2/groups", "groups", ["group"], "Monitoring Groups"),
        ("/platform/device_inventory/v1/devices", "devices", ["serial", "macaddr"], "Device Inventory"),
        ("/central/v2/sites", "sites", ["site_id", "site_name"], "Sites"),
        ("/caasapi/v1/exec/cmd", None, None, "Audit Logs Context"),
        ("/platform/auditlogs/v1/logs", "logs", ["id", "target_id"], "Audit Logs"),
        ("/configuration/v1/ap_settings_cli/template_group", None, None, "AP CLI Templates"),
    ]

    for endpoint, result_key, id_fields, description in endpoints_to_check:
        console.print(f"[cyan]Checking {description}...[/cyan]")
        try:
            # Try with UUID as path parameter first
            data = client.get(f"{endpoint}/{uuid}")
            results.append((description, data))
            console.print(f"[green]✓ Found in {description} (direct lookup)![/green]")
            continue
        except requests.HTTPError as e:
            # 404 is expected if UUID not found, other errors should be logged
            if e.response.status_code != 404:
                console.print(f"[yellow]Warning: {description} returned {e.response.status_code}[/yellow]")
        except Exception as e:
            console.print(f"[dim]Could not check {description} directly: {type(e).__name__}[/dim]")

        # Try listing all and searching
        try:
            data = client.get(endpoint)

            # Handle different response structures
            items = []
            if result_key and result_key in data:
                items = data[result_key]
            elif isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                # Look for common list keys
                for key in ["items", "data", "results", "devices", "groups", "sites"]:
                    if key in data and isinstance(data[key], list):
                        items = data[key]
                        break

            # Search through items
            for item in items:
                if isinstance(item, dict):
                    # Check all values in the item
                    for key, value in item.items():
                        if str(value) == uuid:
                            results.append((f"{description} - {key}", item))
                            console.print(f"[green]✓ Found in {description} (field: {key})![/green]")
                            break

                    # Also check specific ID fields if provided
                    if id_fields:
                        for field in id_fields:
                            if field in item and str(item[field]) == uuid:
                                results.append((description, item))
                                console.print(f"[green]✓ Found in {description}![/green]")
                                break

        except Exception as e:
            console.print(f"[dim]{description}: {str(e)[:80]}[/dim]")

    return results


def main():
    if len(sys.argv) < 2:
        console.print("[red]Usage: python find_uuid_advanced.py <uuid>[/red]")
        sys.exit(1)

    uuid = sys.argv[1]
    console.print(f"\n[bold]Searching for UUID: {uuid}[/bold]\n")

    # Load config and initialize client
    config = load_config()
    aruba_config = config["aruba_central"]
    token_manager = TokenManager(
        client_id=aruba_config["client_id"],
        client_secret=aruba_config["client_secret"],
    )
    client = CentralAPIClient(
        base_url=aruba_config["base_url"],
        token_manager=token_manager,
    )

    # Search for UUID
    results = search_uuid(client, uuid)

    # Display results
    console.print("\n" + "="*80)
    if results:
        console.print(f"\n[bold green]Found {len(results)} match(es)![/bold green]\n")
        for resource_type, data in results:
            console.print(f"\n[bold cyan]Resource Type: {resource_type}[/bold cyan]")
            console.print(JSON(json.dumps(data, indent=2)))
            console.print()
    else:
        console.print(f"\n[bold yellow]UUID not found in checked endpoints.[/bold yellow]")
        console.print("\n[dim]Note: Some endpoints may require different permissions or may not be")
        console.print("available in your Aruba Central instance type (MSP vs standard).[/dim]")


if __name__ == "__main__":
    main()
