#!/usr/bin/env python3
"""
Script to search for a specific UUID across Aruba Central API resources.
"""

import sys
from rich.console import Console
from rich.table import Table
from utils import ArubaClient, load_config

console = Console()

def search_uuid(client, uuid):
    """Search for UUID across various API endpoints."""

    results = []

    # Check if it's a tenant ID (MSP context)
    console.print(f"\n[cyan]Checking MSP/Tenant endpoints...[/cyan]")
    try:
        response = client.get("/msp_api/v1/tenants")
        if response.status_code == 200:
            data = response.json()
            tenants = data.get("tenants", [])
            for tenant in tenants:
                if tenant.get("tenant_id") == uuid or tenant.get("customer_id") == uuid:
                    results.append(("Tenant", tenant))
                    console.print(f"[green]✓ Found in Tenants![/green]")
    except Exception as e:
        console.print(f"[yellow]MSP endpoint check: {e}[/yellow]")

    # Check groups
    console.print(f"[cyan]Checking Groups...[/cyan]")
    try:
        response = client.get("/configuration/v1/groups")
        if response.status_code == 200:
            data = response.json()
            groups = data.get("data", [])
            for group in groups:
                if group.get("group") == uuid or str(group.get("group_id")) == uuid:
                    results.append(("Group", group))
                    console.print(f"[green]✓ Found in Groups![/green]")
    except Exception as e:
        console.print(f"[yellow]Groups check: {e}[/yellow]")

    # Check sites
    console.print(f"[cyan]Checking Sites...[/cyan]")
    try:
        response = client.get("/central/v2/sites")
        if response.status_code == 200:
            data = response.json()
            sites = data.get("sites", [])
            for site in sites:
                if site.get("site_id") == uuid or str(site.get("id")) == uuid:
                    results.append(("Site", site))
                    console.print(f"[green]✓ Found in Sites![/green]")
    except Exception as e:
        console.print(f"[yellow]Sites check: {e}[/yellow]")

    # Check labels
    console.print(f"[cyan]Checking Labels...[/cyan]")
    try:
        response = client.get("/central/v2/labels")
        if response.status_code == 200:
            data = response.json()
            labels = data.get("labels", [])
            for label in labels:
                if label.get("label_id") == uuid or str(label.get("id")) == uuid:
                    results.append(("Label", label))
                    console.print(f"[green]✓ Found in Labels![/green]")
    except Exception as e:
        console.print(f"[yellow]Labels check: {e}[/yellow]")

    # Check devices (by serial - less likely but possible)
    console.print(f"[cyan]Checking Devices...[/cyan]")
    try:
        response = client.get(f"/monitoring/v1/devices/{uuid}")
        if response.status_code == 200:
            device = response.json()
            results.append(("Device", device))
            console.print(f"[green]✓ Found as Device![/green]")
    except Exception as e:
        console.print(f"[yellow]Device check: {e}[/yellow]")

    # Check if it's an application ID or client ID
    console.print(f"[cyan]Checking Platform/Applications...[/cyan]")
    try:
        response = client.get("/platform/v1/applications")
        if response.status_code == 200:
            data = response.json()
            apps = data.get("applications", [])
            for app in apps:
                if app.get("id") == uuid or app.get("client_id") == uuid:
                    results.append(("Application", app))
                    console.print(f"[green]✓ Found in Applications![/green]")
    except Exception as e:
        console.print(f"[yellow]Applications check: {e}[/yellow]")

    return results


def main():
    if len(sys.argv) < 2:
        console.print("[red]Usage: python find_uuid.py <uuid>[/red]")
        sys.exit(1)

    uuid = sys.argv[1]
    console.print(f"\n[bold]Searching for UUID: {uuid}[/bold]\n")

    # Load config and authenticate
    config = load_config()
    client = ArubaClient(**config["aruba_central"])

    # Search for UUID
    results = search_uuid(client, uuid)

    # Display results
    console.print("\n" + "="*80)
    if results:
        console.print(f"\n[bold green]Found {len(result(s))} match(es)![/bold green]\n")
        for resource_type, data in results:
            console.print(f"\n[bold cyan]Resource Type: {resource_type}[/bold cyan]")
            console.print(data)
    else:
        console.print(f"\n[bold yellow]UUID not found in any checked endpoints.[/bold yellow]")
        console.print("\nPossible reasons:")
        console.print("  • UUID belongs to a different tenant/customer")
        console.print("  • UUID is from an archived or deleted resource")
        console.print("  • UUID belongs to an endpoint not checked by this script")
        console.print("  • Insufficient API permissions to access the resource")


if __name__ == "__main__":
    main()
