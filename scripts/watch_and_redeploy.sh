#!/usr/bin/env bash
set -euo pipefail

# Configuration
REPO_DIR="/Users/stephenchoate/Docker/aruba-central-portal"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"  # default 5 minutes
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://localhost:1344/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"       # seconds

log() {
  printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

health_check() {
  local elapsed=0
  while (( elapsed < HEALTH_TIMEOUT )); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      log "Health check OK at $HEALTH_URL"
      return 0
    fi
    sleep 2
    elapsed=$(( elapsed + 2 ))
  done
  log "Health check FAILED after ${HEALTH_TIMEOUT}s ($HEALTH_URL)"
  return 1
}

rebuild_and_restart() {
  log "Building Docker image via build-docker.sh"
  chmod +x "$REPO_DIR/build-docker.sh" || true
  "$REPO_DIR/build-docker.sh"

  log "Starting containers with docker-compose"
  ( cd "$REPO_DIR" && docker-compose up -d )

  health_check
}

update_repo_if_needed() {
  cd "$REPO_DIR"

  # Ensure we can fetch latest
  git fetch origin "$BRANCH" >/dev/null 2>&1 || {
    log "git fetch failed; will retry later"
    return 1
  }

  local local_head remote_head
  local_head="$(git rev-parse HEAD)"
  remote_head="$(git rev-parse "origin/$BRANCH")"

  if [[ "$local_head" != "$remote_head" ]]; then
    log "Changes detected on origin/$BRANCH. Updating..."
    # Stash only tracked to avoid permission issues with some untracked files
    git stash push -m "auto-stash by watcher" || true
    git pull --rebase --autostash origin "$BRANCH"
    rebuild_and_restart
  else
    log "No changes on origin/$BRANCH"
  fi
}

log "Starting watch_and_redeploy (branch=$BRANCH, interval=${INTERVAL_SECONDS}s)"
log "Initial build/health check to ensure service is up"
rebuild_and_restart || true

while true; do
  update_repo_if_needed || true
  sleep "$INTERVAL_SECONDS"
done


