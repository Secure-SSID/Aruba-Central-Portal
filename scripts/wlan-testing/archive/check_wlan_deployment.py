#!/usr/bin/env python3
"""Check WLAN deployment status and why connection might fail"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("WLAN Deployment Diagnostic")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "Iwannabelieve"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# 1. Check WLAN configuration
print(f"\n1. Checking WLAN '{wlan_name}' configuration...")
url = f"{base_url}/network-config/v1alpha1/wlan-ssids/{wlan_name}"
params = {'scope_id': scope_id, 'persona': persona}
response = requests.get(url, headers=headers, params=params)

if response.status_code == 200:
    wlan_config = response.json()
    print(f"✅ WLAN found")
    print(f"   SSID: {wlan_config.get('ssid', 'N/A')}")
    print(f"   Enabled: {wlan_config.get('enable', 'N/A')}")
    print(f"   OpMode: {wlan_config.get('opmode', 'N/A')}")
    print(f"   Forward Mode: {wlan_config.get('forward-mode', 'N/A')}")
    print(f"   Default Role: {wlan_config.get('default-role', 'N/A')}")
    print(f"   VLAN: {wlan_config.get('vlan-id-range', 'N/A')}")

    # Check password
    if 'personal-security' in wlan_config:
        print(f"   Password configured: YES (WPA passphrase)")
        print(f"   ⚠️  Make sure you're using: Aruba123! (capital A, exclamation mark)")
    else:
        print(f"   ❌ No password configured!")
else:
    print(f"❌ WLAN not found: {response.status_code}")
    print(f"   {response.text[:500]}")

# 2. Check if WLAN appears in monitoring (deployed to APs)
print(f"\n2. Checking if WLAN is deployed to APs (monitoring API)...")
url2 = f"{base_url}/network-monitoring/v1alpha1/wlans"
response2 = requests.get(url2, headers=headers)

if response2.status_code == 200:
    wlans_data = response2.json().get('data', [])
    matching = [w for w in wlans_data if w.get('name') == wlan_name or w.get('ssid') == wlan_name]

    if matching:
        print(f"✅ WLAN is deployed to {len(matching)} AP(s)")
        for w in matching:
            print(f"   AP: {w.get('ap_name', 'N/A')}, Status: {w.get('status', 'N/A')}")
    else:
        print(f"⚠️  WLAN not yet deployed to any APs")
        print(f"   This might take a few minutes to propagate")
        print(f"   Total WLANs in monitoring: {len(wlans_data)}")
else:
    print(f"Monitoring API: {response2.status_code}")

# 3. Check role configuration
print(f"\n3. Checking role configuration...")
role_name = f"{wlan_name}-default"
url3 = f"{base_url}/network-config/v1alpha1/roles/{role_name}"
params3 = {'scope_id': scope_id, 'persona': persona}
response3 = requests.get(url3, headers=headers, params=params3)

if response3.status_code == 200:
    role_config = response3.json()
    print(f"✅ Role found: {role_name}")
    vlan_params = role_config.get('vlan-parameters', {})
    print(f"   Access VLAN: {vlan_params.get('access-vlan', 'N/A')}")
else:
    print(f"❌ Role not found: {response3.status_code}")

# 4. Check APs in this scope
print(f"\n4. Checking APs in HomeLab site...")
url4 = f"{base_url}/network-monitoring/v1alpha1/aps"
response4 = requests.get(url4, headers=headers)

if response4.status_code == 200:
    aps = response4.json().get('data', [])
    homelab_aps = [ap for ap in aps if str(ap.get('site_id')) == scope_id or ap.get('site') == 'HomeLab']

    if homelab_aps:
        print(f"✅ Found {len(homelab_aps)} AP(s) in HomeLab site")
        for ap in homelab_aps:
            print(f"   AP: {ap.get('name', 'N/A')}, Status: {ap.get('status', 'N/A')}")
            print(f"      Model: {ap.get('model', 'N/A')}, IP: {ap.get('ip_address', 'N/A')}")
    else:
        print(f"⚠️  No APs found in HomeLab site")
        print(f"   Total APs: {len(aps)}")
        if aps:
            print(f"   Sample AP sites: {set([ap.get('site', 'N/A') for ap in aps[:3]])}")
else:
    print(f"AP API: {response4.status_code}")

print("\n" + "=" * 80)
print("DIAGNOSIS:")
print("=" * 80)
print()
print("If SSID is broadcasting but you can't connect, check:")
print("1. ✓ Password: Aruba123! (capital A, exclamation mark)")
print("2. ✓ Device supports WPA2-Personal")
print("3. ⚠️  AP has applied the new WLAN configuration (may take 1-2 minutes)")
print("4. ⚠️  AP is in the correct site/scope")
print("5. ⚠️  VLAN 1 is configured and accessible on the network")
print()
print("Try:")
print("- Wait 1-2 minutes for config to propagate to AP")
print("- Forget the network on your device and re-add it")
print("- Check AP logs for connection/authentication errors")
print("=" * 80)
