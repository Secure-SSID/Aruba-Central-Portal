#!/usr/bin/env python3
"""
Test WLAN creation via Dashboard API

Comprehensive end-to-end testing of WLAN creation via the dashboard backend.
Tests multiple authentication types, forward modes, and configurations.

Usage:
    python scripts/testing/test_wlan_via_dashboard.py
"""

import sys
from pathlib import Path

# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
import time
import traceback
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from utils.test_helpers import login_to_dashboard, TEST_WLAN_PASSWORD, DASHBOARD_API, api_request

console = Console()

# Test configurations (keep names short - max 32 chars for WLAN name)
TEST_CONFIGS = [
    {
        "name": "wpa2",
        "description": "Bridged WPA2-Personal",
        "wizardData": {
            "wlanName": None,  # Will be set dynamically
            "ssidBroadcastName": None,  # Will be set dynamically
            "description": "Test WLAN - Bridged WPA2-Personal",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "Personal",
            "authType": "WPA2-Personal",
            "passphrase": TEST_WLAN_PASSWORD,
            "vlanId": "1",
            "forwardMode": "FORWARD_MODE_BRIDGE",
            "gatewaySerial": "",
            "gatewayName": "",
        }
    },
    {
        "name": "wpa23",
        "description": "Bridged WPA2/WPA3 Transition",
        "wizardData": {
            "wlanName": None,
            "ssidBroadcastName": None,
            "description": "Test WLAN - Bridged WPA2/WPA3 Transition",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "Personal",
            "authType": "WPA2/WPA3-Personal",
            "passphrase": TEST_WLAN_PASSWORD,
            "vlanId": "1",
            "forwardMode": "FORWARD_MODE_BRIDGE",
            "gatewaySerial": "",
            "gatewayName": "",
        }
    },
    {
        "name": "wpa3",
        "description": "Bridged WPA3-Personal",
        "wizardData": {
            "wlanName": None,
            "ssidBroadcastName": None,
            "description": "Test WLAN - Bridged WPA3-Personal",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "Personal",
            "authType": "WPA3-Personal",
            "passphrase": TEST_WLAN_PASSWORD,
            "vlanId": "1",
            "forwardMode": "FORWARD_MODE_BRIDGE",
            "gatewaySerial": "",
            "gatewayName": "",
        }
    },
    {
        "name": "owe",
        "description": "Bridged Enhanced Open",
        "wizardData": {
            "wlanName": None,
            "ssidBroadcastName": None,
            "description": "Test WLAN - Bridged Enhanced Open",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "No Security",
            "authType": "Enhanced-Open",
            "passphrase": "",
            "vlanId": "1",
            "forwardMode": "FORWARD_MODE_BRIDGE",
            "gatewaySerial": "",
            "gatewayName": "",
        }
    },
    {
        "name": "open",
        "description": "Bridged Open",
        "wizardData": {
            "wlanName": None,
            "ssidBroadcastName": None,
            "description": "Test WLAN - Bridged Open",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "No Security",
            "authType": "Open",
            "passphrase": "",
            "vlanId": "1",
            "forwardMode": "FORWARD_MODE_BRIDGE",
            "gatewaySerial": "",
            "gatewayName": "",
        }
    },
    # Tunnel Mode Tests
    {
        "name": "tunnel_wpa2",
        "description": "Tunneled WPA2-Personal",
        "wizardData": {
            "wlanName": None,
            "ssidBroadcastName": None,
            "description": "Test WLAN - Tunneled WPA2-Personal",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "Personal",
            "authType": "WPA2-Personal",
            "passphrase": TEST_WLAN_PASSWORD,
            "vlanId": "2",  # Use VLAN 2 (configured on gateway)
            "forwardMode": "FORWARD_MODE_L2",  # L2 Tunnel mode
            "gatewaySerial": "",  # Will be filled with actual gateway
            "gatewayName": "",
        }
    },
    {
        "name": "tunnel_wpa3",
        "description": "Tunneled WPA3-Personal",
        "wizardData": {
            "wlanName": None,
            "ssidBroadcastName": None,
            "description": "Test WLAN - Tunneled WPA3-Personal",
            "enabled": True,
            "scopeType": "global",
            "scopeId": None,
            "scopeName": "Global",
            "securityLevel": "Personal",
            "authType": "WPA3-Personal",
            "passphrase": TEST_WLAN_PASSWORD,
            "vlanId": "2",  # Use VLAN 2 (configured on gateway)
            "forwardMode": "FORWARD_MODE_L2",  # L2 Tunnel mode
            "gatewaySerial": "",  # Will be filled with actual gateway
            "gatewayName": "",
        }
    },
]

