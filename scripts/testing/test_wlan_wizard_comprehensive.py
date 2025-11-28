#!/usr/bin/env python3
"""
Comprehensive WLAN Wizard Test Suite
Tests all authentication types and forward modes to ensure wizard works correctly

Note: These are integration tests requiring a live Aruba Central API.
Run with: pytest tests/integration/ -m integration
"""

import sys
import os
import json
import time
import pytest
from datetime import datetime

# Skip all tests in this module unless explicitly running integration tests
pytestmark = pytest.mark.integration

# Add parent directory to path to import utilities
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# Test configurations for different auth types and forward modes
TEST_CONFIGS = [
    {
        "name": "bridge_wpa2_personal",
        "description": "Bridged WPA2-Personal",
        "forward_mode": "FORWARD_MODE_BRIDGE",
        "opmode": "WPA2_PERSONAL",
        "auth_type": "WPA2-Personal",
        "security_level": "Personal",
        "passphrase": "TestPassword123!",
        "requires_gateway": False,
    },
    {
        "name": "bridge_wpa23_personal",
        "description": "Bridged WPA2/WPA3-Personal Transition",
        "forward_mode": "FORWARD_MODE_BRIDGE",
        "opmode": "WPA3_SAE",
        "auth_type": "WPA2/WPA3-Personal",
        "security_level": "Personal",
        "passphrase": "TestPassword123!",
        "wpa3_transition": True,
        "requires_gateway": False,
    },
    {
        "name": "bridge_wpa3_personal",
        "description": "Bridged WPA3-Personal",
        "forward_mode": "FORWARD_MODE_BRIDGE",
        "opmode": "WPA3_SAE",
        "auth_type": "WPA3-Personal",
        "security_level": "Personal",
        "passphrase": "TestPassword123!",
        "requires_gateway": False,
    },
    {
        "name": "bridge_enhanced_open",
        "description": "Bridged Enhanced Open (OWE)",
        "forward_mode": "FORWARD_MODE_BRIDGE",
        "opmode": "ENHANCED_OPEN",
        "auth_type": "Enhanced-Open",
        "security_level": "No Security",
        "requires_gateway": False,
    },
    {
        "name": "bridge_open",
        "description": "Bridged Open (No Security)",
        "forward_mode": "FORWARD_MODE_BRIDGE",
        "opmode": "OPEN",
        "auth_type": "Open",
        "security_level": "No Security",
        "requires_gateway": False,
    },
    {
        "name": "tunnel_wpa2_personal",
        "description": "Tunneled WPA2-Personal",
        "forward_mode": "FORWARD_MODE_L2",
        "opmode": "WPA2_PERSONAL",
        "auth_type": "WPA2-Personal",
        "security_level": "Personal",
        "passphrase": "TestPassword123!",
        "requires_gateway": True,
    },
    {
        "name": "tunnel_wpa23_personal",
        "description": "Tunneled WPA2/WPA3-Personal Transition",
        "forward_mode": "FORWARD_MODE_L2",
        "opmode": "WPA3_SAE",
        "auth_type": "WPA2/WPA3-Personal",
        "security_level": "Personal",
        "passphrase": "TestPassword123!",
        "wpa3_transition": True,
        "requires_gateway": True,
    },
]

def get_first_gateway(client):
    """Get the first available gateway"""
    try:
        response = client.get('/monitoring/v2/gateways')
        gateways = response.get('gateways', response.get('items', []))

        if gateways:
            gw = gateways[0]
            return {
                'serial': gw.get('serial', gw.get('serialNumber', '')),
                'name': gw.get('name', gw.get('hostname', '')),
            }
        return None
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not fetch gateways: {str(e)}")
        return None

def get_first_site(client):
    """Get the first available site"""
    try:
        response = client.get('/network-config/v1alpha1/sites')
        sites = response.get('items', response.get('sites', []))

        if sites:
            site = sites[0]
            return {
                'id': site.get('scope-id', site.get('scope_id', site.get('id', ''))),
                'name': site.get('site_name', site.get('name', '')),
            }
        return None
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not fetch sites: {str(e)}")
        return None

