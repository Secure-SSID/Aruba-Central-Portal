#!/usr/bin/env python3
"""
Test Tunnel Mode WLAN Creation with VLAN Selection

Tests the gateway VLAN selection feature for tunnel mode WLANs.
Validates that the dashboard correctly fetches and displays available VLANs
from the gateway when creating tunnel mode WLANs.

Usage:
    python scripts/testing/test_tunnel_vlan_selection.py
"""

import sys
from pathlib import Path

# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import traceback
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from datetime import datetime
from utils.test_helpers import (
    login_to_dashboard,
    get_gateways,
    api_request,
    TEST_WLAN_PASSWORD,
    DASHBOARD_API
)

console = Console()

def get_gateway_vlans(gateway_serial, session_id):
    """Get VLANs configured on a specific gateway"""
    try:
        headers = {'X-Session-ID': session_id}
        response = requests.get(f"{DASHBOARD_API}/monitoring/gateways/{gateway_serial}/vlans", headers=headers)
        if response.status_code == 200:
            data = response.json()
            console.print(f"[dim]Raw VLAN response: {data}[/dim]")

            # Parse VLAN response (same logic as frontend)
            vlan_list = []
            if data.get('vlans') and isinstance(data['vlans'], list):
                vlan_list = data['vlans']
            elif data.get('layer2-vlans') and isinstance(data['layer2-vlans'], list):
                vlan_list = data['layer2-vlans']

            vlans = []
            for v in vlan_list:
                vlan_id = v.get('vlan_id') or v.get('vlan-id') or v.get('id')
                vlan_name = v.get('name') or v.get('vlan_name') or f"VLAN {vlan_id}"
                if vlan_id is not None:
                    vlans.append({'id': vlan_id, 'name': vlan_name})

            return vlans
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not fetch gateway VLANs: {str(e)}")
    return []

def create_tunnel_wlan(ssid_name, wlan_payload, session_id):
    """Create a tunnel mode WLAN using CNX Config API"""
    try:
        headers = {'X-Session-ID': session_id, 'Content-Type': 'application/json'}
        response = requests.post(f"{DASHBOARD_API}/config/wlan/{ssid_name}", headers=headers, json=wlan_payload)
        console.print(f"[dim]Create WLAN response status: {response.status_code}[/dim]")
        console.print(f"[dim]Create WLAN response: {response.text[:500]}[/dim]")
        return response.status_code in [200, 201], response.json() if response.text else {}
    except Exception as e:
        console.print(f"[red]Error creating WLAN:[/red] {str(e)}")
        return False, {}

