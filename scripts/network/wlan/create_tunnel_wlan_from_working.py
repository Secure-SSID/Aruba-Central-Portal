#!/usr/bin/env python3
"""
Create tunnel mode WLAN using working aruba-home config as template

This script creates a test tunnel mode WLAN using a known-working configuration
as a template. Useful for validating that the WLAN creation API works correctly.

Usage:
    python scripts/network/wlan/create_tunnel_wlan_from_working.py
"""

import traceback
from rich.console import Console
from datetime import datetime
from utils.test_helpers import login_to_dashboard, TEST_WLAN_PASSWORD, DASHBOARD_API, api_request

console = Console()

def create_tunnel_wlan_like_aruba_home(session_id):
    """Create a tunnel mode WLAN using the working aruba-home config as template"""

    timestamp = datetime.now().strftime("%H%M%S")
    ssid_name = f"test_tunnel_{timestamp}"
    essid_name = f"TestTunnel{timestamp[-4:]}"

    # Based on working aruba-home config
    wlan_config = {
        "ssid": ssid_name,
        "enable": True,
        "forward-mode": "FORWARD_MODE_L2",  # Tunnel mode
        "cluster-preemption": False,
        "dmo": {
            "enable": True,
            "channel-utilization-threshold": 90,
            "clients-threshold": 6
        },
        "broadcast-filter-ipv4": "BCAST_FILTER_ARP",
        "broadcast-filter-ipv6": "UCAST_FILTER_RA",
        "optimize-mcast-rate": False,
        "ssid-utf8": True,
        "essid": {
            "use-alias": False,
            "name": essid_name
        },
        "advertise-apname": False,
        "disable-on-6ghz-mesh": False,
        "dot11k": True,
        "dot11r": False,  # Changed from True to match working config
        "dtim-period": 1,
        "ftm-responder": False,
        "hide-ssid": False,
        "auth-req-thresh": 0,
        "explicit-ageout-client": False,
        "inactivity-timeout": 1000,
        "local-probe-req-thresh": 0,
        "max-clients-threshold": 1024,  # Increased from 64
        "rf-band": "BAND_ALL",
        "rrm-quiet-ie": False,
        "high-throughput": {
            "enable": True,
            "very-high-throughput": True
        },
        "g-legacy-rates": {
            "basic-rates": ["RATE_12MB", "RATE_24MB"],
            "tx-rates": ["RATE_12MB", "RATE_18MB", "RATE_24MB", "RATE_36MB", "RATE_48MB", "RATE_54MB"]
        },
        "a-legacy-rates": {
            "basic-rates": ["RATE_12MB", "RATE_24MB"],
            "tx-rates": ["RATE_12MB", "RATE_18MB", "RATE_24MB", "RATE_36MB", "RATE_48MB", "RATE_54MB"]
        },
        "high-efficiency": {
            "enable": True
        },
        "extremely-high-throughput": {
            "enable": True,
            "mlo": False,
            "beacon-protection": False
        },
        "advertise-timing": False,
        "opmode": "WPA3_SAE",
        "mac-authentication": True,  # Added from working config
        "personal-security": {
            "passphrase-format": "STRING",
            "wpa-passphrase": TEST_WLAN_PASSWORD
        },
        "gw-auth-server": "default",  # Added from working config
        "auth-server-group": "sys_central_nac",  # Added from working config
        "cloud-auth": True,  # Added from working config
        "radius-accounting": True,  # Added from working config
        "acct-server-group": "sys_central_nac",  # Added from working config
        "wpa3-transition-mode-enable": True,
        "enforce-dhcp": False,
        "pan": False,
        "vlan-selector": "VLAN_RANGES",
        "vlan-id-range": ["200"],  # Using VLAN 200 like aruba-home
        "out-of-service": "TUNNEL_DOWN",
        "client-isolation": False
    }

    console.print("[cyan]Creating tunnel mode WLAN with working config template...[/cyan]")
    console.print(f"[dim]SSID: {ssid_name}[/dim]")
    console.print(f"[dim]ESSID: {essid_name}[/dim]")
    console.print(f"[dim]VLAN: 200 (same as aruba-home)[/dim]")
    console.print(f"[dim]Mode: Tunneled (L2)[/dim]\n")

    headers = {'X-Session-ID': session_id, 'Content-Type': 'application/json'}
    response = requests.post(
        f"{DASHBOARD_API}/config/wlan/{ssid_name}",
        headers=headers,
        json=wlan_config
    )

    console.print(f"Response status: {response.status_code}")

    if response.status_code in [200, 201]:
        console.print(f"[green]✓ SUCCESS![/green]")
        console.print(f"[green]Created tunnel mode WLAN: {ssid_name}[/green]")
        return True
    else:
        console.print(f"[red]✗ FAILED[/red]")
        try:
            error = response.json()
            console.print(f"[red]Error:[/red] {error}")
        except Exception:
            console.print(f"[red]Error:[/red] {response.text[:200]}")
        return False

def main():
    console.print("[bold cyan]Create Tunnel Mode WLAN (Using Working Config)[/bold cyan]\n")

    # Login
    console.print("[cyan]Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()
    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        return
    console.print("[green]✓[/green] Authenticated\n")

    # Create WLAN
    success = create_tunnel_wlan_like_aruba_home(session_id)

    console.print("\n" + "="*60)
    if success:
        console.print("[bold green]✓ TUNNEL MODE WLAN CREATED SUCCESSFULLY![/bold green]")
        console.print("[dim]Check Aruba Central to verify it appears[/dim]")
    else:
        console.print("[bold red]✗ WLAN creation failed[/bold red]")
        console.print("[dim]Check error message above for details[/dim]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Unexpected error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
