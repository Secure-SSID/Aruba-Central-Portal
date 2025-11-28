#!/usr/bin/env python3
"""WLAN CLI - Unified command-line tool for WLAN operations.

This tool consolidates functionality from multiple check/test scripts:
- check_all_wlans.py, check_existing_wlans.py, check_working_wlan.py
- check_wpa3_configs.py, check_wlan_deployment.py
- delete_frontendtest.py, delete_portal_test.py, cleanup_test_wpa3.py

Usage:
    python wlan_cli.py list [--local --scope-id ID]
    python wlan_cli.py get <name> [--local --scope-id ID]
    python wlan_cli.py create <name> --passphrase <pass> [options]
    python wlan_cli.py delete <name> [--with-role] [--with-gpid]
    python wlan_cli.py check <name> - Check WLAN status and role
"""

import argparse
import json
import sys
from typing import Optional

from test_utils import (
    get_client,
    list_wlans,
    get_wlan,
    create_wlan,
    delete_wlan,
    list_roles,
    get_role,
    delete_role,
    display_wlans_table,
    build_wlan_config,
    console,
    NETWORK_CONFIG_PATH
)
from rich.panel import Panel
from rich.json import JSON


def cmd_list(args):
    """List WLANs."""
    client = get_client()

    object_type = "LOCAL" if args.local else "SHARED"
    scope_id = args.scope_id if args.local else None

    console.print(Panel.fit(
        f"[bold cyan]WLAN List[/bold cyan]\n"
        f"Type: {object_type}" + (f" | Scope: {scope_id}" if scope_id else ""),
        border_style="blue"
    ))

    wlans = list_wlans(client, object_type=object_type, scope_id=scope_id)

    if wlans:
        display_wlans_table(wlans, title=f"{object_type} WLANs")
    else:
        console.print("[yellow]No WLANs found[/yellow]")


def cmd_get(args):
    """Get details for a specific WLAN."""
    client = get_client()

    object_type = "LOCAL" if args.local else "SHARED"
    scope_id = args.scope_id if args.local else None

    console.print(Panel.fit(
        f"[bold cyan]WLAN Details: {args.name}[/bold cyan]",
        border_style="blue"
    ))

    wlan = get_wlan(
        client,
        args.name,
        object_type=object_type,
        scope_id=scope_id
    )

    if wlan:
        # Display key fields
        console.print(f"\n[bold]SSID:[/bold] {wlan.get('ssid', 'N/A')}")
        console.print(f"[bold]Enabled:[/bold] {wlan.get('enable', 'N/A')}")
        console.print(f"[bold]OpMode:[/bold] {wlan.get('opmode', 'N/A')}")
        console.print(f"[bold]Forward Mode:[/bold] {wlan.get('forward-mode', 'N/A')}")
        console.print(f"[bold]Default Role:[/bold] {wlan.get('default-role', 'NONE')}")
        console.print(f"[bold]VLAN Range:[/bold] {wlan.get('vlan-id-range', 'N/A')}")

        # Check if password is configured
        has_security = "personal-security" in wlan
        console.print(f"[bold]Has Password:[/bold] {'Yes' if has_security else 'No'}")

        if args.verbose:
            console.print("\n[bold]Full Configuration:[/bold]")
            console.print(JSON(json.dumps(wlan, indent=2)))

        # Check associated role
        default_role = wlan.get("default-role")
        if default_role and default_role != "NONE":
            console.print(f"\n[bold cyan]Checking Role: {default_role}[/bold cyan]")
            role = get_role(client, default_role)
            if role:
                vlan = role.get("vlan-parameters", {}).get("access-vlan", "N/A")
                console.print(f"[green]✓[/green] Role exists (VLAN: {vlan})")
            else:
                console.print(f"[red]✗[/red] Role not found - WLAN may not work!")
    else:
        console.print(f"[red]WLAN '{args.name}' not found[/red]")
        sys.exit(1)


