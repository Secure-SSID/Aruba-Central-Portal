#!/usr/bin/env python3
"""
Cleanup all test WLANs created during testing

Use this script after running test_wlan_via_dashboard.py or manual WLAN wizard
testing to remove all WLANs with names starting with "test_".

Requires:
    - Dashboard backend running (DASHBOARD_API_URL or default localhost:5000)
    - Valid authentication credentials

Example:
    python scripts/network/wlan/cleanup_test_wlans.py
"""

import traceback
from rich.console import Console
from rich.table import Table
from utils.test_helpers import login_to_dashboard, api_request, DASHBOARD_API

console = Console()


def get_all_wlans(session_id: str) -> tuple[list[dict], str | None]:
    """Get list of all WLANs from dashboard

    Args:
        session_id: Active session ID from login

    Returns:
        Tuple of (wlans_list, error_message):
        - (wlans, None) on success (empty list if no WLANs)
        - (None, error_message) on failure
    """
    headers = {'X-Session-ID': session_id}
    data, error = api_request('GET', f"{DASHBOARD_API}/config/wlans", headers=headers)

    if error:
        return None, error

    # Validate response structure
    if not isinstance(data, dict):
        return None, f"Invalid response type: expected dict, got {type(data).__name__}"

    # Handle different response formats
    wlans = data.get('items', data.get('wlans', []))

    if not isinstance(wlans, list):
        return None, f"Invalid WLANs format: expected list, got {type(wlans).__name__}"

    return wlans, None


def delete_wlan(wlan_name: str, session_id: str) -> tuple[bool, str | None]:
    """Delete a WLAN by name

    Args:
        wlan_name: Name of WLAN to delete
        session_id: Active session ID from login

    Returns:
        Tuple of (success, error_message):
        - (True, None) on success
        - (False, error_message) on failure
    """
    headers = {'X-Session-ID': session_id}
    data, error = api_request('DELETE', f"{DASHBOARD_API}/config/wlan/{wlan_name}", headers=headers)

    if error:
        return False, error

    return True, None

def main():
    console.print("[bold cyan]Test WLAN Cleanup Script[/bold cyan]\n")

    # Login
    console.print("[cyan]Step 1: Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()

    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        return

    console.print("[green]✓[/green] Authenticated\n")

    # Get all WLANs
    console.print("[cyan]Step 2: Fetching all WLANs...[/cyan]")
    wlans, error = get_all_wlans(session_id)

    if error:
        console.print(f"[red]Failed to fetch WLANs:[/red] {error}")
        return

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
    errors = []

    for wlan in test_wlans:
        if isinstance(wlan, dict):
            wlan_name = wlan.get('ssid', wlan.get('name', ''))
        else:
            wlan_name = wlan

        success, error = delete_wlan(wlan_name, session_id)
        if success:
            console.print(f"[green]✓[/green] Deleted: {wlan_name}")
            deleted_count += 1
        else:
            console.print(f"[red]✗[/red] Failed to delete: {wlan_name}")
            console.print(f"[dim]  Reason: {error}[/dim]")
            failed_count += 1
            errors.append((wlan_name, error))

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
        console.print("\n[yellow]Failure details:[/yellow]")
        for wlan_name, error in errors:
            console.print(f"  • {wlan_name}: {error}")
        console.print("\n[dim]You may need to delete these manually from Central UI[/dim]")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Cleanup interrupted by user[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Fatal error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
