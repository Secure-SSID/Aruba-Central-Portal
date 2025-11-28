#!/usr/bin/env python3
"""
Debug script to find the correct gateway VLAN endpoint

Tests multiple potential VLAN API endpoints to identify which one successfully
returns VLAN configuration data. Useful for debugging API endpoint issues.

Usage:
    python scripts/network/wlan/debug_gateway_vlans.py
"""

import json
import traceback
from rich.console import Console
from rich.json import JSON
from utils.test_helpers import login_to_dashboard, get_first_gateway, DASHBOARD_API, api_request

console = Console()

def try_vlan_endpoints(gateway_serial, session_id):
    """Try different VLAN endpoints to find one that works"""

    headers = {'X-Session-ID': session_id}

    endpoints = [
        # CNX Config API attempts
        f"/config/gateways/{gateway_serial}",  # Full gateway config
        f"/config/gateway/{gateway_serial}/vlans",
        f"/config/vlans",
        f"/monitoring/gateways/{gateway_serial}/vlans",

        # Direct Aruba Central attempts (bypass our backend)
        "DIRECT:/network-config/v1alpha1/gateways",
        f"DIRECT:/network-config/v1alpha1/gateways/{gateway_serial}",
        f"DIRECT:/configuration/v1/gateways/{gateway_serial}",
        f"DIRECT:/configuration/v1/gateways/{gateway_serial}/vlans",
    ]

    results = []

    for endpoint in endpoints:
        console.print(f"\n[cyan]Testing:[/cyan] {endpoint}")

        try:
            if endpoint.startswith("DIRECT:"):
                # These would need direct API access - just note them
                console.print("[dim]  (Requires direct API access - not testing)[/dim]")
                continue

            response = requests.get(f"{DASHBOARD_API}{endpoint}", headers=headers)

            if response.status_code == 200:
                console.print(f"[green]✓ SUCCESS[/green] Status: {response.status_code}")
                data = response.json()

                # Check if response contains VLAN data
                has_vlans = False
                vlan_count = 0

                if isinstance(data, dict):
                    # Look for VLAN-related keys
                    for key in data.keys():
                        if 'vlan' in key.lower():
                            has_vlans = True
                            vlan_data = data[key]
                            if isinstance(vlan_data, list):
                                vlan_count = len(vlan_data)
                            console.print(f"[green]  Found VLAN key:[/green] {key}")
                            console.print(f"[dim]  Sample data: {str(vlan_data)[:200]}...[/dim]")

                results.append({
                    'endpoint': endpoint,
                    'status': 'SUCCESS',
                    'has_vlans': has_vlans,
                    'vlan_count': vlan_count,
                    'response_preview': str(data)[:500]
                })

                # Show full response if it has VLANs
                if has_vlans:
                    console.print("[green]Full response with VLANs:[/green]")
                    console.print(JSON(json.dumps(data, indent=2)))

            else:
                console.print(f"[yellow]✗ Failed[/yellow] Status: {response.status_code}")
                try:
                    error = response.json()
                    console.print(f"[dim]  Error: {error.get('message', str(error)[:100])}[/dim]")
                    results.append({
                        'endpoint': endpoint,
                        'status': 'FAILED',
                        'error': error.get('message', str(error))
                    })
                except Exception:
                    console.print(f"[dim]  Error: {response.text[:100]}[/dim]")
                    results.append({
                        'endpoint': endpoint,
                        'status': 'FAILED',
                        'error': response.text[:100]
                    })

        except Exception as e:
            console.print(f"[red]✗ Exception[/red] {str(e)}")
            results.append({
                'endpoint': endpoint,
                'status': 'EXCEPTION',
                'error': str(e)
            })

    return results

def main():
    console.print("[bold cyan]Gateway VLAN Endpoint Discovery[/bold cyan]\n")

    # Login
    console.print("[cyan]Step 1: Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()
    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        return
    console.print("[green]✓[/green] Authenticated\n")

    # Get gateway
    console.print("[cyan]Step 2: Getting gateway info...[/cyan]")
    gateway, error = get_first_gateway(session_id)
    if error:
        console.print(f"[red]Failed to get gateway:[/red] {error}")
        return

    gateway_serial = gateway.get('serialNumber', gateway.get('serial', ''))
    gateway_name = gateway.get('deviceName', gateway.get('name', 'Unknown'))

    console.print(f"[green]✓[/green] Found: {gateway_name} ({gateway_serial})\n")

    # Try endpoints
    console.print("[cyan]Step 3: Testing VLAN endpoints...[/cyan]")
    console.print("="*60)

    results = try_vlan_endpoints(gateway_serial, session_id)

    # Summary
    console.print("\n" + "="*60)
    console.print("[bold]SUMMARY[/bold]")
    console.print("="*60)

    successful = [r for r in results if r['status'] == 'SUCCESS']
    with_vlans = [r for r in results if r.get('has_vlans')]

    console.print(f"Total endpoints tested: {len(results)}")
    console.print(f"Successful responses: {len(successful)}")
    console.print(f"Responses with VLAN data: {len(with_vlans)}")

    if with_vlans:
        console.print("\n[bold green]✓ Found working endpoints with VLAN data:[/bold green]")
        for r in with_vlans:
            console.print(f"  • {r['endpoint']} ({r['vlan_count']} VLANs)")
    else:
        console.print("\n[bold yellow]⚠ No endpoints returned VLAN data[/bold yellow]")
        console.print("[dim]You may need to:[/dim]")
        console.print("[dim]  1. Configure VLANs on the gateway first[/dim]")
        console.print("[dim]  2. Check Aruba Central API documentation for VLAN endpoints[/dim]")
        console.print("[dim]  3. Use gateway full configuration and parse VLANs from it[/dim]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Unexpected error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
