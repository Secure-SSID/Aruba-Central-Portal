#!/usr/bin/env python3
"""
Test the gateway VLAN endpoint

Verifies that the dashboard backend correctly fetches VLANs from the gateway
using the proper API endpoint. The WLAN wizard requires this to populate
the VLAN dropdown for tunnel mode WLANs.

Usage:
    python scripts/testing/test_vlan_endpoint_fix.py

    # Or test specific gateway:
    TEST_GATEWAY_SERIAL=CN12345678 python scripts/testing/test_vlan_endpoint_fix.py

Note: These are manual integration tests requiring a live dashboard backend.
"""

import os
import sys
from pathlib import Path

# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import traceback
from rich.console import Console
from rich.table import Table
from utils.test_helpers import login_to_dashboard, get_first_gateway, api_request, DASHBOARD_API

console = Console()


def test_vlan_endpoint(gateway_serial: str, session_id: str) -> tuple[bool, list[dict] | None]:
    """Test the gateway VLAN endpoint

    Args:
        gateway_serial: Gateway serial number to query
        session_id: Active session ID from login

    Returns:
        Tuple of (success, vlans):
        - (True, vlans_list) on success
        - (False, None) on failure
    """
    console.print(f"[cyan]Testing VLAN endpoint for gateway: {gateway_serial}[/cyan]\n")

    headers = {'X-Session-ID': session_id}
    data, error = api_request(
        'GET',
        f"{DASHBOARD_API}/monitoring/gateways/{gateway_serial}/vlans",
        headers=headers
    )

    if error:
        console.print(f"[red]✗ FAILED:[/red] {error}")
        return False, None

    # Validate response structure
    if not isinstance(data, dict):
        console.print(f"[red]✗ Invalid response type: expected dict, got {type(data).__name__}[/red]")
        return False, None

    # Check for VLANs in response
    vlans = data.get('vlans', [])

    if not isinstance(vlans, list):
        console.print(f"[yellow]⚠ Unexpected VLANs format: expected list, got {type(vlans).__name__}[/yellow]")
        console.print(f"Response: {data}")
        return False, None

    if len(vlans) == 0:
        console.print("[yellow]⚠ No VLANs returned from gateway[/yellow]")
        console.print("[dim]The gateway may not have any VLANs configured.[/dim]")
        console.print("[dim]Configure VLANs on the gateway before creating tunnel mode WLANs.[/dim]")
        return False, None

    console.print(f"[green]✓ SUCCESS![/green] Found {len(vlans)} VLAN(s)\n")
    return True, vlans


def display_vlans(vlans: list[dict]) -> None:
    """Display VLANs in a formatted table

    Args:
        vlans: List of VLAN dictionaries with 'id' and optionally 'name'
    """
    table = Table(title="Gateway VLANs")
    table.add_column("VLAN ID", style="cyan", justify="center")
    table.add_column("Name", style="yellow")

    for vlan in vlans:
        vlan_id = vlan.get('id', vlan.get('vlan_id', 'N/A'))
        vlan_name = vlan.get('name', vlan.get('vlan_name', 'N/A'))
        table.add_row(str(vlan_id), vlan_name)

    console.print(table)
    console.print()

    # Show VLAN IDs for easy reference
    try:
        vlan_ids = [v.get('id', v.get('vlan_id')) for v in vlans]
        vlan_ids = [vid for vid in vlan_ids if vid is not None]  # Filter out None
        console.print(f"[bold]Available VLAN IDs:[/bold] {', '.join(map(str, sorted(vlan_ids)))}")
    except (KeyError, TypeError) as e:
        console.print(f"[dim]Could not extract VLAN IDs: {e}[/dim]")


def main():
    console.print("[bold cyan]Test Gateway VLAN Endpoint Fix[/bold cyan]\n")

    # Login
    console.print("[cyan]Step 1: Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()
    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        return
    console.print("[green]✓[/green] Authenticated\n")

    # Get gateway (use environment variable or fetch first available)
    console.print("[cyan]Step 2: Getting gateway...[/cyan]")
    gateway_serial = os.environ.get('TEST_GATEWAY_SERIAL')

    if gateway_serial:
        console.print(f"[green]✓[/green] Using gateway from TEST_GATEWAY_SERIAL: {gateway_serial}\n")
        gateway_name = "Unknown"
    else:
        gateway, error = get_first_gateway(session_id)
        if error:
            console.print(f"[red]Failed to get gateway:[/red] {error}")
            return

        gateway_serial = gateway.get('serialNumber', gateway.get('serial', ''))
        gateway_name = gateway.get('deviceName', gateway.get('name', 'Unknown'))
        console.print(f"[green]✓[/green] Using first available gateway: {gateway_name} ({gateway_serial})\n")

    # Test VLAN endpoint
    console.print("[cyan]Step 3: Testing VLAN endpoint...[/cyan]")
    success, vlans = test_vlan_endpoint(gateway_serial, session_id)

    if success and vlans:
        display_vlans(vlans)

    # Summary
    console.print("\n" + "="*60)
    if success:
        console.print("[bold green]✓ VLAN ENDPOINT WORKING![/bold green]")
        console.print("[dim]The WLAN wizard dropdown should now show VLANs[/dim]")
    else:
        console.print("[bold red]✗ VLAN endpoint not working[/bold red]")
        console.print("\n[yellow]Troubleshooting:[/yellow]")
        console.print("  1. Check backend logs for errors")
        console.print("  2. Verify gateway has VLANs configured")
        console.print("  3. Confirm API endpoint path is correct")
        console.print("  4. Check authentication and permissions")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Unexpected error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