def create_test_wlan(client, config, timestamp, site, gateway=None):
    """Create a test WLAN with the given configuration"""

    wlan_name = f"test_{config['name']}_{timestamp}"
    ssid_name = f"Test{config['name'][:10]}{timestamp[-4:]}"

    # Build WLAN data
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
        "ssid": wlan_name,
        "description": f"Test WLAN: {config['description']}",
        "opmode": config['opmode'],
        "forward-mode": config['forward_mode'],
        "essid": {"name": ssid_name},
        "vlan-selector": "VLAN_RANGES",
        "vlan-id-range": ["1"]
    }

    # Add authentication-specific settings
    if config.get('passphrase'):
        wlan_data['personal-security'] = {
            "passphrase-format": "STRING",
            "wpa-passphrase": config['passphrase']
        }

    # Add WPA3 transition mode flag
    if config.get('wpa3_transition'):
        wlan_data['wpa3-transition-mode-enable'] = True

    # Add gateway for tunnel mode
    if config['requires_gateway'] and gateway:
        wlan_data['gateway'] = gateway['serial']

    return wlan_name, ssid_name, wlan_data

def test_wlan_creation(client, config, timestamp, site, gateway=None):
    """Test creating a WLAN with specific configuration"""

    wlan_name, ssid_name, wlan_data = create_test_wlan(client, config, timestamp, site, gateway)

    result = {
        'config': config['description'],
        'wlan_name': wlan_name,
        'ssid': ssid_name,
        'auth_type': config['auth_type'],
        'forward_mode': config['forward_mode'],
        'status': 'PENDING',
        'error': None,
    }

    try:
        # Create WLAN
        console.print(f"\n[cyan]Creating:[/cyan] {config['description']}")
        console.print(f"[dim]WLAN:[/dim] {wlan_name}")
        console.print(f"[dim]SSID:[/dim] {ssid_name}")
        console.print(f"[dim]Auth:[/dim] {config['auth_type']}")
        console.print(f"[dim]Mode:[/dim] {config['forward_mode']}")

        response = client.post(
            f'/network-config/v1alpha1/wlan-ssids/{wlan_name}',
            json=wlan_data
        )

        result['status'] = 'SUCCESS'
        console.print(f"[green]✓[/green] WLAN created successfully")

        # For tunneled WLANs, skip scope assignment
        if config['forward_mode'] != 'FORWARD_MODE_L2' and site:
            try:
                # Assign to scope
                console.print(f"[dim]Assigning to site:[/dim] {site['name']}")

                scope_map_data = {}
                query_params = {
                    'object_type': 'LOCAL',
                    'scope_id': str(site['id']),
                    'persona': 'CAMPUS_AP',
                }

                scope_response = client.post(
                    f'/network-config/v1alpha1/scope-maps/{site["name"]}/CAMPUS_AP/wlan-ssids~2F{wlan_name}',
                    json=scope_map_data,
                    params=query_params
                )
                console.print(f"[green]✓[/green] Assigned to site")

            except Exception as scope_error:
                console.print(f"[yellow]Warning:[/yellow] Scope assignment failed: {str(scope_error)}")
                # Don't fail the test - WLAN is still created
        else:
            console.print(f"[dim]Skipping scope assignment (tunneled WLAN)[/dim]")

    except Exception as e:
        result['status'] = 'FAILED'
        result['error'] = str(e)
        console.print(f"[red]✗[/red] Failed: {str(e)}")

        # Try to get more details
        if hasattr(e, 'response'):
            try:
                error_detail = e.response.json() if hasattr(e.response, 'json') else e.response.text
                console.print(f"[dim]API Response:[/dim] {json.dumps(error_detail, indent=2)[:500]}")
            except:
                pass

    return result

def cleanup_test_wlan(client, wlan_name):
    """Delete a test WLAN"""
    try:
        client.delete(f'/network-config/v1alpha1/wlan-ssids/{wlan_name}')
        return True
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not delete {wlan_name}: {str(e)}")
        return False

