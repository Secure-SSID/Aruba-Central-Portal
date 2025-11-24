#!/usr/bin/env python3
"""
Test the updated gateway VLAN endpoint
This should now successfully fetch VLANs using the correct API path
"""

import requests
from rich.console import Console
from rich.table import Table

console = Console()

DASHBOARD_API = "http://localhost:5000/api"

def login():
    """Login to dashboard"""
    response = requests.post(f"{DASHBOARD_API}/auth/login")
    if response.status_code == 200:
        return response.json().get('session_id')
    return None

def test_vlan_endpoint(session_id):
    """Test the gateway VLAN endpoint"""
    console.print("[cyan]Testing gateway VLAN endpoint...[/cyan]\n")

    # Use the gateway serial from your setup
    gateway_serial = "YOUR_GATEWAY_SERIAL_HERE"  # Replace with your gateway serial

    headers = {'X-Session-ID': session_id}
    response = requests.get(
        f"{DASHBOARD_API}/monitoring/gateways/{gateway_serial}/vlans",
        headers=headers
    )

    console.print(f"[cyan]Response Status:[/cyan] {response.status_code}\n")

    if response.status_code == 200:
        data = response.json()

        if 'vlans' in data and len(data['vlans']) > 0:
            console.print(f"[green]✓ SUCCESS![/green] Found {len(data['vlans'])} VLANs\n")

            # Display VLANs in a table
            table = Table(title="Gateway VLANs")
            table.add_column("VLAN ID", style="cyan", justify="center")
            table.add_column("Name", style="yellow")

            for vlan in data['vlans']:
                table.add_row(
                    str(vlan['id']),
                    vlan.get('name', 'N/A')
                )

            console.print(table)
            console.print()

            # Verify expected VLANs
            vlan_ids = [v['id'] for v in data['vlans']]
            console.print("[bold]Expected VLANs:[/bold] 200, 5, 1, 3334")
            console.print(f"[bold]Found VLANs:[/bold] {', '.join(map(str, sorted(vlan_ids)))}")

            if 200 in vlan_ids:
                console.print("\n[green]✓ VLAN 200 found! Ready for tunnel mode WLANs[/green]")
            else:
                console.print("\n[yellow]⚠ VLAN 200 not found[/yellow]")

            return True
        else:
            console.print("[yellow]⚠ No VLANs returned[/yellow]")
            console.print(f"Response: {data}")
            return False
    else:
        console.print("[red]✗ FAILED[/red]")
        try:
            error = response.json()
            console.print(f"[red]Error:[/red] {error}")
        except:
            console.print(f"[red]Error:[/red] {response.text}")
        return False

def main():
    console.print("[bold cyan]Test Gateway VLAN Endpoint Fix[/bold cyan]\n")

    # Login
    console.print("[cyan]Authenticating...[/cyan]")
    session_id = login()
    if not session_id:
        console.print("[red]Failed to authenticate[/red]")
        return
    console.print("[green]✓[/green] Authenticated\n")

    # Test VLAN endpoint
    success = test_vlan_endpoint(session_id)

    console.print("\n" + "="*60)
    if success:
        console.print("[bold green]✓ VLAN ENDPOINT WORKING![/bold green]")
        console.print("[dim]The WLAN wizard dropdown should now show VLANs[/dim]")
    else:
        console.print("[bold red]✗ VLAN endpoint not working yet[/bold red]")
        console.print("[dim]Check backend logs for errors[/dim]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Error:[/red] {str(e)}")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