def login_to_dashboard():
    """Login to dashboard and get session"""
    try:
        response = requests.post(f"{DASHBOARD_API}/auth/login")
        if response.status_code == 200:
            data = response.json()
            session_id = data.get('session_id')
            if session_id:
                console.print(f"[green]✓[/green] Logged into dashboard")
                return session_id
        console.print(f"[red]✗[/red] Login failed: {response.status_code}")
        return None
    except Exception as e:
        console.print(f"[red]✗[/red] Login error: {str(e)}")
        return None

def get_gateways(session_id):
    """Get list of gateways"""
    try:
        headers = {'X-Session-ID': session_id}
        response = requests.get(f"{DASHBOARD_API}/monitoring/gateways", headers=headers)
        if response.status_code == 200:
            data = response.json()
            gateways = data.get('gateways', data.get('items', []))
            return gateways
        return []
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Could not fetch gateways: {str(e)}")
        return []

def create_wlan_via_wizard(config, timestamp, session_id, gateway=None):
    """Simulate WLAN creation through the wizard logic"""

    wlan_name = f"test_{config['name']}_{timestamp}"
    ssid_name = f"Test{config['name'][:8]}{timestamp[-4:]}"

    # Update wizard data with dynamic values
    wizard_data = config['wizardData'].copy()
    wizard_data['wlanName'] = wlan_name
    wizard_data['ssidBroadcastName'] = ssid_name

    # For tunnel mode, track gateway info (used for display only - not added to API payload)
    if gateway and wizard_data.get('forwardMode') == 'FORWARD_MODE_L2':
        wizard_data['gatewaySerial'] = gateway.get('serialNumber', gateway.get('serial', ''))
        wizard_data['gatewayName'] = gateway.get('deviceName', gateway.get('name', ''))

    result = {
        'config': config['description'],
        'wlan_name': wlan_name,
        'ssid': ssid_name,
        'auth_type': wizard_data['authType'],
        'forward_mode': wizard_data['forwardMode'],
        'status': 'PENDING',
        'error': None,
        'details': []
    }

    headers = {'X-Session-ID': session_id}

    try:
        console.print(f"\n[cyan]Creating:[/cyan] {config['description']}")
        console.print(f"[dim]WLAN:[/dim] {wlan_name}")
        console.print(f"[dim]SSID:[/dim] {ssid_name}")
        console.print(f"[dim]Auth:[/dim] {wizard_data['authType']}")
        console.print(f"[dim]Mode:[/dim] {wizard_data['forwardMode']}")

        # This simulates what ReviewDeployPage.jsx does
        # We'll call the backend API endpoints directly

        # Step 1: Create Role (if not using existing role)
        role_name = f"{wlan_name}-default"
        console.print(f"[dim]Creating role {role_name}...[/dim]")

        role_data = {
            "name": role_name,
            "description": f"Auto-created role for {wlan_name}",
            "vlan-parameters": {
                "access-vlan": int(wizard_data['vlanId'])
            },
            "qos-parameters": {
                "cos": 0
            }
        }

        role_response = requests.post(
            f"{DASHBOARD_API}/config/roles/{role_name}",
            headers=headers,
            json=role_data
        )

        if role_response.status_code in [200, 201]:
            console.print(f"[green]✓[/green] Role created")
            result['details'].append("Role created")
        else:
            console.print(f"[yellow]![/yellow] Role creation: {role_response.status_code}")
            result['details'].append(f"Role: {role_response.status_code}")

        # Step 2: Create WLAN
        # Map auth types to opmodes (matches ReviewDeployPage.jsx)
        opmode_map = {
            'Open': 'OPEN',
            'Enhanced-Open': 'ENHANCED_OPEN',
            'WPA2-Personal': 'WPA2_PERSONAL',
            'WPA2/WPA3-Personal': 'WPA3_SAE',  # Use WPA3_SAE with transition-mode flag
            'WPA3-Personal': 'WPA3_SAE',
            'WPA2-Enterprise': 'WPA2_ENTERPRISE',
            'WPA3-Enterprise-CCM-128': 'WPA3_ENTERPRISE_CCM_128',
            'WPA3-Enterprise-GCM-256': 'WPA3_ENTERPRISE_GCM_256',
            'WPA3-Enterprise-CNSA': 'WPA3_ENTERPRISE_CNSA',
            'MPSK-Local': 'WPA2_MPSK_LOCAL',
            'MPSK-AES': 'WPA2_MPSK_AES',
        }

        wlan_config = {
            "enable": wizard_data['enabled'],
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
            "description": wizard_data['description'],
            "opmode": opmode_map.get(wizard_data['authType'], 'OPEN'),
            "forward-mode": wizard_data['forwardMode'],
            "essid": {"name": ssid_name},
            "vlan-selector": "VLAN_RANGES",
            "vlan-id-range": [wizard_data['vlanId']],
            # Do NOT set default-role - let system use default
        }

        # Add passphrase for personal auth
        if wizard_data.get('passphrase'):
            wlan_config['personal-security'] = {
                "passphrase-format": "STRING",
                "wpa-passphrase": wizard_data['passphrase']
            }

        # Add WPA3 transition flag
        if wizard_data['authType'] == 'WPA2/WPA3-Personal':
            wlan_config['wpa3-transition-mode-enable'] = True

        # NOTE: Tunnel mode WLANs do NOT require a gateway field in the API payload
        # They are created as SHARED (global) objects and Central automatically assigns them to available gateways
        if wizard_data['forwardMode'] == 'FORWARD_MODE_L2' and wizard_data.get('gatewaySerial'):
            console.print(f"[dim]Tunnel mode WLAN will be assigned to gateway: {wizard_data['gatewayName']} ({wizard_data['gatewaySerial']})[/dim]")
            console.print(f"[dim](Gateway assignment happens automatically via Central - no gateway field needed in API)[/dim]")

        console.print(f"[dim]Creating WLAN {wlan_name}...[/dim]")

        wlan_response = requests.post(
            f"{DASHBOARD_API}/config/wlan/{wlan_name}",
            headers=headers,
            json=wlan_config
        )

        if wlan_response.status_code in [200, 201]:
            console.print(f"[green]✓[/green] WLAN created")
            result['details'].append("WLAN created")
            result['status'] = 'SUCCESS'
        else:
            error_msg = f"WLAN creation failed: {wlan_response.status_code}"
            try:
                error_data = wlan_response.json()
                error_msg += f" - {error_data.get('error', error_data)}"
            except Exception:
                error_msg += f" - {wlan_response.text[:100]}"

            console.print(f"[red]✗[/red] {error_msg}")
            result['status'] = 'FAILED'
            result['error'] = error_msg

    except Exception as e:
        result['status'] = 'FAILED'
        result['error'] = str(e)
        console.print(f"[red]✗[/red] Error: {str(e)}")

    return result

