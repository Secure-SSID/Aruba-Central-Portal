#!/usr/bin/env python3
"""Test what WPA3 WLAN config should look like"""

import json

# Simulate what the wizard should send for WPA3-Personal
wpa3_config = {
    "ssid": "TestWPA3",
    "description": "WLAN TestWPA3",
    "enable": True,
    "opmode": "WPA3_SAE",  # Correct opmode for WPA3-Personal
    "forward-mode": "FORWARD_MODE_BRIDGE",
    "essid": {
        "name": "TestWPA3"
    },
    "dot11k": True,
    "dot11r": True,
    "high-efficiency": {
        "enable": True
    },
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
    "vlan-selector": "VLAN_RANGES",
    "vlan-id-range": ["1"],
    # CRITICAL: Must have personal-security with passphrase
    "personal-security": {
        "passphrase-format": "STRING",
        "wpa-passphrase": "TestPassword123"
    }
    # Do NOT include default-role - uses system default
}

print("WPA3-Personal WLAN Configuration:")
print("=" * 80)
print(json.dumps(wpa3_config, indent=2))
print("=" * 80)
print("\nKey requirements for WPA3-Personal:")
print("1. opmode: WPA3_SAE")
print("2. personal-security with wpa-passphrase (REQUIRED)")
print("3. No default-role field (uses system default)")
print("=" * 80)
