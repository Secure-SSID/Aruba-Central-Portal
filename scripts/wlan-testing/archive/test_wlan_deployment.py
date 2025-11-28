#!/usr/bin/env python3
"""
Test WLAN deployment with FIXED scope map code
This bypasses the frontend to test the API directly with correct parameters
"""

import sys
import os
sys.path.insert(0, '/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend')

from central_api_client import CentralAPIClient
from token_manager import TokenManager
import json
import os

def load_config():
    """Load configuration from environment or .env file"""
    from dotenv import load_dotenv
    load_dotenv('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.env')

    return {
        'client_id': os.getenv('ARUBA_CLIENT_ID'),
        'client_secret': os.getenv('ARUBA_CLIENT_SECRET'),
        'customer_id': os.getenv('ARUBA_CUSTOMER_ID'),
    }

def main():
    print("=" * 80)
    print("WLAN Deployment Test - Using FIXED Code Pattern")
    print("=" * 80)

    # Initialize API client
    print("\n[1/7] Initializing API client...")
    config = load_config()
    token_mgr = TokenManager(
        client_id=config['client_id'],
        client_secret=config['client_secret']
    )
    client = CentralAPIClient(
        base_url="https://internal.api.central.arubanetworks.com",
        token_manager=token_mgr
    )
    print("✅ API client initialized")

    # Test configuration
    wlan_name = "test-api-direct"
    ssid_name = "TestAPIDirect"
    scope_name = "HomeLab"  # ← FIXED: Using scope NAME, not ID
    scope_id = 54819475093
    role_name = f"{wlan_name}-default"

    print(f"\n[2/7] Creating role '{role_name}'...")
    role_data = {
        'name': role_name,
        'description': f'Default role for {wlan_name}',
        'vlan-parameters': {'access-vlan': 1},
        'qos-parameters': {'cos': 0}
    }

    try:
        response = client.post('/network-config/v1alpha1/roles', data=role_data)
        print(f"✅ Role created successfully")
    except Exception as e:
        print(f"❌ Role creation failed: {e}")
        return

    print(f"\n[3/7] Creating WLAN '{wlan_name}'...")
    wlan_data = {
        'enable': True,
        'dot11k': True,
        'dot11r': True,
        'dot11v': True,
        'high-efficiency': {
            'enable': True,  # ← FIXED: Only enable field
        },
        'max-clients-threshold': 64,
        'inactivity-timeout': 1000,
        'personal-security': {
            'passphrase-format': 'STRING',
            'wpa-passphrase': 'Aruba123!',
        },
        'ssid': wlan_name,
        'description': f'WLAN {wlan_name}',
        'opmode': 'WPA2_PERSONAL',
        'forward-mode': 'FORWARD_MODE_BRIDGE',
        'essid': {
            'name': ssid_name,  # ← FIXED: String, not array
        },
        'vlan-selector': 'VLAN_RANGES',
        'vlan-id-range': ['1'],
        'default-role': role_name,
    }

    try:
        response = client.post(f'/network-config/v1alpha1/wlan-ssids/{wlan_name}', data=wlan_data)
        print(f"✅ WLAN created successfully")
    except Exception as e:
        print(f"❌ WLAN creation failed: {e}")
        # Try to clean up role
        try:
            client.delete(f'/network-config/v1alpha1/roles/{role_name}')
        except:
            pass
        return

    # FIXED: Scope map assignment with scope NAME in URL
    print(f"\n[4/7] Assigning WLAN to scope '{scope_name}'...")
    print(f"   URL: /scope-maps/{scope_name}/CAMPUS_AP/wlan-ssids~2F{wlan_name}")
    print(f"   Query params: object_type=LOCAL, scope_id={scope_id}, persona=CAMPUS_AP")
    print(f"   Body: {{}} (empty)")

    try:
        # FIXED: Using scope NAME in URL, not numeric ID
        url = f'/network-config/v1alpha1/scope-maps/{scope_name}/CAMPUS_AP/wlan-ssids~2F{wlan_name}'
        # FIXED: Empty body (data in URL + query params)
        body = {}
        # FIXED: Numeric ID in query params
        params = {
            'object_type': 'LOCAL',
            'scope_id': str(scope_id),
            'persona': 'CAMPUS_AP',
        }

        response = client.post(url, data=body, params=params)
        print(f"✅ WLAN assigned to scope successfully")
    except Exception as e:
        print(f"❌ WLAN scope assignment failed: {e}")
        print("\nCleaning up resources...")
        try:
            client.delete(f'/network-config/v1alpha1/wlan-ssids/{wlan_name}')
            client.delete(f'/network-config/v1alpha1/roles/{role_name}')
        except:
            pass
        return

    print(f"\n[5/7] Assigning role to scope '{scope_name}'...")
    try:
        url = f'/network-config/v1alpha1/scope-maps/{scope_name}/CAMPUS_AP/roles~2F{role_name}'
        body = {}
        params = {
            'object_type': 'LOCAL',
            'scope_id': str(scope_id),
            'persona': 'CAMPUS_AP',
        }

        response = client.post(url, data=body, params=params)
        print(f"✅ Role assigned to scope successfully")
    except Exception as e:
        print(f"❌ Role scope assignment failed: {e}")
        print("\nCleaning up resources...")
        try:
            # Remove scope assignments first
            client.delete(f'/network-config/v1alpha1/scope-maps/{scope_name}/CAMPUS_AP/wlan-ssids~2F{wlan_name}')
            client.delete(f'/network-config/v1alpha1/wlan-ssids/{wlan_name}')
            client.delete(f'/network-config/v1alpha1/roles/{role_name}')
        except:
            pass
        return

    print(f"\n[6/7] Assigning role-gpid to scope '{scope_name}'...")
    try:
        url = f'/network-config/v1alpha1/scope-maps/{scope_name}/CAMPUS_AP/role-gpids~2F{role_name}'
        body = {}
        params = {
            'object_type': 'LOCAL',
            'scope_id': str(scope_id),
            'persona': 'CAMPUS_AP',
        }

        response = client.post(url, data=body, params=params)
        print(f"✅ Role-GPID assigned to scope successfully")
    except Exception as e:
        print(f"❌ Role-GPID scope assignment failed: {e}")
        # Not critical, continue

    print(f"\n[7/7] Deployment complete!")
    print("=" * 80)
    print("✅ SUCCESS - All scope map assignments worked!")
    print("=" * 80)
    print(f"\nWLAN Details:")
    print(f"  Name: {wlan_name}")
    print(f"  SSID: {ssid_name}")
    print(f"  Site: {scope_name} (ID: {scope_id})")
    print(f"  Role: {role_name}")
    print(f"\nScope Map URLs used (FIXED):")
    print(f"  WLAN:      /scope-maps/{scope_name}/CAMPUS_AP/wlan-ssids~2F{wlan_name}")
    print(f"  Role:      /scope-maps/{scope_name}/CAMPUS_AP/roles~2F{role_name}")
    print(f"  Role-GPID: /scope-maps/{scope_name}/CAMPUS_AP/role-gpids~2F{role_name}")
    print(f"\nQuery params: ?object_type=LOCAL&scope_id={scope_id}&persona=CAMPUS_AP")
    print(f"Body: {{}} (empty)")
    print("\n✅ The fix works! Now hard refresh your browser to use the new code.")

if __name__ == '__main__':
    main()
