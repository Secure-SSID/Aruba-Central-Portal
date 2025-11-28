#!/usr/bin/env python3
"""
Extract VLANs from existing tunnel mode WLANs

This script identifies which VLANs are currently in use by tunnel mode WLANs.
Since tunnel mode WLANs must reference a VLAN that exists on the gateway,
this provides a way to discover configured gateway VLANs indirectly.

Note: This only shows VLANs that are currently used by tunnel mode WLANs.
The gateway may have additional VLANs configured that aren't shown here.

Usage:
    python scripts/network/wlan/extract_vlans_from_wlans.py
"""

import traceback
from rich.console import Console
from rich.table import Table
from utils.test_helpers import login_to_dashboard, api_request, DASHBOARD_API

console = Console()


def get_wlans(session_id: str) -> tuple[list[dict], str | None]:
    """Get all WLANs from dashboard

    Args:
        session_id: Active session ID from login

    Returns:
        Tuple of (wlans_list, error_message):
        - (wlans, None) on success (empty list if no WLANs)
        - (None, error_message) on failure
    """
    headers = {'X-Session-ID': session_id}
    data, error = api_request('GET', f"{DASHBOARD_API}/config/wlan", headers=headers)

    if error:
        return None, error

    if not isinstance(data, dict):
        return None, f"Invalid response type: expected dict, got {type(data).__name__}"

    # Handle different response formats
    wlans = data.get('wlan-ssids', data.get('items', []))

    if not isinstance(wlans, list):
        return None, f"Invalid WLANs format: expected list, got {type(wlans).__name__}"

    return wlans, None


def extract_tunnel_vlans(wlans: list[dict]) -> dict[str, list[str]]:
    """Extract VLANs used by tunnel mode WLANs

    Args:
        wlans: List of WLAN configuration dictionaries

    Returns:
        Dictionary mapping VLAN ID (str) to list of SSID names using that VLAN
    """
    tunnel_vlans = {}

    for wlan in wlans:
        if not isinstance(wlan, dict):
            continue

        # Check if tunnel mode (FORWARD_MODE_L2 = tunnel/bridge mode)
        forward_mode = wlan.get('forward-mode', '')
        if forward_mode == 'FORWARD_MODE_L2':
            # Extract VLAN
            vlan_ranges = wlan.get('vlan-id-range', [])
            ssid = wlan.get('ssid', 'Unknown')

            for vlan in vlan_ranges:
                vlan_id = str(vlan)
                if vlan_id not in tunnel_vlans:
                    tunnel_vlans[vlan_id] = []
                tunnel_vlans[vlan_id].append(ssid)

    return tunnel_vlans


def main():
    console.print("[bold cyan]Extract VLANs from Tunnel Mode WLANs[/bold cyan]\n")
    console.print("[dim]This script identifies VLANs in use by existing tunnel mode WLANs[/dim]\n")

    # Login
    console.print("[cyan]Step 1: Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()
    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        return
    console.print("[green]✓[/green] Authenticated\n")

    # Get WLANs
    console.print("[cyan]Step 2: Fetching all WLANs...[/cyan]")
    wlans, error = get_wlans(session_id)
    if error:
        console.print(f"[red]Failed to fetch WLANs:[/red] {error}")
        return

    console.print(f"[green]✓[/green] Found {len(wlans)} WLAN(s)\n")

    # Extract tunnel VLANs
    console.print("[cyan]Step 3: Analyzing tunnel mode WLANs...[/cyan]")
    tunnel_vlans = extract_tunnel_vlans(wlans)

    if not tunnel_vlans:
        console.print("[yellow]⚠ No tunnel mode WLANs found[/yellow]")
        console.print("[dim]Create a tunnel mode WLAN first to discover available VLANs[/dim]")
        return

    # Display results
    console.print(f"[green]✓[/green] Found {len(tunnel_vlans)} VLAN(s) used by tunnel mode WLANs\n")

    table = Table(title="VLANs in Use (Tunnel Mode)")
    table.add_column("VLAN ID", style="cyan", justify="center")
    table.add_column("Used By", style="yellow")
    table.add_column("Count", style="green", justify="center")

    for vlan_id in sorted(tunnel_vlans.keys(), key=lambda x: int(x)):
        ssids = tunnel_vlans[vlan_id]
        table.add_row(
            vlan_id,
            ", ".join(ssids[:3]) + ("..." if len(ssids) > 3 else ""),
            str(len(ssids))
        )

    console.print(table)

    # Updated message - more accurate about what we're showing
    console.print(f"\n[bold green]✓ VLANs used by existing tunnel WLANs:[/bold green]")
    console.print("[dim](These VLANs are likely configured on your gateway)[/dim]")
    for vlan_id in sorted(tunnel_vlans.keys(), key=lambda x: int(x)):
        console.print(f"  • VLAN {vlan_id}")

    console.print(f"\n[dim]💡 Tip: Use these VLAN IDs when creating new tunnel mode WLANs[/dim]")
    console.print(f"[dim]Note: Gateway may have additional VLANs not shown here[/dim]")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Unexpected error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
