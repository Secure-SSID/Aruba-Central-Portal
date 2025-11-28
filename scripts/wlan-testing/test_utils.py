#!/usr/bin/env python3
"""Shared utilities for WLAN testing scripts.

This module provides reusable functions for WLAN, scope, and role operations
using the CentralAPIClient. All wlan-testing scripts should use these utilities
instead of directly making API calls.
"""

import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add parent directories to path to import utils
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich import box

console = Console()

# Default API base path for network configuration
NETWORK_CONFIG_PATH = "/network-config/v1alpha1"
NETWORK_MONITORING_PATH = "/network-monitoring/v1alpha1"


def get_client() -> CentralAPIClient:
    """Initialize and return a CentralAPIClient instance.

    Returns:
        Configured CentralAPIClient ready for API calls.
    """
    config = load_config()
    aruba_config = config["aruba_central"]

    token_manager = TokenManager(
        client_id=aruba_config["client_id"],
        client_secret=aruba_config["client_secret"],
    )

    return CentralAPIClient(
        base_url=aruba_config["base_url"],
        token_manager=token_manager,
    )


# =============================================================================
# WLAN Operations
# =============================================================================

def list_wlans(
    client: CentralAPIClient,
    object_type: str = "SHARED",
    scope_id: Optional[str] = None,
    persona: str = "CAMPUS_AP"
) -> List[Dict[str, Any]]:
    """List WLANs with optional filtering.

    Args:
        client: CentralAPIClient instance
        object_type: "SHARED" for library, "LOCAL" for site-specific
        scope_id: Site scope ID (required for LOCAL)
        persona: Device persona (default: CAMPUS_AP)

    Returns:
        List of WLAN dictionaries
    """
    params = {"object_type": object_type}

    if object_type == "LOCAL" and scope_id:
        params["scope_id"] = scope_id
        params["persona"] = persona

    try:
        response = client.get(f"{NETWORK_CONFIG_PATH}/wlan-ssids", params=params)
        return response.get("data", [])
    except Exception as e:
        console.print(f"[red]Error listing WLANs:[/red] {e}")
        return []


def get_wlan(
    client: CentralAPIClient,
    wlan_name: str,
    object_type: str = "SHARED",
    scope_id: Optional[str] = None,
    persona: str = "CAMPUS_AP"
) -> Optional[Dict[str, Any]]:
    """Get details for a specific WLAN.

    Args:
        client: CentralAPIClient instance
        wlan_name: Name/SSID of the WLAN
        object_type: "SHARED" or "LOCAL"
        scope_id: Site scope ID (for LOCAL)
        persona: Device persona

    Returns:
        WLAN details dictionary or None if not found
    """
    params = {"object_type": object_type}

    if object_type == "LOCAL" and scope_id:
        params["scope_id"] = scope_id
        params["persona"] = persona

    try:
        response = client.get(
            f"{NETWORK_CONFIG_PATH}/wlan-ssids/{wlan_name}",
            params=params
        )
        return response
    except Exception as e:
        console.print(f"[yellow]WLAN '{wlan_name}' not found:[/yellow] {e}")
        return None


def create_wlan(
    client: CentralAPIClient,
    wlan_name: str,
    wlan_config: Dict[str, Any]
) -> bool:
    """Create a new WLAN in the library.

    Args:
        client: CentralAPIClient instance
        wlan_name: Name for the new WLAN
        wlan_config: WLAN configuration dictionary

    Returns:
        True if successful, False otherwise
    """
    try:
        client.post(
            f"{NETWORK_CONFIG_PATH}/wlan-ssids/{wlan_name}",
            json=wlan_config
        )
        return True
    except Exception as e:
        console.print(f"[red]Error creating WLAN:[/red] {e}")
        return False


def delete_wlan(
    client: CentralAPIClient,
    wlan_name: str,
    object_type: str = "SHARED"
) -> bool:
    """Delete a WLAN.

    Args:
        client: CentralAPIClient instance
        wlan_name: Name of the WLAN to delete
        object_type: "SHARED" or "LOCAL"

    Returns:
        True if successful, False otherwise
    """
    try:
        client.delete(
            f"{NETWORK_CONFIG_PATH}/wlan-ssids/{wlan_name}",
            params={"object_type": object_type}
        )
        return True
    except Exception as e:
        console.print(f"[red]Error deleting WLAN:[/red] {e}")
        return False


# =============================================================================
# Scope/Site Operations
# =============================================================================

