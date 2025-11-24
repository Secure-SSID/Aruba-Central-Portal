#!/usr/bin/env python3
"""
Extract VLANs from existing tunnel mode WLANs
This is a workaround since we can't query gateway VLANs directly
"""

import requests
from rich.console import Console
from rich.table import Table

console = Console()

DASHBOARD_API = "http://localhost:5000/api"

def login():
    response = requests.post(f"{DASHBOARD_API}/auth/login")
    if response.status_code == 200:
        return response.json().get('session_id')
    return None

def get_wlans(session_id):
    """Get all WLANs"""
    headers = {'X-Session-ID': session_id}
    response = requests.get(f"{DASHBOARD_API}/config/wlan", headers=headers)
    if response.status_code == 200:
        data = response.json()
        return data.get('wlan-ssids', data.get('items', []))
    return []

def extract_tunnel_vlans(wlans):
    """Extract VLANs used by tunnel mode WLANs"""
    tunnel_vlans = {}

    for wlan in wlans:
        # Check if tunnel mode
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
    console.print("[dim]Since we can't query gateway VLANs directly, we'll extract them from existing WLANs[/dim]\n")

    # Login
    console.print("[cyan]Authenticating...[/cyan]")
    session_id = login()
    if not session_id:
        console.print("[red]Failed to authenticate[/red]")
        return
    console.print("[green]✓[/green] Authenticated\n")

    # Get WLANs
    console.print("[cyan]Fetching all WLANs...[/cyan]")
    wlans = get_wlans(session_id)
    console.print(f"[green]✓[/green] Found {len(wlans)} WLAN(s)\n")

    # Extract tunnel VLANs
    tunnel_vlans = extract_tunnel_vlans(wlans)

    if not tunnel_vlans:
        console.print("[yellow]No tunnel mode WLANs found[/yellow]")
        console.print("[dim]Create a tunnel mode WLAN first to see VLANs[/dim]")
        return

    # Display results
    console.print(f"[green]Found {len(tunnel_vlans)} VLAN(s) used by tunnel mode WLANs:[/green]\n")

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

    console.print(f"\n[bold green]✓ These VLANs are configured on your gateway:[/bold green]")
    for vlan_id in sorted(tunnel_vlans.keys(), key=lambda x: int(x)):
        console.print(f"  • VLAN {vlan_id}")

    console.print(f"\n[dim]💡 Tip: Use these VLAN IDs when creating new tunnel mode WLANs[/dim]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Error:[/red] {str(e)}")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