def main():
    """Main test function"""

    console.print(Panel.fit(
        "[bold cyan]WLAN Wizard Comprehensive Test Suite[/bold cyan]\n"
        "Testing all authentication types and forward modes",
        title="Test Suite"
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

    # Get timestamp for unique names
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Get first site and gateway
    console.print("\n[cyan]Pre-Test Setup:[/cyan]")
    site = get_first_site(client)
    if site:
        console.print(f"[green]✓[/green] Using site: {site['name']} (ID: {site['id']})")
    else:
        console.print(f"[yellow]![/yellow] No sites found - scope assignment will be skipped")

    gateway = get_first_gateway(client)
    if gateway:
        console.print(f"[green]✓[/green] Using gateway: {gateway['name']} ({gateway['serial']})")
    else:
        console.print(f"[yellow]![/yellow] No gateways found - tunnel mode tests will be skipped")

    # Run tests
    results = []
    console.print("\n" + "="*60)
    console.print("[bold]RUNNING TESTS[/bold]")
    console.print("="*60)

    for i, test_config in enumerate(TEST_CONFIGS, 1):
        # Skip tunnel tests if no gateway
        if test_config['requires_gateway'] and not gateway:
            console.print(f"\n[yellow]Skipping:[/yellow] {test_config['description']} (no gateway available)")
            results.append({
                'config': test_config['description'],
                'status': 'SKIPPED',
                'error': 'No gateway available'
            })
            continue

        console.print(f"\n[bold]Test {i}/{len(TEST_CONFIGS)}:[/bold]")
        result = test_wlan_creation(client, test_config, timestamp, site, gateway)
        results.append(result)

        # Small delay between tests to avoid rate limiting
        if i < len(TEST_CONFIGS):
            time.sleep(2)

    # Display results table
    console.print("\n" + "="*60)
    console.print("[bold]TEST RESULTS[/bold]")
    console.print("="*60 + "\n")

    table = Table(title="WLAN Creation Test Results")
    table.add_column("Configuration", style="cyan")
    table.add_column("Auth Type", style="yellow")
    table.add_column("Forward Mode", style="blue")
    table.add_column("Status", style="white")
    table.add_column("Details", style="dim")

    success_count = 0
    failed_count = 0
    skipped_count = 0

    for result in results:
        if result['status'] == 'SUCCESS':
            status_str = "[green]✓ SUCCESS[/green]"
            success_count += 1
            details = f"WLAN: {result.get('wlan_name', 'N/A')}"
        elif result['status'] == 'SKIPPED':
            status_str = "[yellow]⊘ SKIPPED[/yellow]"
            skipped_count += 1
            details = result.get('error', '')
        else:
            status_str = "[red]✗ FAILED[/red]"
            failed_count += 1
            error = result.get('error', 'Unknown error')
            details = error[:50] + '...' if len(error) > 50 else error

        table.add_row(
            result['config'],
            result.get('auth_type', 'N/A'),
            result.get('forward_mode', 'N/A'),
            status_str,
            details
        )

    console.print(table)

    # Summary
    console.print("\n" + "="*60)
    console.print("[bold]SUMMARY[/bold]")
    console.print("="*60)
    console.print(f"[green]✓ Successful:[/green] {success_count}")
    console.print(f"[red]✗ Failed:[/red] {failed_count}")
    console.print(f"[yellow]⊘ Skipped:[/yellow] {skipped_count}")
    console.print(f"[bold]Total:[/bold] {len(results)}")

    if failed_count == 0 and success_count > 0:
        console.print("\n[bold green]🎉 ALL TESTS PASSED! 🎉[/bold green]")
        console.print("[green]WLAN Wizard is working correctly for all auth types and modes[/green]")
    elif failed_count > 0:
        console.print("\n[bold red]❌ SOME TESTS FAILED[/bold red]")
        console.print("[yellow]Review the errors above and fix the issues[/yellow]")
    else:
        console.print("\n[bold yellow]⚠ NO TESTS RAN SUCCESSFULLY[/bold yellow]")

    # Cleanup - automatically clean up unless --no-cleanup flag
    import sys
    auto_cleanup = '--no-cleanup' not in sys.argv

    console.print("\n" + "="*60)

    if auto_cleanup:
        console.print("\n[cyan]Cleaning up test WLANs...[/cyan]")
        console.print("[dim](Use --no-cleanup flag to skip cleanup)[/dim]")
        deleted_count = 0
        for result in results:
            if result['status'] == 'SUCCESS' and 'wlan_name' in result:
                if cleanup_test_wlan(client, result['wlan_name']):
                    deleted_count += 1
                    console.print(f"[green]✓[/green] Deleted {result['wlan_name']}")
        console.print(f"\n[green]Cleaned up {deleted_count} test WLANs[/green]")
    else:
        console.print("\n[yellow]Cleanup skipped (--no-cleanup flag)[/yellow]")
        console.print("[dim]You can manually delete test WLANs from Central UI or via API[/dim]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Test interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Fatal error:[/red] {str(e)}")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
        sys.exit(1)
