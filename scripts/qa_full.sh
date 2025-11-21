#!/usr/bin/env bash

set -euo pipefail

# Comprehensive API smoke for pages used in the portal
# Usage:
#   chmod +x scripts/qa_full.sh
#   SESSION_ID=... scripts/qa_full.sh
# Optional:
#   BASE_URL=http://localhost:1344/api scripts/qa_full.sh
#
# Exits 0 regardless; summarizes pass/fail at the end.

BASE_URL="${BASE_URL:-http://localhost:1344/api}"
SESSION_ID="${SESSION_ID:-}"

if [[ -z "${SESSION_ID}" ]]; then
  echo "SESSION_ID is required (X-Session-ID). Export it and re-run."
  exit 1
fi

echo "Using BASE_URL=${BASE_URL}"
echo "Using SESSION_ID (X-Session-ID header will be sent)"

ok=0
fail=0
warn=0

check() {
  local name="$1"; shift
  local method="$1"; shift
  local path="$1"; shift
  local expect="${1:-200}"; shift || true
  local url="${BASE_URL}${path}"
  local code
  code=$(curl -sS -X "${method}" "${url}" -H "Content-Type: application/json" -H "X-Session-ID: ${SESSION_ID}" -o /dev/null -w "%{http_code}" || true)
  if [[ "${code}" == "${expect}" ]]; then
    printf "[OK]   %-48s -> %s\n" "${name}" "${code}"
    ((ok++)) || true
  elif [[ "${code}" =~ ^(400|404)$ ]] && [[ "${expect}" == "200-or-4xx" ]]; then
    printf "[OK*]  %-48s -> %s (allowed)\n" "${name}" "${code}"
    ((ok++)) || true
  elif [[ "${code}" == "200" ]] && [[ "${expect}" == "200-or-4xx" ]]; then
    printf "[OK]   %-48s -> %s\n" "${name}" "${code}"
    ((ok++)) || true
  elif [[ "${code}" =~ ^(400|404)$ ]]; then
    printf "[WARN] %-48s -> %s (client-side; verify params/data)\n" "${name}" "${code}"
    ((warn++)) || true
  else
    printf "[FAIL] %-48s -> %s\n" "${name}" "${code}"
    ((fail++)) || true
  fi
}

echo
echo "== Core =="
check "Auth status"              GET  "/auth/status"
check "Rate limit status"        GET  "/rate-limit/status"
check "Token info"               GET  "/token/info"
check "Services health"          GET  "/services/health"
check "Workspace info"           GET  "/workspace/info"

echo
echo "== Inventory & Monitoring =="
check "Devices"                  GET  "/devices"
check "Switches"                 GET  "/switches"
check "APs"                      GET  "/aps"
check "WLANs"                    GET  "/wlans"
check "Clients"                  GET  "/clients"
check "Sites (legacy)"           GET  "/sites"
check "Sites health"             GET  "/sites/health"
check "Sites device health"      GET  "/sites/device-health"
check "Tenant device health"     GET  "/tenant/device-health"
check "Monitoring APs"           GET  "/monitoring/aps"
check "Monitoring Switches"      GET  "/monitoring/switches"
check "Monitoring Gateways"      GET  "/monitoring/gateways"

echo
echo "== Configuration (Sites/Groups/Templates) =="
check "Sites config list"        GET  "/sites/config"
check "Groups"                   GET  "/groups"
check "Templates"                GET  "/templates"

echo
echo "== NAC =="
check "NAC user roles"           GET  "/nac/user-roles"
check "NAC device profiles"      GET  "/nac/device-profiles"
check "NAC client auth"          GET  "/nac/client-auth"
check "NAC policies"             GET  "/nac/policies"
check "NAC certificates"         GET  "/nac/certificates"
check "NAC radius profiles"      GET  "/nac/radius-profiles"
check "NAC onboarding rules"     GET  "/nac/onboarding-rules"

echo
echo "== Scope =="
check "Scope labels"             GET  "/scope/labels"
check "Scope label associations" GET  "/scope/label-associations?label_id=dummy" "200-or-4xx"
check "Scope geofences"          GET  "/scope/geofences"
check "Scope site hierarchy"     GET  "/scope/site-hierarchy"

echo
echo "== App Experience =="
check "Applications"             GET  "/appexperience/applications"
check "App categories"           GET  "/appexperience/app-categories"
check "Traffic analysis"         GET  "/appexperience/traffic-analysis" "200-or-4xx"
check "QoS policies"             GET  "/appexperience/qos-policies"
check "DPI settings"             GET  "/appexperience/dpi-settings"
check "App visibility"           GET  "/appexperience/app-visibility?group=all"

