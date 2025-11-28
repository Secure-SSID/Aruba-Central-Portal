#!/usr/bin/env python3
"""
Verify WLAN Deployment Script
Checks if a WLAN created via CNX Config API has been provisioned to APs
"""

import sys
import requests
import json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

def verify_wlan_on_devices(wlan_name, session_id=None):
    """
    Verify if a WLAN has been deployed to APs

    Args:
        wlan_name: Name of the WLAN to check
        session_id: Optional session ID for dashboard API authentication
    """

    base_url = "http://localhost:5000/api"
    headers = {}

    if session_id:
        headers['X-Session-ID'] = session_id

    console.print(Panel.fit(
        f"[bold cyan]WLAN Deployment Verification[/bold cyan]\n"
        f"Checking if WLAN '{wlan_name}' is deployed to devices",
        title="Verification Script"
    ))

    try:
        # Step 1: Verify WLAN exists in Central
        console.print(f"\n[cyan]Step 1:[/cyan] Checking if WLAN exists in Central...")
        wlan_response = requests.get(f"{base_url}/config/wlan/{wlan_name}", headers=headers)

        if wlan_response.status_code == 200:
            wlan_data = wlan_response.json()
            console.print(f"[green]✓[/green] WLAN '{wlan_name}' found in Central")
            console.print(f"[dim]SSID:[/dim] {wlan_data.get('essid', {}).get('name', 'N/A')}")
            console.print(f"[dim]Enabled:[/dim] {wlan_data.get('enable', False)}")
            console.print(f"[dim]Forward Mode:[/dim] {wlan_data.get('forward-mode', 'N/A')}")
        else:
            console.print(f"[red]✗[/red] WLAN '{wlan_name}' not found in Central")
            console.print(f"[dim]Response:[/dim] {wlan_response.status_code} - {wlan_response.text}")
            return

        # Step 2: Get all APs
        console.print(f"\n[cyan]Step 2:[/cyan] Getting list of APs...")
        aps_response = requests.get(f"{base_url}/aps", headers=headers)

        if aps_response.status_code != 200:
            console.print(f"[red]✗[/red] Failed to get APs: {aps_response.status_code}")
            return

        aps_data = aps_response.json()
        aps = aps_data.get('aps', aps_data.get('items', []))

        if not aps:
            console.print(f"[yellow]![/yellow] No APs found in the system")
            return

        console.print(f"[green]✓[/green] Found {len(aps)} APs")

        # Step 3: Check if WLAN is provisioned on APs
        console.print(f"\n[cyan]Step 3:[/cyan] Checking WLAN deployment on each AP...")

        table = Table(title=f"WLAN '{wlan_name}' Deployment Status")
        table.add_column("AP Name", style="cyan")
        table.add_column("Serial", style="dim")
        table.add_column("Site", style="yellow")
        table.add_column("Status", style="white")
        table.add_column("WLAN Deployed", style="white")

        deployed_count = 0

        for ap in aps[:10]:  # Check first 10 APs to avoid rate limiting
            ap_serial = ap.get('serial', ap.get('serialNumber', 'Unknown'))
            ap_name = ap.get('name', ap.get('hostname', 'Unknown'))
            ap_site = ap.get('site', 'N/A')
            ap_status = ap.get('status', 'Unknown')

            # Try to get AP's WLAN configuration
            try:
                ap_wlans_response = requests.get(
                    f"{base_url}/config/wireless/{ap_serial}/wlans",
                    headers=headers,
                    timeout=5
                )

                if ap_wlans_response.status_code == 200:
                    ap_wlans_data = ap_wlans_response.json()
                    wlan_names = []

                    # Extract WLAN names from response
                    if isinstance(ap_wlans_data, dict):
                        wlans_list = ap_wlans_data.get('items', ap_wlans_data.get('wlans', ap_wlans_data.get('wlan-ssid', [])))
                        if isinstance(wlans_list, list):
                            for w in wlans_list:
                                if isinstance(w, dict):
                                    name = w.get('ssid', w.get('name', ''))
                                    if name:
                                        wlan_names.append(name)

                    # Check if our WLAN is in the list
                    is_deployed = wlan_name in wlan_names

                    if is_deployed:
                        deployed_count += 1
                        table.add_row(
                            ap_name,
                            ap_serial,
                            ap_site,
                            ap_status,
                            "[green]✓ YES[/green]"
                        )
                    else:
                        table.add_row(
                            ap_name,
                            ap_serial,
                            ap_site,
                            ap_status,
                            f"[yellow]✗ NO[/yellow] ({len(wlan_names)} other WLANs)"
                        )
                else:
                    table.add_row(
                        ap_name,
                        ap_serial,
                        ap_site,
                        ap_status,
                        f"[dim]Unable to check ({ap_wlans_response.status_code})[/dim]"
                    )

            except Exception as e:
                table.add_row(
                    ap_name,
                    ap_serial,
                    ap_site,
                    ap_status,
                    f"[red]Error: {str(e)[:30]}[/red]"
                )

        console.print(table)

        # Summary
        console.print("\n" + "="*60)
        console.print("[bold]SUMMARY:[/bold]")
        console.print(f"✓ WLAN '{wlan_name}' exists in Central configuration")
        console.print(f"✓ Checked deployment on {min(len(aps), 10)} APs")

        if deployed_count > 0:
            console.print(f"[green]✓ WLAN is deployed on {deployed_count} AP(s)[/green]")
            console.print("\n[bold green]AUTO-PROVISIONING WORKING! ✓[/bold green]")
        else:
            console.print(f"[yellow]! WLAN not yet deployed to APs[/yellow]")
            console.print("\n[bold yellow]POSSIBLE REASONS:[/bold yellow]")
            console.print("1. APs haven't checked in with Central yet (wait 1-5 minutes)")
            console.print("2. WLAN not assigned to the same site as the APs")
            console.print("3. APs may be in different scope than WLAN assignment")
            console.print("4. Configuration sync delay - check again in a few minutes")

    except requests.exceptions.ConnectionError:
        console.print("[red]✗ Error:[/red] Cannot connect to dashboard backend")
        console.print("[dim]Ensure the backend is running: cd dashboard/backend && python app.py[/dim]")
    except Exception as e:
        console.print(f"[red]✗ Error:[/red] {str(e)}")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        console.print("[yellow]Usage:[/yellow] python verify_wlan_deployment.py <wlan_name> [session_id]")
        console.print("\n[bold]Examples:[/bold]")
        console.print("  python verify_wlan_deployment.py test-wlan-001")
        console.print("  python verify_wlan_deployment.py aruba-home abc123sessionid")
        sys.exit(1)

    wlan_name = sys.argv[1]
    session_id = sys.argv[2] if len(sys.argv) > 2 else None

    verify_wlan_on_devices(wlan_name, session_id)
