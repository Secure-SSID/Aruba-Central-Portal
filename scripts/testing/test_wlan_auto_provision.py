#!/usr/bin/env python3
"""
Test script to create a WLAN via CNX Config API and verify auto-provisioning
This script helps understand if WLANs automatically deploy to devices or if
an additional commit/provision step is required.
"""

import sys
import os
import json
import time
from datetime import datetime

# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()


def main():
    """Test WLAN creation and auto-provisioning workflow"""

    console.print(Panel.fit(
        "[bold cyan]WLAN Auto-Provisioning Test[/bold cyan]\n"
        "Testing WLAN creation and deployment to devices",
        title="Test Script"
    ))

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

    # Test WLAN name (using timestamp to avoid conflicts)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_wlan_name = f"test_auto_provision_{timestamp}"
    test_ssid = f"TestAuto{timestamp[-4:]}"

    console.print(f"\n[yellow]Test WLAN:[/yellow] {test_wlan_name}")
    console.print(f"[yellow]Test SSID:[/yellow] {test_ssid}")

    try:
        # Step 1: Get sites to find a valid site ID
        console.print("\n[cyan]Step 1:[/cyan] Getting sites...")
        sites_response = client.get('/network-config/v1alpha1/sites')
        sites = sites_response.get('items', sites_response.get('sites', []))

        if not sites:
            console.print("[red]Error:[/red] No sites found. Cannot test scope assignment.")
            return

        # Use first site for testing
        test_site = sites[0]
        site_name = test_site.get('site_name', test_site.get('name', ''))
        site_id = test_site.get('scope-id', test_site.get('scope_id', test_site.get('id', '')))

        console.print(f"[green]✓[/green] Using site: {site_name} (ID: {site_id})")

        # Step 2: Create WLAN
        console.print(f"\n[cyan]Step 2:[/cyan] Creating WLAN {test_wlan_name}...")

        wlan_data = {
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
            "personal-security": {
                "passphrase-format": "STRING",
                "wpa-passphrase": "TestPassword123!"
            },
            "ssid": test_wlan_name,
            "description": f"Auto-provision test WLAN created at {datetime.now()}",
            "opmode": "WPA2_PERSONAL",
            "forward-mode": "FORWARD_MODE_BRIDGE",
            "essid": {"name": test_ssid},
            "vlan-selector": "VLAN_RANGES",
            "vlan-id-range": ["1"]
        }

        wlan_response = client.post(
            f'/network-config/v1alpha1/wlan-ssids/{test_wlan_name}',
            data=wlan_data
        )
        console.print(f"[green]✓[/green] WLAN created successfully")
        console.print(f"[dim]Response:[/dim] {json.dumps(wlan_response, indent=2)[:200]}...")

        # Step 3: Check if WLAN appears in device configurations
        console.print(f"\n[cyan]Step 3:[/cyan] Waiting 5 seconds for auto-provisioning...")
        time.sleep(5)

        # Get APs to check if WLAN is provisioned
        console.print(f"\n[cyan]Step 4:[/cyan] Checking if WLAN appears on APs...")
        try:
            aps_response = client.get('/monitoring/v2/aps')
            aps = aps_response.get('aps', aps_response.get('items', []))

            if aps:
                # Check first AP's WLAN configuration
                first_ap = aps[0]
                ap_serial = first_ap.get('serial', first_ap.get('serialNumber', ''))
                ap_name = first_ap.get('name', first_ap.get('hostname', ''))

                console.print(f"[yellow]Checking AP:[/yellow] {ap_name} ({ap_serial})")

                # Try to get AP's WLAN configuration
                try:
                    ap_wlans = client.get(f'/network-config/v1alpha1/wireless/{ap_serial}/wlans')
                    console.print(f"[green]✓[/green] Retrieved AP WLAN configuration")

                    # Check if our test WLAN is in the list
                    wlan_names = [w.get('ssid', '') for w in ap_wlans.get('items', ap_wlans.get('wlans', []))]

                    if test_wlan_name in wlan_names:
                        console.print(f"[green]✓ WLAN IS PROVISIONED[/green] - Found on AP!")
                    else:
                        console.print(f"[yellow]✗ WLAN NOT YET PROVISIONED[/yellow] - Not found on AP")
                        console.print(f"[dim]AP has WLANs:[/dim] {', '.join(wlan_names[:5])}...")

                except Exception as e:
                    console.print(f"[yellow]Could not check AP WLANs:[/yellow] {str(e)}")

            else:
                console.print("[yellow]No APs found to check provisioning status[/yellow]")

        except Exception as e:
            console.print(f"[yellow]Could not check APs:[/yellow] {str(e)}")

        # Step 5: Look for commit/provision API endpoints
        console.print(f"\n[cyan]Step 5:[/cyan] Searching for commit/provision endpoints...")

        # Try common endpoint patterns
        provision_endpoints = [
            '/network-config/v1alpha1/commit',
            '/network-config/v1alpha1/auto-commit',
            '/network-config/v1alpha1/provision',
            '/network-config/v1alpha1/deploy',
            '/configuration/v1/auto_commit',
            '/configuration/v1/commit',
        ]

        for endpoint in provision_endpoints:
            try:
                # Try GET to see if endpoint exists
                response = client.get(endpoint)
                console.print(f"[green]✓ Found endpoint:[/green] {endpoint}")
                console.print(f"[dim]Response:[/dim] {json.dumps(response, indent=2)[:200]}")
                break
            except Exception as e:
                if hasattr(e, 'response') and e.response.status_code == 404:
                    console.print(f"[dim]✗ Not found:[/dim] {endpoint}")
                else:
                    console.print(f"[yellow]Error checking {endpoint}:[/yellow] {str(e)}")

        # Step 6: Cleanup - Delete test WLAN
        console.print(f"\n[cyan]Step 6:[/cyan] Cleaning up - deleting test WLAN...")
        try:
            delete_response = client.delete(f'/network-config/v1alpha1/wlan-ssids/{test_wlan_name}')
            console.print(f"[green]✓[/green] Test WLAN deleted successfully")
        except Exception as e:
            console.print(f"[yellow]Warning:[/yellow] Could not delete test WLAN: {str(e)}")

        # Summary
        console.print("\n" + "="*60)
        console.print("[bold]SUMMARY:[/bold]")
        console.print("1. ✓ WLAN created successfully via CNX Config API")
        console.print("2. ? Auto-provisioning status unclear - needs manual verification")
        console.print("3. ? No obvious commit/provision endpoint found")
        console.print("\n[bold yellow]Recommendation:[/bold yellow]")
        console.print("Check Aruba Central UI to see if WLANs appear on APs automatically,")
        console.print("or if a manual 'commit' or 'deploy' action is required.")

    except Exception as e:
        console.print(f"\n[red]Error:[/red] {str(e)}")
        if hasattr(e, 'response'):
            console.print(f"[red]Response:[/red] {e.response.text if hasattr(e.response, 'text') else e.response}")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")

if __name__ == "__main__":
    main()