def list_sites(client: CentralAPIClient) -> List[Dict[str, Any]]:
    """List all sites/scopes.

    Args:
        client: CentralAPIClient instance

    Returns:
        List of site dictionaries
    """
    try:
        response = client.get(f"{NETWORK_CONFIG_PATH}/sites")
        return response.get("items", response.get("sites", response.get("data", [])))
    except Exception as e:
        console.print(f"[red]Error listing sites:[/red] {e}")
        return []


def get_site_by_name(
    client: CentralAPIClient,
    site_name: str
) -> Optional[Dict[str, Any]]:
    """Find a site by name.

    Args:
        client: CentralAPIClient instance
        site_name: Name of the site to find

    Returns:
        Site dictionary or None if not found
    """
    sites = list_sites(client)
    for site in sites:
        name = site.get("site_name", site.get("name", ""))
        if name.lower() == site_name.lower():
            return site
    return None


def assign_wlan_to_scope(
    client: CentralAPIClient,
    wlan_name: str,
    scope_name: str,
    scope_id: str,
    persona: str = "CAMPUS_AP"
) -> bool:
    """Assign a WLAN to a site scope.

    Args:
        client: CentralAPIClient instance
        wlan_name: Name of the WLAN to assign
        scope_name: Name of the scope/site
        scope_id: Scope ID
        persona: Device persona (default: CAMPUS_AP)

    Returns:
        True if successful, False otherwise
    """
    # URL-encode the forward slash in wlan-ssids/name
    resource_path = f"wlan-ssids~2F{wlan_name}"

    try:
        client.post(
            f"{NETWORK_CONFIG_PATH}/scope-maps/{scope_name}/{persona}/{resource_path}",
            json={},
            params={
                "object_type": "LOCAL",
                "scope_id": scope_id,
                "persona": persona
            }
        )
        return True
    except Exception as e:
        console.print(f"[red]Error assigning WLAN to scope:[/red] {e}")
        return False


def list_scope_maps(
    client: CentralAPIClient,
    scope_name: Optional[str] = None,
    persona: str = "CAMPUS_AP"
) -> List[Dict[str, Any]]:
    """List scope map assignments.

    Args:
        client: CentralAPIClient instance
        scope_name: Optional scope name to filter
        persona: Device persona

    Returns:
        List of scope map entries
    """
    try:
        if scope_name:
            response = client.get(
                f"{NETWORK_CONFIG_PATH}/scope-maps/{scope_name}/{persona}"
            )
        else:
            response = client.get(f"{NETWORK_CONFIG_PATH}/scope-maps")
        return response.get("data", [])
    except Exception as e:
        console.print(f"[yellow]Error listing scope maps:[/yellow] {e}")
        return []


# =============================================================================
# Role Operations
# =============================================================================

def list_roles(
    client: CentralAPIClient,
    object_type: str = "SHARED",
    scope_id: Optional[str] = None,
    persona: str = "CAMPUS_AP"
) -> List[Dict[str, Any]]:
    """List roles with optional filtering.

    Args:
        client: CentralAPIClient instance
        object_type: "SHARED" for library, "LOCAL" for site-specific
        scope_id: Site scope ID (required for LOCAL)
        persona: Device persona

    Returns:
        List of role dictionaries
    """
    params = {"object_type": object_type}

    if object_type == "LOCAL" and scope_id:
        params["scope_id"] = scope_id
        params["persona"] = persona

    try:
        response = client.get(f"{NETWORK_CONFIG_PATH}/roles", params=params)
        return response.get("data", [])
    except Exception as e:
        console.print(f"[red]Error listing roles:[/red] {e}")
        return []


def get_role(
    client: CentralAPIClient,
    role_name: str,
    object_type: str = "SHARED"
) -> Optional[Dict[str, Any]]:
    """Get details for a specific role.

    Args:
        client: CentralAPIClient instance
        role_name: Name of the role
        object_type: "SHARED" or "LOCAL"

    Returns:
        Role details dictionary or None
    """
    try:
        response = client.get(
            f"{NETWORK_CONFIG_PATH}/roles/{role_name}",
            params={"object_type": object_type}
        )
        return response
    except Exception as e:
        console.print(f"[yellow]Role '{role_name}' not found:[/yellow] {e}")
        return None


