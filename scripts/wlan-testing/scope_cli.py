#!/usr/bin/env python3
"""Scope CLI - Unified command-line tool for scope and site operations.

This tool consolidates functionality from multiple scope-related scripts:
- examine_scope_maps.py, inspect_existing_scope_maps.py
- test_scope_map.py, test_scope_map_direct.py, test_scope_map_simple.py
- test_scope_map_id.py, test_scope_urllib.py, test_get_scopemaps.py
- assign_frontendtest_to_scope.py, read_local_wlan_with_scope.py

Usage:
    python scope_cli.py sites                List all sites/scopes
    python scope_cli.py get <site_name>      Get site details
    python scope_cli.py maps [--site NAME]   List scope map assignments
    python scope_cli.py assign <wlan> <site> Assign WLAN to site
    python scope_cli.py wlans <site>         List WLANs for a site
    python scope_cli.py roles <site>         List roles for a site
"""

import argparse
import json
import sys
from typing import Optional

from test_utils import (
    get_client,
    list_sites,
    get_site_by_name,
    list_scope_maps,
    assign_wlan_to_scope,
    list_wlans,
    list_roles,
    get_wlan,
    display_sites_table,
    display_wlans_table,
    display_roles_table,
    console,
    NETWORK_CONFIG_PATH
)
from rich.panel import Panel
from rich.json import JSON
from rich.table import Table
from rich import box


def cmd_sites(args):
    """List all sites/scopes."""
    client = get_client()

    console.print(Panel.fit(
        "[bold cyan]Sites / Scopes[/bold cyan]",
        border_style="blue"
    ))

    sites = list_sites(client)

    if sites:
        display_sites_table(sites)
    else:
        console.print("[yellow]No sites found[/yellow]")


def cmd_get_site(args):
    """Get details for a specific site."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold cyan]Site Details: {args.name}[/bold cyan]",
        border_style="blue"
    ))

    site = get_site_by_name(client, args.name)

    if site:
        console.print(f"\n[bold]Name:[/bold] {site.get('site_name', site.get('name', 'N/A'))}")
        scope_id = site.get('scope-id', site.get('scope_id', site.get('id', 'N/A')))
        console.print(f"[bold]Scope ID:[/bold] {scope_id}")
        console.print(f"[bold]Type:[/bold] {site.get('site_type', site.get('type', 'N/A'))}")

        if args.verbose:
            console.print("\n[bold]Full Configuration:[/bold]")
            console.print(JSON(json.dumps(site, indent=2)))

        # Show associated resources
        if args.show_wlans:
            console.print(f"\n[bold cyan]LOCAL WLANs for this site:[/bold cyan]")
            wlans = list_wlans(client, object_type="LOCAL", scope_id=str(scope_id))
            if wlans:
                display_wlans_table(wlans, title=f"LOCAL WLANs for {args.name}")
            else:
                console.print("[dim]No LOCAL WLANs configured[/dim]")

        if args.show_roles:
            console.print(f"\n[bold cyan]LOCAL Roles for this site:[/bold cyan]")
            roles = list_roles(client, object_type="LOCAL", scope_id=str(scope_id))
            if roles:
                display_roles_table(roles, title=f"LOCAL Roles for {args.name}")
            else:
                console.print("[dim]No LOCAL roles configured[/dim]")

    else:
        console.print(f"[red]Site '{args.name}' not found[/red]")
        console.print("\n[dim]Available sites:[/dim]")
        sites = list_sites(client)
        for s in sites[:10]:
            console.print(f"  • {s.get('site_name', s.get('name', 'N/A'))}")
        sys.exit(1)


def cmd_maps(args):
    """List scope map assignments."""
    client = get_client()

    title = f"Scope Maps for {args.site}" if args.site else "All Scope Maps"
    console.print(Panel.fit(
        f"[bold cyan]{title}[/bold cyan]",
        border_style="blue"
    ))

    maps = list_scope_maps(client, scope_name=args.site, persona=args.persona)

    if maps:
        table = Table(title="Scope Map Assignments", box=box.ROUNDED)
        table.add_column("Resource", style="cyan")
        table.add_column("Object Type", style="yellow")
        table.add_column("Persona", style="blue")

        for item in maps:
            # Handle different response structures
            if isinstance(item, dict):
                resource = item.get("resource", item.get("name", str(item)))
                obj_type = item.get("object_type", "N/A")
                persona = item.get("persona", args.persona)
            else:
                resource = str(item)
                obj_type = "N/A"
                persona = args.persona

            table.add_row(resource, obj_type, persona)

        console.print(table)
        console.print(f"\n[dim]Total: {len(maps)} assignment(s)[/dim]")
    else:
        console.print("[yellow]No scope maps found[/yellow]")

        if args.site:
            console.print(f"\n[dim]Note: Site '{args.site}' may not have any assignments yet.[/dim]")


def cmd_assign(args):
    """Assign a WLAN to a site scope."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold cyan]Assign WLAN to Scope[/bold cyan]\n"
        f"WLAN: {args.wlan}\n"
        f"Site: {args.site}",
        border_style="blue"
    ))

    # First, verify the WLAN exists
    console.print("\n[dim]Checking WLAN exists...[/dim]")
    wlan = get_wlan(client, args.wlan, object_type="SHARED")
    if not wlan:
        console.print(f"[red]✗[/red] WLAN '{args.wlan}' not found in library")
        sys.exit(1)
    console.print(f"[green]✓[/green] WLAN found")

    # Find the site
    console.print("[dim]Finding site...[/dim]")
    site = get_site_by_name(client, args.site)
    if not site:
        console.print(f"[red]✗[/red] Site '{args.site}' not found")
        console.print("\n[dim]Available sites:[/dim]")
        sites = list_sites(client)
        for s in sites[:10]:
            console.print(f"  • {s.get('site_name', s.get('name', 'N/A'))}")
        sys.exit(1)

    site_name = site.get("site_name", site.get("name"))
    scope_id = str(site.get("scope-id", site.get("scope_id", site.get("id"))))
    console.print(f"[green]✓[/green] Site found (Scope ID: {scope_id})")

    # Confirm
    if not args.force:
        console.print(f"\n[yellow]Will assign WLAN '{args.wlan}' to site '{site_name}'[/yellow]")
        confirm = console.input("[bold]Continue? [y/N]:[/bold] ")
        if confirm.lower() != "y":
            console.print("[dim]Cancelled[/dim]")
            return

    # Assign
    console.print(f"\n[dim]Assigning WLAN to scope...[/dim]")
    if assign_wlan_to_scope(client, args.wlan, site_name, scope_id, args.persona):
        console.print(f"\n[green]✓[/green] Successfully assigned '{args.wlan}' to '{site_name}'")
    else:
        console.print(f"\n[red]✗[/red] Assignment failed")
        sys.exit(1)


