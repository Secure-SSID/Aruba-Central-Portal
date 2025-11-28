#!/usr/bin/env python3
"""Check all WLANs without filtering by object_type"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Checking All WLANs (No Filter)")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

scope_id = "54819475093"
persona = "CAMPUS_AP"

# Try getting WLANs without any filters
print(f"\n1. All WLANs (no filter)...")
response = requests.get(f"{base_url}/wlan-ssids", headers=headers)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    wlans = response.json().get('data', [])
    print(f"   Found {len(wlans)} WLANs")
    for w in wlans:
        print(f"     - {w.get('ssid', 'N/A')} (default-role: {w.get('default-role', 'NONE')})")

# Try with scope parameters but no object_type
print(f"\n2. WLANs for HomeLab (scope_id + persona, no object_type)...")
response2 = requests.get(
    f"{base_url}/wlan-ssids",
    headers=headers,
    params={'scope_id': scope_id, 'persona': persona}
)
print(f"   Status: {response2.status_code}")
if response2.status_code == 200:
    wlans = response2.json().get('data', [])
    print(f"   Found {len(wlans)} WLANs")
    for w in wlans:
        ssid = w.get('ssid', 'N/A')
        default_role = w.get('default-role', 'NONE')
        print(f"     - {ssid} (default-role: {default_role})")

        # Get full details
        response3 = requests.get(
            f"{base_url}/wlan-ssids/{ssid}",
            headers=headers,
            params={'scope_id': scope_id, 'persona': persona}
        )
        if response3.status_code == 200:
            details = response3.json()
            print(f"       Enabled: {details.get('enable', 'N/A')}")
            print(f"       OpMode: {details.get('opmode', 'N/A')}")
            print(f"       Has password: {'personal-security' in details}")

# Check monitoring API to see active WLANs
print(f"\n3. Active WLANs from monitoring API...")
monitoring_url = "https://internal.api.central.arubanetworks.com/network-monitoring/v1alpha1/wlans"
response4 = requests.get(monitoring_url, headers=headers)
print(f"   Status: {response4.status_code}")
if response4.status_code == 200:
    active_wlans = response4.json().get('data', [])
    print(f"   Found {len(active_wlans)} active WLANs")
    for w in active_wlans:
        print(f"     - {w.get('ssid', w.get('name', 'N/A'))} on AP: {w.get('ap_name', 'N/A')}")

# Check all roles
print(f"\n4. All roles (no filter)...")
response5 = requests.get(f"{base_url}/roles", headers=headers)
print(f"   Status: {response5.status_code}")
if response5.status_code == 200:
    roles = response5.json().get('data', [])
    print(f"   Found {len(roles)} roles")
    for r in roles[:10]:
        name = r.get('name', 'N/A')
        vlan = r.get('vlan-parameters', {}).get('access-vlan', 'N/A')
        print(f"     - {name} (VLAN: {vlan})")

# Check roles for HomeLab scope
print(f"\n5. Roles for HomeLab scope...")
response6 = requests.get(
    f"{base_url}/roles",
    headers=headers,
    params={'scope_id': scope_id, 'persona': persona}
)
print(f"   Status: {response6.status_code}")
if response6.status_code == 200:
    roles = response6.json().get('data', [])
    print(f"   Found {len(roles)} roles for HomeLab")
    for r in roles:
        print(f"     - {r.get('name', 'N/A')}")

print("\n" + "=" * 80)