def cmd_create(args):
    """Create a new WLAN."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold cyan]Create WLAN: {args.name}[/bold cyan]",
        border_style="blue"
    ))

    # Build configuration
    config = build_wlan_config(
        ssid_name=args.name,
        passphrase=args.passphrase,
        opmode=args.opmode,
        forward_mode=args.forward_mode,
        vlan=args.vlan,
        default_role=args.default_role,
        description=args.description or f"WLAN {args.name}"
    )

    console.print(f"[dim]OpMode:[/dim] {args.opmode}")
    console.print(f"[dim]Forward Mode:[/dim] {args.forward_mode}")
    console.print(f"[dim]VLAN:[/dim] {args.vlan}")

    if args.dry_run:
        console.print("\n[yellow]DRY RUN - Configuration:[/yellow]")
        console.print(JSON(json.dumps(config, indent=2)))
        return

    if create_wlan(client, args.name, config):
        console.print(f"\n[green]✓[/green] WLAN '{args.name}' created successfully")
    else:
        console.print(f"\n[red]✗[/red] Failed to create WLAN")
        sys.exit(1)


def cmd_delete(args):
    """Delete a WLAN and optionally its associated resources."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold red]Delete WLAN: {args.name}[/bold red]",
        border_style="red"
    ))

    if not args.force:
        console.print("[yellow]This will delete the WLAN.[/yellow]")
        if args.with_role:
            console.print("[yellow]Also deleting associated role.[/yellow]")
        if args.with_gpid:
            console.print("[yellow]Also deleting associated role-gpid.[/yellow]")

        confirm = console.input("\n[bold]Continue? [y/N]:[/bold] ")
        if confirm.lower() != "y":
            console.print("[dim]Cancelled[/dim]")
            return

    # Delete WLAN
    console.print(f"\n[cyan]Deleting WLAN '{args.name}'...[/cyan]")
    if delete_wlan(client, args.name):
        console.print(f"[green]✓[/green] WLAN deleted")
    else:
        console.print(f"[yellow]![/yellow] WLAN deletion failed (may not exist)")

    # Delete associated role
    if args.with_role:
        console.print(f"\n[cyan]Deleting role '{args.name}'...[/cyan]")
        if delete_role(client, args.name):
            console.print(f"[green]✓[/green] Role deleted")
        else:
            console.print(f"[yellow]![/yellow] Role deletion failed (may not exist)")

    # Delete role-gpid
    if args.with_gpid:
        console.print(f"\n[cyan]Deleting role-gpid '{args.name}'...[/cyan]")
        try:
            client.delete(
                f"{NETWORK_CONFIG_PATH}/role-gpids/{args.name}",
                params={"object_type": "SHARED"}
            )
            console.print(f"[green]✓[/green] Role-gpid deleted")
        except Exception as e:
            console.print(f"[yellow]![/yellow] Role-gpid deletion failed: {e}")

    console.print("\n[green]Cleanup complete[/green]")


def cmd_check(args):
    """Check WLAN status including role and monitoring data."""
    client = get_client()

    console.print(Panel.fit(
        f"[bold cyan]WLAN Health Check: {args.name}[/bold cyan]",
        border_style="blue"
    ))

    issues = []

    # 1. Check WLAN exists in library
    console.print("\n[bold]1. Checking WLAN in Library (SHARED)...[/bold]")
    wlan = get_wlan(client, args.name, object_type="SHARED")

    if wlan:
        console.print(f"   [green]✓[/green] WLAN found in library")
        console.print(f"      OpMode: {wlan.get('opmode', 'N/A')}")
        console.print(f"      Enabled: {wlan.get('enable', False)}")
    else:
        console.print(f"   [red]✗[/red] WLAN not found in library")
        issues.append("WLAN not in library")

    # 2. Check default role
    if wlan:
        default_role = wlan.get("default-role")
        console.print(f"\n[bold]2. Checking Default Role...[/bold]")

        if default_role and default_role != "NONE":
            role = get_role(client, default_role)
            if role:
                vlan = role.get("vlan-parameters", {}).get("access-vlan", "N/A")
                console.print(f"   [green]✓[/green] Role '{default_role}' exists (VLAN: {vlan})")
            else:
                console.print(f"   [red]✗[/red] Role '{default_role}' NOT FOUND!")
                issues.append(f"Missing role: {default_role}")
        else:
            console.print(f"   [yellow]![/yellow] No default role configured")

        # 3. Check if WLAN has password (for personal security modes)
        console.print(f"\n[bold]3. Checking Security Configuration...[/bold]")
        opmode = wlan.get("opmode", "")

        if opmode in ("WPA2_PERSONAL", "WPA3_SAE"):
            if "personal-security" in wlan:
                console.print(f"   [green]✓[/green] Personal security configured")
            else:
                console.print(f"   [red]✗[/red] No password configured for {opmode}!")
                issues.append("Missing password for personal security mode")
        elif opmode in ("OPEN", "ENHANCED_OPEN"):
            console.print(f"   [dim]N/A - Open network, no security needed[/dim]")
        else:
            console.print(f"   [dim]OpMode: {opmode}[/dim]")

    # 4. Check monitoring API for active WLAN
    console.print(f"\n[bold]4. Checking Active Deployment (Monitoring API)...[/bold]")
    try:
        response = client.get("/network-monitoring/v1alpha1/wlans")
        active_wlans = response.get("data", [])

        found_active = False
        for active in active_wlans:
            if active.get("ssid") == args.name or active.get("name") == args.name:
                found_active = True
                console.print(f"   [green]✓[/green] WLAN active on AP: {active.get('ap_name', 'N/A')}")

        if not found_active:
            console.print(f"   [yellow]![/yellow] WLAN not found in active WLANs")
            console.print(f"   [dim]This may be normal if WLAN is new or not assigned to a scope[/dim]")

    except Exception as e:
        console.print(f"   [yellow]![/yellow] Could not check monitoring API: {e}")

    # Summary
    console.print("\n" + "=" * 50)
    if issues:
        console.print(f"[bold red]Issues Found ({len(issues)}):[/bold red]")
        for issue in issues:
            console.print(f"  [red]•[/red] {issue}")
    else:
        console.print("[bold green]✓ All checks passed![/bold green]")