def cmd_wlans(args):
    """List LOCAL WLANs for a site."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold cyan]LOCAL WLANs for Site: {args.site}[/bold cyan]",
        border_style="blue"
    ))

    # Find site to get scope_id
    site = get_site_by_name(client, args.site)
    if not site:
        console.print(f"[red]Site '{args.site}' not found[/red]")
        sys.exit(1)

    scope_id = str(site.get("scope-id", site.get("scope_id", site.get("id"))))
    console.print(f"[dim]Scope ID: {scope_id}[/dim]\n")

    wlans = list_wlans(client, object_type="LOCAL", scope_id=scope_id, persona=args.persona)

    if wlans:
        display_wlans_table(wlans, title=f"LOCAL WLANs for {args.site}")
    else:
        console.print("[yellow]No LOCAL WLANs found for this site[/yellow]")
        console.print("[dim]Tip: Use 'scope_cli.py assign <wlan> <site>' to assign a WLAN[/dim]")


def cmd_roles(args):
    """List LOCAL roles for a site."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold cyan]LOCAL Roles for Site: {args.site}[/bold cyan]",
        border_style="blue"
    ))

    # Find site to get scope_id
    site = get_site_by_name(client, args.site)
    if not site:
        console.print(f"[red]Site '{args.site}' not found[/red]")
        sys.exit(1)

    scope_id = str(site.get("scope-id", site.get("scope_id", site.get("id"))))
    console.print(f"[dim]Scope ID: {scope_id}[/dim]\n")

    roles = list_roles(client, object_type="LOCAL", scope_id=scope_id, persona=args.persona)

    if roles:
        display_roles_table(roles, title=f"LOCAL Roles for {args.site}")
    else:
        console.print("[yellow]No LOCAL roles found for this site[/yellow]")