def delete_role(
    client: CentralAPIClient,
    role_name: str,
    object_type: str = "SHARED"
) -> bool:
    """Delete a role.

    Args:
        client: CentralAPIClient instance
        role_name: Name of the role to delete
        object_type: "SHARED" or "LOCAL"

    Returns:
        True if successful, False otherwise
    """
    try:
        client.delete(
            f"{NETWORK_CONFIG_PATH}/roles/{role_name}",
            params={"object_type": object_type}
        )
        return True
    except Exception as e:
        console.print(f"[red]Error deleting role:[/red] {e}")
        return False


# =============================================================================
# Display Utilities
# =============================================================================

def display_wlans_table(wlans: List[Dict[str, Any]], title: str = "WLANs") -> None:
    """Display WLANs in a formatted table.

    Args:
        wlans: List of WLAN dictionaries
        title: Table title
    """
    table = Table(title=title, box=box.ROUNDED)
    table.add_column("SSID", style="cyan")
    table.add_column("OpMode", style="yellow")
    table.add_column("Forward Mode", style="blue")
    table.add_column("Default Role", style="green")
    table.add_column("Enabled", style="magenta")

    for wlan in wlans:
        table.add_row(
            wlan.get("ssid", "N/A"),
            wlan.get("opmode", "N/A"),
            wlan.get("forward-mode", "N/A"),
            wlan.get("default-role", "NONE"),
            "Yes" if wlan.get("enable", False) else "No"
        )

    console.print(table)
    console.print(f"\n[dim]Total: {len(wlans)} WLAN(s)[/dim]")


def display_sites_table(sites: List[Dict[str, Any]], title: str = "Sites") -> None:
    """Display sites in a formatted table.

    Args:
        sites: List of site dictionaries
        title: Table title
    """
    table = Table(title=title, box=box.ROUNDED)
    table.add_column("Name", style="cyan")
    table.add_column("Scope ID", style="yellow")
    table.add_column("Type", style="blue")

    for site in sites:
        table.add_row(
            site.get("site_name", site.get("name", "N/A")),
            str(site.get("scope-id", site.get("scope_id", site.get("id", "N/A")))),
            site.get("site_type", site.get("type", "N/A"))
        )

    console.print(table)
    console.print(f"\n[dim]Total: {len(sites)} site(s)[/dim]")


def display_roles_table(roles: List[Dict[str, Any]], title: str = "Roles") -> None:
    """Display roles in a formatted table.

    Args:
        roles: List of role dictionaries
        title: Table title
    """
    table = Table(title=title, box=box.ROUNDED)
    table.add_column("Name", style="cyan")
    table.add_column("VLAN", style="yellow")
    table.add_column("Description", style="dim")

    for role in roles:
        vlan_params = role.get("vlan-parameters", {})
        vlan = vlan_params.get("access-vlan", "N/A")

        table.add_row(
            role.get("name", "N/A"),
            str(vlan),
            role.get("description", "")[:40]
        )

    console.print(table)
    console.print(f"\n[dim]Total: {len(roles)} role(s)[/dim]")


# =============================================================================
# WLAN Configuration Templates
# =============================================================================

def build_wlan_config(
    ssid_name: str,
    passphrase: str,
    opmode: str = "WPA2_PERSONAL",
    forward_mode: str = "FORWARD_MODE_BRIDGE",
    vlan: str = "1",
    default_role: Optional[str] = None,
    description: str = ""
) -> Dict[str, Any]:
    """Build a WLAN configuration dictionary.

    Args:
        ssid_name: SSID name
        passphrase: WPA passphrase (for personal security)
        opmode: Security mode (WPA2_PERSONAL, WPA3_SAE, OPEN, etc.)
        forward_mode: FORWARD_MODE_BRIDGE or FORWARD_MODE_L2
        vlan: VLAN ID
        default_role: Optional default role name
        description: WLAN description

    Returns:
        WLAN configuration dictionary ready for API
    """
    config = {
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
        "ssid": ssid_name,
        "description": description or f"WLAN {ssid_name}",
        "opmode": opmode,
        "forward-mode": forward_mode,
        "essid": {"name": ssid_name},
        "vlan-selector": "VLAN_RANGES",
        "vlan-id-range": [vlan]
    }

    # Add personal security for WPA modes
    if opmode in ("WPA2_PERSONAL", "WPA3_SAE"):
        config["personal-security"] = {
            "passphrase-format": "STRING",
            "wpa-passphrase": passphrase
        }

    # Add default role if specified
    if default_role:
        config["default-role"] = default_role

    return config