def main():
    parser = argparse.ArgumentParser(
        description="WLAN CLI - Unified command-line tool for WLAN operations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  wlan_cli.py list                       List all library WLANs
  wlan_cli.py list --local --scope-id 12345  List local WLANs for scope
  wlan_cli.py get MyWLAN                 Get WLAN details
  wlan_cli.py get MyWLAN -v              Get WLAN with full JSON
  wlan_cli.py create TestWLAN -p "Pass123!"  Create WLAN with password
  wlan_cli.py delete TestWLAN --with-role    Delete WLAN and role
  wlan_cli.py check MyWLAN               Health check a WLAN
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # List command
    list_parser = subparsers.add_parser("list", help="List WLANs")
    list_parser.add_argument("--local", action="store_true",
                            help="List LOCAL WLANs instead of SHARED")
    list_parser.add_argument("--scope-id", type=str,
                            help="Scope ID (required for --local)")

    # Get command
    get_parser = subparsers.add_parser("get", help="Get WLAN details")
    get_parser.add_argument("name", help="WLAN name")
    get_parser.add_argument("--local", action="store_true",
                           help="Get LOCAL WLAN")
    get_parser.add_argument("--scope-id", type=str,
                           help="Scope ID (for --local)")
    get_parser.add_argument("-v", "--verbose", action="store_true",
                           help="Show full JSON configuration")

    # Create command
    create_parser = subparsers.add_parser("create", help="Create a new WLAN")
    create_parser.add_argument("name", help="WLAN/SSID name")
    create_parser.add_argument("-p", "--passphrase", required=True,
                              help="WPA passphrase")
    create_parser.add_argument("--opmode", default="WPA2_PERSONAL",
                              choices=["WPA2_PERSONAL", "WPA3_SAE", "OPEN", "ENHANCED_OPEN"],
                              help="Security mode (default: WPA2_PERSONAL)")
    create_parser.add_argument("--forward-mode", default="FORWARD_MODE_BRIDGE",
                              choices=["FORWARD_MODE_BRIDGE", "FORWARD_MODE_L2"],
                              help="Forward mode (default: FORWARD_MODE_BRIDGE)")
    create_parser.add_argument("--vlan", default="1", help="VLAN ID (default: 1)")
    create_parser.add_argument("--default-role", help="Default role name")
    create_parser.add_argument("--description", help="WLAN description")
    create_parser.add_argument("--dry-run", action="store_true",
                              help="Show configuration without creating")

    # Delete command
    delete_parser = subparsers.add_parser("delete", help="Delete a WLAN")
    delete_parser.add_argument("name", help="WLAN name to delete")
    delete_parser.add_argument("--with-role", action="store_true",
                              help="Also delete associated role")
    delete_parser.add_argument("--with-gpid", action="store_true",
                              help="Also delete associated role-gpid")
    delete_parser.add_argument("-f", "--force", action="store_true",
                              help="Skip confirmation")

    # Check command
    check_parser = subparsers.add_parser("check", help="Health check a WLAN")
    check_parser.add_argument("name", help="WLAN name to check")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Route to command handler
    commands = {
        "list": cmd_list,
        "get": cmd_get,
        "create": cmd_create,
        "delete": cmd_delete,
        "check": cmd_check,
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
