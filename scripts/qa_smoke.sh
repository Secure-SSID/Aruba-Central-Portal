#!/usr/bin/env bash

set -euo pipefail

# Basic API smoke tests for local instance
# Usage:
#   chmod +x scripts/qa_smoke.sh
#   scripts/qa_smoke.sh
# Optional:
#   BASE_URL=http://localhost:1344/api SESSION_ID=xxxx scripts/qa_smoke.sh

BASE_URL="${BASE_URL:-http://localhost:1344/api}"
SESSION_ID="${SESSION_ID:-}"

echo "Using BASE_URL=${BASE_URL}"
if [[ -n "${SESSION_ID}" ]]; then
  echo "Using SESSION_ID (X-Session-ID header will be sent)"
fi

hdr() {
  echo
  echo "== $1 =="
}

curl_json() {
  local method="$1"
  local path="$2"
  shift 2
  local url="${BASE_URL}${path}"
  if [[ -n "${SESSION_ID}" ]]; then
    curl -sS -X "${method}" "${url}" -H "Content-Type: application/json" -H "X-Session-ID: ${SESSION_ID}" "$@"
  else
    curl -sS -X "${method}" "${url}" -H "Content-Type: application/json" "$@"
  fi
}

status_check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expect="${4:-200}"
  local code
  code=$(curl_json "${method}" "${path}" -o /dev/null -w "%{http_code}" || true)
  if [[ "${code}" == "${expect}" ]]; then
    echo "[OK] ${name} -> ${code}"
  else
    echo "[WARN] ${name} -> ${code} (expected ${expect})"
  fi
}

hdr "Unauthenticated checks"
status_check "Health" GET "/health" 200
status_check "Cluster info" GET "/cluster/info" 200

hdr "Authenticated checks (expect 200 with SESSION_ID, 401 otherwise)"
status_check "Auth status" GET "/auth/status" "${SESSION_ID:+200}"; [[ -z "${SESSION_ID}" ]] && echo "      (expected 401 without SESSION_ID)"
status_check "Services health" GET "/services/health" "${SESSION_ID:+200}"
status_check "Devices" GET "/devices" "${SESSION_ID:+200}"
status_check "Users" GET "/users" "${SESSION_ID:+200}"
status_check "Sites" GET "/sites" "${SESSION_ID:+200}"
status_check "Monitoring network health" GET "/monitoring/network-health" "${SESSION_ID:+200}"

hdr "Optional targeted queries (best-effort)"
echo "- Top apps by bandwidth (monitoring v2)"
curl_json GET "/monitoring/applications/top" -o /dev/null -w "HTTP %{http_code}\n" || true

echo
echo "Done. Tip: set SESSION_ID to your current session to exercise authenticated endpoints."


