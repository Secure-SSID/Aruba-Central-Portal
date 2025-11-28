#!/usr/bin/env python3
"""Test scope map creation directly using backend API client"""

import sys
import os
sys.path.insert(0, '/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend')

from central_api_client import CentralAPIClient
from token_manager import TokenManager
from dotenv import load_dotenv

# Load environment
load_dotenv('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.env')

def main():
    print("=" * 80)
    print("Testing Scope Map API Call")
    print("=" * 80)

    # Initialize API client
    token_mgr = TokenManager(
        client_id=os.getenv('ARUBA_CLIENT_ID'),
        client_secret=os.getenv('ARUBA_CLIENT_SECRET')
    )
    client = CentralAPIClient(
        base_url="https://internal.api.central.arubanetworks.com",
        token_manager=token_mgr
    )

    # Create a test WLAN first
    wlan_name = "test-scope-api"
    print(f"\nStep 1: Creating test WLAN '{wlan_name}'...")
    wlan_data = {
        'enable': True,
        'dot11k': True,
        'dot11r': True,
        'dot11v': True,
        'high-efficiency': {'enable': True},
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
        'essid': {'name': wlan_name},
        'vlan-selector': 'VLAN_RANGES',
        'vlan-id-range': ['1'],
        'default-role': 'logread',  # Using existing role
    }

    try:
        response = client.post(f'/network-config/v1alpha1/wlan-ssids/{wlan_name}', data=wlan_data)
        print(f"✅ WLAN created")
    except Exception as e:
        if "already exists" in str(e):
            print(f"⚠️  WLAN already exists (will use it)")
        else:
            print(f"❌ Failed to create WLAN: {e}")
            return

    # Test parameters
    scope_name = "HomeLab"
    scope_id = "54819475093"
    persona = "CAMPUS_AP"
    resource = f"wlan-ssids/{wlan_name}"

    print(f"\nTest 1: Using scope NAME in URL with query params")
    print(f"  URL: /network-config/v1alpha1/scope-maps/{scope_name}/{persona}/{resource}")
    print(f"  Query params: object_type=LOCAL, scope_id={scope_id}, persona={persona}")
    print(f"  Body: {{}}")

    try:
        url = f'/network-config/v1alpha1/scope-maps/{scope_name}/{persona}/{resource}'
        params = {
            'object_type': 'LOCAL',
            'scope_id': scope_id,
            'persona': persona
        }
        body = {}

        response = client.post(url, data=body, params=params)
        print(f"\n✅ SUCCESS!")
        print(f"   Response: {response}")
    except Exception as e:
        print(f"\n❌ FAILED!")
        print(f"   Error: {e}")

        # Try without persona in query params
        print(f"\n\nTest 2: WITHOUT persona in query params")
        print(f"  Query params: object_type=LOCAL, scope_id={scope_id}")
        try:
            params2 = {
                'object_type': 'LOCAL',
                'scope_id': scope_id
            }
            response = client.post(url, data=body, params=params2)
            print(f"\n✅ SUCCESS!")
            print(f"   Response: {response}")
        except Exception as e2:
            print(f"\n❌ FAILED!")
            print(f"   Error: {e2}")

            # Try with URL-decoded resource path
            print(f"\n\nTest 3: With URL-decoded resource path (/ instead of ~2F)")
            resource3 = "wlan-ssids/test-scope-api"
            url3 = f'/network-config/v1alpha1/scope-maps/{scope_name}/{persona}/wlan-ssids/test-scope-api'
            print(f"  URL: {url3}")
            try:
                params3 = {
                    'object_type': 'LOCAL',
                    'scope_id': scope_id,
                    'persona': persona
                }
                response = client.post(url3, data=body, params=params3)
                print(f"\n✅ SUCCESS!")
                print(f"   Response: {response}")
            except Exception as e3:
                print(f"\n❌ FAILED!")
                print(f"   Error: {e3}")

if __name__ == '__main__':
    main()