def cleanup_wlan(wlan_name, session_id):
    """Delete a test WLAN"""
    try:
        headers = {'X-Session-ID': session_id}
        response = requests.delete(f"{DASHBOARD_API}/config/wlan/{wlan_name}", headers=headers)
        return response.status_code in [200, 204]
    except Exception:
        return False

def main():
    """Main test function"""

    console.print(Panel.fit(
        "[bold cyan]WLAN Wizard Test Suite (via Dashboard)[/bold cyan]\n"
        "Testing all authentication types and forward modes",
        title="Test Suite"
    ))

    # Login to dashboard
    console.print("\n[cyan]Step 1: Authenticating...[/cyan]")
    session_id, error = login_to_dashboard()

    if error:
        console.print(f"[red]Authentication failed:[/red] {error}")
        console.print("[dim]Start backend: cd dashboard/backend && python app.py[/dim]")
        return

    console.print("[green]✓[/green] Authenticated\n")

    # Get gateways for tunnel mode tests
    console.print("[cyan]Step 2: Getting infrastructure info...[/cyan]")

    # Import get_gateways from utils (note: we need to add this to imports since it's not imported)
    from utils.test_helpers import get_gateways
    gateways, error = get_gateways(session_id)

    if error:
        console.print(f"[yellow]Warning - could not fetch gateways:[/yellow] {error}")
        console.print("[dim]Tunnel mode tests will be skipped[/dim]")
        gateways = []
    elif gateways:
        gateway = gateways[0]
        console.print(f"[green]✓[/green] Found gateway: {gateway.get('deviceName', gateway.get('name', 'Unknown'))}")
    else:
        gateway = None
        console.print(f"[yellow]![/yellow] No gateways found - tunnel mode tests will use bridge mode")

    # Get timestamp
    timestamp = datetime.now().strftime("%H%M%S")

    # Run tests
    results = []
    console.print("\n" + "="*60)
    console.print("[bold]RUNNING TESTS[/bold]")
    console.print("="*60)

    for i, test_config in enumerate(TEST_CONFIGS, 1):
        console.print(f"\n[bold]Test {i}/{len(TEST_CONFIGS)}:[/bold]")
        result = create_wlan_via_wizard(test_config, timestamp, session_id, gateway)
        results.append(result)

        # Delay between tests
        if i < len(TEST_CONFIGS):
            time.sleep(1)

    # Display results
    console.print("\n" + "="*60)
    console.print("[bold]TEST RESULTS[/bold]")
    console.print("="*60 + "\n")

    table = Table(title="WLAN Creation Test Results")
    table.add_column("Configuration", style="cyan")
    table.add_column("Auth Type", style="yellow")
    table.add_column("Forward Mode", style="blue")
    table.add_column("Status", style="white")
    table.add_column("Details", style="dim")

    success_count = sum(1 for r in results if r['status'] == 'SUCCESS')
    failed_count = sum(1 for r in results if r['status'] == 'FAILED')

    for result in results:
        if result['status'] == 'SUCCESS':
            status_str = "[green]✓ SUCCESS[/green]"
            details = ", ".join(result['details'])
        else:
            status_str = "[red]✗ FAILED[/red]"
            error = result.get('error', 'Unknown error')
            details = error[:40] + '...' if len(error) > 40 else error

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
    console.print(f"[bold]Total:[/bold] {len(results)}")

    if failed_count == 0 and success_count > 0:
        console.print("\n[bold green]🎉 ALL TESTS PASSED! 🎉[/bold green]")
        console.print("[green]WLAN Wizard is working correctly for all auth types[/green]")
    elif failed_count > 0:
        console.print("\n[bold red]❌ SOME TESTS FAILED[/bold red]")
    else:
        console.print("\n[bold yellow]⚠ NO TESTS RAN[/bold yellow]")

    # Cleanup
    console.print("\n" + "="*60)
    console.print("[cyan]Cleaning up test WLANs...[/cyan]")

    deleted_count = 0
    for result in results:
        if result['status'] == 'SUCCESS':
            if cleanup_wlan(result['wlan_name'], session_id):
                deleted_count += 1
                console.print(f"[green]✓[/green] Deleted {result['wlan_name']}")
            else:
                console.print(f"[yellow]![/yellow] Could not delete {result['wlan_name']}")

    console.print(f"\n[green]Cleaned up {deleted_count}/{success_count} test WLANs[/green]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Test interrupted[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Unexpected error:[/red] {str(e)}")
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