echo
echo "== Troubleshoot =="
AP_SERIAL="${AP_SERIAL:-}"
SWITCH_SERIAL="${SWITCH_SERIAL:-}"
CLIENT_MAC="${CLIENT_MAC:-}"
if [[ -n "${AP_SERIAL}" ]]; then
  check "Device logs"            GET  "/troubleshoot/device-logs?serial=${AP_SERIAL}" "200-or-4xx"
  check "AP diagnostics"         GET  "/troubleshoot/ap-diagnostics?serial=${AP_SERIAL}" "200-or-4xx"
  check "AP radio stats"         GET  "/troubleshoot/ap-radio-stats?serial=${AP_SERIAL}" "200-or-4xx"
  check "AP interference"        GET  "/troubleshoot/ap-interference?serial=${AP_SERIAL}" "200-or-4xx"
  check "Show run-config"        GET  "/troubleshoot/show-run-config?serial=${AP_SERIAL}" "200-or-4xx"
  check "Show tech-support"      GET  "/troubleshoot/show-tech-support?serial=${AP_SERIAL}" "200-or-4xx"
  check "Show version"           GET  "/troubleshoot/show-version?serial=${AP_SERIAL}" "200-or-4xx"
  check "Show interfaces"        GET  "/troubleshoot/show-interfaces?serial=${AP_SERIAL}" "200-or-4xx"
else
  check "Device logs"            GET  "/troubleshoot/device-logs?serial=dummy" "200-or-4xx"
  check "AP diagnostics"         GET  "/troubleshoot/ap-diagnostics?serial=dummy" "200-or-4xx"
  check "AP radio stats"         GET  "/troubleshoot/ap-radio-stats?serial=dummy" "200-or-4xx"
  check "AP interference"        GET  "/troubleshoot/ap-interference?serial=dummy" "200-or-4xx"
  check "Show run-config"        GET  "/troubleshoot/show-run-config?serial=dummy" "200-or-4xx"
  check "Show tech-support"      GET  "/troubleshoot/show-tech-support?serial=dummy" "200-or-4xx"
  check "Show version"           GET  "/troubleshoot/show-version?serial=dummy" "200-or-4xx"
  check "Show interfaces"        GET  "/troubleshoot/show-interfaces?serial=dummy" "200-or-4xx"
fi
if [[ -n "${SWITCH_SERIAL}" ]]; then
  check "Switch port status"     GET  "/troubleshoot/switch-port-status?serial=${SWITCH_SERIAL}" "200-or-4xx"
else
  check "Switch port status"     GET  "/troubleshoot/switch-port-status?serial=dummy" "200-or-4xx"
fi
if [[ -n "${CLIENT_MAC}" ]]; then
  check "Client session"         GET  "/troubleshoot/client-session?mac=${CLIENT_MAC}" "200-or-4xx"
else
  check "Client session"         GET  "/troubleshoot/client-session?mac=dummy" "200-or-4xx"
fi

echo
echo "== Alerts & Events =="
check "Alerts"                   GET  "/alerts"
check "Events"                   GET  "/events"

echo
echo "== Firmware =="
check "Firmware versions"        GET  "/firmware/versions"
check "Firmware compliance"      GET  "/firmware/compliance"

echo
echo "== Analytics & Reporting =="
check "Analytics bandwidth"      GET  "/analytics/bandwidth"
check "Analytics client-count"   GET  "/analytics/client-count"
check "Analytics device-uptime"  GET  "/analytics/device-uptime"
check "Analytics AP performance" GET  "/analytics/ap-performance"
check "Reporting device inventory" GET "/reporting/device-inventory"
check "Reporting network usage"  GET  "/reporting/network-usage"
check "Reporting wireless health" GET "/reporting/wireless-health"
check "Reporting top APs by usage" GET "/reporting/top-aps-by-wireless-usage"
check "Reporting top APs by clients" GET "/reporting/top-aps-by-client-count"
check "Reporting top SSIDs by usage" GET "/reporting/top-ssids-by-usage"

echo
echo "== Services =="
check "Service subscriptions"    GET  "/services/subscriptions"
check "Service audit logs"       GET  "/services/audit-logs"
check "Service capacity"         GET  "/services/capacity"

echo
echo "== GreenLake (best-effort) =="
check "GL users"                 GET  "/greenlake/users" "200-or-4xx"
check "GL devices"               GET  "/greenlake/devices" "200-or-4xx"
check "GL tags"                  GET  "/greenlake/tags" "200-or-4xx"
check "GL subscriptions"         GET  "/greenlake/subscriptions" "200-or-4xx"
check "GL workspaces"            GET  "/greenlake/workspaces" "200-or-4xx"
check "GL locations"             GET  "/greenlake/locations" "200-or-4xx"
check "GL SCIM users"            GET  "/greenlake/scim/users" "200-or-4xx"
check "GL SCIM groups"           GET  "/greenlake/scim/groups" "200-or-4xx"

echo
echo "== Summary =="
echo "OK: ${ok} | WARN(4xx): ${warn} | FAIL(others): ${fail}"
exit 0


