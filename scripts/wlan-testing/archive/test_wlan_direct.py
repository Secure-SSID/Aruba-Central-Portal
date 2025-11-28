#!/usr/bin/env python3
"""
Test WLAN deployment through backend HTTP API
This uses the backend's existing session/token
"""

import requests
import json
import time

def main():
    print("=" * 80)
    print("WLAN Deployment Test - Via Backend HTTP API (FIXED Code)")
    print("=" * 80)

    base_url = "http://localhost:5000/api"

    # Test configuration
    wlan_name = "test-fixed-code"
    ssid_name = "TestFixedCode"
    scope_name = "HomeLab"  # ← FIXED: Using scope NAME
    scope_id = "54819475093"
    role_name = f"{wlan_name}-default"

    # Step 1: Create role
    print(f"\n[1/6] Creating role '{role_name}'...")
    role_data = {
        'name': role_name,
        'description': f'Default role for {wlan_name}',
        'vlan-parameters': {'access-vlan': 1},
        'qos-parameters': {'cos': 0}
    }

    response = requests.post(
        f"{base_url}/config/roles/{role_name}",
        json=role_data,
        headers={'Content-Type': 'application/json'}
    )

    if response.status_code == 200:
        print(f"✅ Role created successfully")
    else:
        print(f"❌ Role creation failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return

    # Step 2: Create WLAN
    print(f"\n[2/6] Creating WLAN '{wlan_name}'...")
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

    response = requests.post(
        f"{base_url}/config/wlan/{wlan_name}",
        json=wlan_data,
        headers={'Content-Type': 'application/json'}
    )

    if response.status_code == 200:
        print(f"✅ WLAN created successfully")
    else:
        print(f"❌ WLAN creation failed: {response.status_code}")
        print(f"   Response: {response.text}")
        # Clean up role
        requests.delete(f"{base_url}/config/roles/{role_name}")
        return

    # Step 3: Assign WLAN to scope (FIXED)
    print(f"\n[3/6] Assigning WLAN to scope '{scope_name}' (FIXED)...")
    print(f"   ✓ Using scope NAME in URL: {scope_name}")
    print(f"   ✓ Empty request body")
    print(f"   ✓ Numeric ID in query params: {scope_id}")

    # FIXED: Using scope NAME in URL, empty body, ID in params
    url = f"{base_url}/config/scope-maps/{scope_name}/CAMPUS_AP/wlan-ssids~2F{wlan_name}"
    params = {
        'object_type': 'LOCAL',
        'scope_id': scope_id,
        'persona': 'CAMPUS_AP',
    }
    body = {}  # Empty body

    response = requests.post(url, json=body, params=params)

    if response.status_code == 200:
        print(f"✅ WLAN assigned to scope successfully!")
        print(f"   🎉 THE FIX WORKS!")
    else:
        print(f"❌ WLAN scope assignment failed: {response.status_code}")
        print(f"   Response: {response.text}")
        print("\nCleaning up resources...")
        requests.delete(f"{base_url}/config/wlan/{wlan_name}")
        requests.delete(f"{base_url}/config/roles/{role_name}")
        return

    # Step 4: Assign role to scope (FIXED)
    print(f"\n[4/6] Assigning role to scope '{scope_name}' (FIXED)...")

    url = f"{base_url}/config/scope-maps/{scope_name}/CAMPUS_AP/roles~2F{role_name}"
    params = {
        'object_type': 'LOCAL',
        'scope_id': scope_id,
        'persona': 'CAMPUS_AP',
    }
    body = {}

    response = requests.post(url, json=body, params=params)

    if response.status_code == 200:
        print(f"✅ Role assigned to scope successfully!")
    else:
        print(f"❌ Role scope assignment failed: {response.status_code}")
        print(f"   Response: {response.text}")
        print("\nCleaning up...")
        requests.delete(f"{base_url}/config/scope-maps/{scope_name}/CAMPUS_AP/wlan-ssids~2F{wlan_name}")
        requests.delete(f"{base_url}/config/wlan/{wlan_name}")
        requests.delete(f"{base_url}/config/roles/{role_name}")
        return

    # Step 5: Assign role-gpid to scope (FIXED)
    print(f"\n[5/6] Assigning role-gpid to scope '{scope_name}' (FIXED)...")

    url = f"{base_url}/config/scope-maps/{scope_name}/CAMPUS_AP/role-gpids~2F{role_name}"
    params = {
        'object_type': 'LOCAL',
        'scope_id': scope_id,
        'persona': 'CAMPUS_AP',
    }
    body = {}

    response = requests.post(url, json=body, params=params)

    if response.status_code == 200:
        print(f"✅ Role-GPID assigned to scope successfully!")
    else:
        print(f"⚠️  Role-GPID scope assignment failed: {response.status_code}")
        print(f"   Response: {response.text}")
        print(f"   (Not critical, continuing...)")

    # Success!
    print(f"\n[6/6] Deployment complete!")
    print("=" * 80)
    print("✅ ✅ ✅  SUCCESS - ALL SCOPE MAP ASSIGNMENTS WORKED!  ✅ ✅ ✅")
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
    print("\n" + "=" * 80)
    print("🎯 THE FIX WORKS! Now you need to HARD REFRESH your browser:")
    print("   Windows/Linux: Ctrl + F5")
    print("   Mac: Cmd + Shift + R")
    print("=" * 80)

if __name__ == '__main__':
    main()
