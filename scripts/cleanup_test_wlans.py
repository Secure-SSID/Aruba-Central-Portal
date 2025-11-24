#!/usr/bin/env python3
"""
Cleanup all test WLANs created during testing
Deletes all WLANs starting with "test_"
"""

import requests
from rich.console import Console
from rich.table import Table

console = Console()

DASHBOARD_API = "http://localhost:5000/api"

def login_to_dashboard():
    """Login to dashboard and get session"""
    try:
        response = requests.post(f"{DASHBOARD_API}/auth/login")
        if response.status_code == 200:
            data = response.json()
            return data.get('session_id')
    except Exception as e:
        console.print(f"[red]Login failed:[/red] {str(e)}")
    return None

def get_all_wlans(session_id):
    """Get list of all WLANs"""
    try:
        headers = {'X-Session-ID': session_id}
        response = requests.get(f"{DASHBOARD_API}/config/wlans", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return data.get('items', data.get('wlans', []))
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not fetch WLANs: {str(e)}")
    return []

def delete_wlan(wlan_name, session_id):
    """Delete a WLAN"""
    try:
        headers = {'X-Session-ID': session_id}
        response = requests.delete(f"{DASHBOARD_API}/config/wlan/{wlan_name}", headers=headers)
        return response.status_code in [200, 204]
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not delete {wlan_name}: {str(e)}")
        return False

def main():
    console.print("[bold cyan]Test WLAN Cleanup Script[/bold cyan]\n")

    # Login
    console.print("[cyan]Step 1: Authenticating...[/cyan]")
    session_id = login_to_dashboard()

    if not session_id:
        console.print("[red]Failed to authenticate. Ensure dashboard backend is running.[/red]")
        return

    console.print("[green]✓[/green] Authenticated\n")

    # Get all WLANs
    console.print("[cyan]Step 2: Fetching all WLANs...[/cyan]")
    wlans = get_all_wlans(session_id)

    # Filter test WLANs (starting with "test_")
    test_wlans = [w for w in wlans if isinstance(w, dict) and w.get('ssid', '').startswith('test_')]

    # Also check if they have name field
    if not test_wlans:
        test_wlans = [w for w in wlans if isinstance(w, dict) and w.get('name', '').startswith('test_')]

    # Also check direct string names in list
    if not test_wlans:
        test_wlans = [w for w in wlans if isinstance(w, str) and w.startswith('test_')]

    if not test_wlans:
        console.print("[green]✓[/green] No test WLANs found to clean up\n")
        return

    console.print(f"[yellow]Found {len(test_wlans)} test WLAN(s) to delete[/yellow]\n")

    # Display WLANs to be deleted
    table = Table(title="WLANs to Delete")
    table.add_column("WLAN Name", style="cyan")
    table.add_column("SSID", style="yellow")

    for wlan in test_wlans:
        if isinstance(wlan, dict):
            wlan_name = wlan.get('ssid', wlan.get('name', 'Unknown'))
            ssid = wlan.get('essid', {}).get('name', wlan.get('ssid', 'Unknown'))
        else:
            wlan_name = wlan
            ssid = wlan
        table.add_row(wlan_name, ssid)

    console.print(table)
    console.print()

    # Delete each WLAN
    console.print("[cyan]Step 3: Deleting WLANs...[/cyan]")
    deleted_count = 0
    failed_count = 0

    for wlan in test_wlans:
        if isinstance(wlan, dict):
            wlan_name = wlan.get('ssid', wlan.get('name', ''))
        else:
            wlan_name = wlan

        if delete_wlan(wlan_name, session_id):
            console.print(f"[green]✓[/green] Deleted: {wlan_name}")
            deleted_count += 1
        else:
            console.print(f"[red]✗[/red] Failed to delete: {wlan_name}")
            failed_count += 1

    # Summary
    console.print("\n" + "="*60)
    console.print("[bold]CLEANUP SUMMARY[/bold]")
    console.print("="*60)
    console.print(f"[green]✓ Deleted:[/green] {deleted_count}")
    console.print(f"[red]✗ Failed:[/red] {failed_count}")
    console.print(f"[bold]Total:[/bold] {len(test_wlans)}")

    if deleted_count == len(test_wlans):
        console.print("\n[bold green]✓ ALL TEST WLANS CLEANED UP![/bold green]")
    elif failed_count > 0:
        console.print("\n[bold yellow]⚠ Some WLANs could not be deleted[/bold yellow]")
        console.print("[dim]You may need to delete them manually from Central UI[/dim]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Cleanup interrupted by user[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Fatal error:[/red] {str(e)}")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