def main():
    console.print(Panel.fit(
        "[bold cyan]Tunnel Mode WLAN Creation Test[/bold cyan]\n"
        "Testing gateway VLAN selection feature",
        border_style="cyan"
    ))

    # Step 1: Login
    console.print("\n[cyan]Step 1: Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()

    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        return

    console.print("[green]✓[/green] Authenticated\n")

    # Step 2: Get gateways
    console.print("[cyan]Step 2: Fetching available gateways...[/cyan]")
    gateways, error = get_gateways(session_id)

    if error:
        console.print(f"[red]Failed to fetch gateways:[/red] {error}")
        return

    if not gateways:
        console.print("[yellow]No gateways found. Tunnel mode requires a gateway.[/yellow]")
        return

    console.print(f"[green]✓[/green] Found {len(gateways)} gateway(s)\n")

    # Display gateways
    gateway_table = Table(title="Available Gateways")
    gateway_table.add_column("Name", style="cyan")
    gateway_table.add_column("Serial", style="yellow")
    gateway_table.add_column("Model", style="green")

    for gw in gateways:
        gateway_table.add_row(
            gw.get('deviceName', 'Unknown'),
            gw.get('serialNumber', gw.get('serial', 'Unknown')),
            gw.get('model', 'Unknown')
        )

    console.print(gateway_table)
    console.print()

    # Use first gateway
    gateway = gateways[0]
    gateway_serial = gateway.get('serialNumber', gateway.get('serial', ''))
    gateway_name = gateway.get('deviceName', gateway.get('name', 'Unknown'))

    console.print(f"[cyan]Using gateway:[/cyan] {gateway_name} ({gateway_serial})\n")

    # Step 3: Fetch gateway VLANs
    console.print(f"[cyan]Step 3: Fetching VLANs from gateway {gateway_serial}...[/cyan]")
    vlans = get_gateway_vlans(gateway_serial, session_id)

    if not vlans:
        console.print("[red]No VLANs found on gateway[/red]")
        console.print("[yellow]Cannot create tunnel mode WLAN without configured VLANs.[/yellow]")
        console.print("\n[dim]Next steps:[/dim]")
        console.print("[dim]  1. Configure VLANs on the gateway[/dim]")
        console.print("[dim]  2. Run this script again to verify VLAN discovery[/dim]")
        return

    console.print(f"[green]✓[/green] Found {len(vlans)} VLAN(s)\n")

    # Display VLANs
    vlan_table = Table(title="Gateway VLANs")
    vlan_table.add_column("VLAN ID", style="cyan")
    vlan_table.add_column("Name", style="yellow")

    for vlan in vlans:
        vlan_table.add_row(str(vlan['id']), vlan['name'])

    console.print(vlan_table)
    console.print()

    # Step 4: Create tunnel mode WLAN
    console.print("[cyan]Step 4: Creating tunnel mode WLAN...[/cyan]")

    # Use first VLAN (or VLAN 2 if available)
    target_vlan = next((v for v in vlans if v['id'] == 2), vlans[0])

    timestamp = datetime.now().strftime("%H%M%S")
    ssid_name = f"test_tunnel_{timestamp}"
    essid_name = f"TestTunnel{timestamp[-4:]}"

    # Build WLAN payload matching CNX Config API format
    wlan_payload = {
        "enable": True,
        "dot11k": True,
        "dot11r": True,
        "high-efficiency": {"enable": True},
        "max-clients-threshold": 64,
        "inactivity-timeout": 1000,
        "dtim-period": 1,
        "broadcast-filter-ipv4": "BCAST_FILTER_ARP",
        "broadcast-filter-ipv6": "UCAST_FILTER_RA",
        "dmo": {
            "enable": True,
            "channel-utilization-threshold": 90,
            "clients-threshold": 6
        },
        "ssid": ssid_name,
        "description": f"Test tunnel mode WLAN with gateway VLAN {target_vlan['id']}",
        "opmode": "WPA3_SAE",  # WPA3-Personal
        "forward-mode": "FORWARD_MODE_L2",  # Tunnel mode
        "essid": {"name": essid_name},
        "vlan-selector": "VLAN_RANGES",
        "vlan-id-range": [str(target_vlan['id'])],
        "personal-security": {
            "passphrase-format": "STRING",
            "wpa-passphrase": TEST_WLAN_PASSWORD
        }
    }

    console.print(f"[dim]WLAN Configuration:[/dim]")
    console.print(f"[dim]  SSID Name: {ssid_name}[/dim]")
    console.print(f"[dim]  ESSID (Broadcast): {essid_name}[/dim]")
    console.print(f"[dim]  Forward Mode: FORWARD_MODE_L2 (Tunneled)[/dim]")
    console.print(f"[dim]  Gateway: {gateway_name} ({gateway_serial})[/dim]")
    console.print(f"[dim]  VLAN ID: {target_vlan['id']} - {target_vlan['name']}[/dim]")
    console.print(f"[dim]  Auth: WPA3-Personal (WPA3_SAE)[/dim]\n")

    success, response = create_tunnel_wlan(ssid_name, wlan_payload, session_id)

    if success:
        console.print(f"[green]✓[/green] WLAN created successfully!")
        console.print(f"[green]WLAN Name:[/green] {ssid_name}")
        console.print(f"[green]ESSID:[/green] {essid_name}")
        console.print(f"[green]VLAN:[/green] {target_vlan['id']} - {target_vlan['name']}")
    else:
        console.print(f"[red]✗[/red] Failed to create WLAN")
        console.print(f"[red]Response:[/red] {response}")

    # Summary
    console.print("\n" + "="*60)
    console.print("[bold]TEST SUMMARY[/bold]")
    console.print("="*60)
    console.print(f"[cyan]Gateway VLANs Endpoint:[/cyan] ✓ Working")
    console.print(f"[cyan]VLANs Found:[/cyan] {len(vlans)}")
    console.print(f"[cyan]WLAN Creation:[/cyan] {'✓ Success' if success else '✗ Failed'}")

    if success:
        console.print("\n[bold green]✓ TUNNEL MODE VLAN SELECTION FEATURE IS WORKING![/bold green]")
        console.print("[dim]Users can now select VLANs that exist on the gateway for tunnel mode WLANs[/dim]")
    else:
        console.print("\n[bold yellow]⚠ WLAN creation failed - check error details above[/bold yellow]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Test interrupted by user[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Unexpected error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