def cmd_explore(args):
    """Explore available API endpoints (debug mode)."""
    client = get_client()

    console.print(Panel.fit(
        "[bold cyan]Scope API Explorer[/bold cyan]\n"
        "Testing various endpoint patterns",
        border_style="yellow"
    ))

    # Test various endpoints
    endpoints = [
        ("/network-config/v1alpha1/scope-maps", "All scope maps"),
        ("/network-config/v1alpha1/sites", "All sites"),
        ("/network-config/v1alpha1/scopes", "All scopes"),
    ]

    if args.scope_id:
        endpoints.extend([
            (f"/network-config/v1alpha1/scope-maps?scope_id={args.scope_id}", f"Scope maps for ID {args.scope_id}"),
            (f"/network-config/v1alpha1/scope-maps/{args.scope_id}", f"Scope map by ID"),
        ])

    if args.scope_name:
        endpoints.extend([
            (f"/network-config/v1alpha1/scope-maps/{args.scope_name}", f"Scope map by name"),
            (f"/network-config/v1alpha1/scope-maps/{args.scope_name}/CAMPUS_AP", f"Scope map + persona"),
        ])

    for endpoint, description in endpoints:
        console.print(f"\n[bold]{description}[/bold]")
        console.print(f"[dim]{endpoint}[/dim]")

        try:
            response = client.get(endpoint)
            console.print(f"[green]✓[/green] Status: 200")

            # Show truncated response
            response_str = json.dumps(response, indent=2)
            if len(response_str) > 500:
                console.print(f"{response_str[:500]}...")
            else:
                console.print(response_str)

        except Exception as e:
            console.print(f"[red]✗[/red] Error: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Scope CLI - Unified tool for scope and site operations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  scope_cli.py sites                   List all sites
  scope_cli.py get HomeLab             Get site details
  scope_cli.py get HomeLab --wlans     Show site with its WLANs
  scope_cli.py maps                    List all scope map assignments
  scope_cli.py maps --site HomeLab     List assignments for site
  scope_cli.py assign MyWLAN HomeLab   Assign WLAN to site
  scope_cli.py wlans HomeLab           List LOCAL WLANs for site
  scope_cli.py roles HomeLab           List LOCAL roles for site
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Sites command
    subparsers.add_parser("sites", help="List all sites/scopes")

    # Get site command
    get_parser = subparsers.add_parser("get", help="Get site details")
    get_parser.add_argument("name", help="Site name")
    get_parser.add_argument("-v", "--verbose", action="store_true",
                           help="Show full JSON")
    get_parser.add_argument("--wlans", dest="show_wlans", action="store_true",
                           help="Show LOCAL WLANs for site")
    get_parser.add_argument("--roles", dest="show_roles", action="store_true",
                           help="Show LOCAL roles for site")

    # Maps command
    maps_parser = subparsers.add_parser("maps", help="List scope map assignments")
    maps_parser.add_argument("--site", help="Filter by site name")
    maps_parser.add_argument("--persona", default="CAMPUS_AP",
                            help="Device persona (default: CAMPUS_AP)")

    # Assign command
    assign_parser = subparsers.add_parser("assign", help="Assign WLAN to site")
    assign_parser.add_argument("wlan", help="WLAN name")
    assign_parser.add_argument("site", help="Site name")
    assign_parser.add_argument("--persona", default="CAMPUS_AP",
                              help="Device persona (default: CAMPUS_AP)")
    assign_parser.add_argument("-f", "--force", action="store_true",
                              help="Skip confirmation")

    # WLANs command
    wlans_parser = subparsers.add_parser("wlans", help="List LOCAL WLANs for site")
    wlans_parser.add_argument("site", help="Site name")
    wlans_parser.add_argument("--persona", default="CAMPUS_AP",
                             help="Device persona (default: CAMPUS_AP)")

    # Roles command
    roles_parser = subparsers.add_parser("roles", help="List LOCAL roles for site")
    roles_parser.add_argument("site", help="Site name")
    roles_parser.add_argument("--persona", default="CAMPUS_AP",
                             help="Device persona (default: CAMPUS_AP)")

    # Explore command (debug)
    explore_parser = subparsers.add_parser("explore", help="Explore API endpoints (debug)")
    explore_parser.add_argument("--scope-id", help="Scope ID to test")
    explore_parser.add_argument("--scope-name", help="Scope name to test")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Route to command handler
    commands = {
        "sites": cmd_sites,
        "get": cmd_get_site,
        "maps": cmd_maps,
        "assign": cmd_assign,
        "wlans": cmd_wlans,
        "roles": cmd_roles,
        "explore": cmd_explore,
    }

    try:
        commands[args.command](args)
    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelled[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red]Error:[/red] {e}")
        if "--debug" in sys.argv:
            import traceback
            console.print(f"[dim]{traceback.format_exc()}[/dim]")
        sys.exit(1)


if __name__ == "__main__":
    main()
