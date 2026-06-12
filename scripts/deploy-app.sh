#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy-app.sh — Git-Based Deployment for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Pulls the latest code from Git, rebuilds Docker images, and restarts services.
# Demonstrates SCP/Git-based file deployment for cloud VMs.
#
# Usage:
#   ./deploy-app.sh                     Deploy latest from Git
#   ./deploy-app.sh <branch>            Deploy specific branch
#   ./deploy-app.sh --restart-only      Just restart containers (no pull)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PAYSYNC_HOME="/opt/paysync"
BRANCH="${1:-main}"
COMPOSE_FILE="${PAYSYNC_HOME}/docker-compose.yml"
BACKUP_SCRIPT="${PAYSYNC_HOME}/scripts/backup.sh"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DEPLOY_LOG="/var/log/paysync/deploy.log"

mkdir -p "$(dirname "$DEPLOY_LOG")"

log() {
    echo "[$(date +"%H:%M:%S")] $*"
    echo "[$(date +"%H:%M:%S")] $*" >> "$DEPLOY_LOG"
}

log "=== PaySync Deployment Started ==="
log "Branch: $BRANCH"
log ""

# ── Pre-deployment backup ──
if [[ -f "$BACKUP_SCRIPT" ]]; then
    log "[*] Running pre-deployment backup..."
    bash "$BACKUP_SCRIPT" || log "[WARN] Pre-deployment backup failed (continuing anyway)"
fi

# ── Pull latest code (skip if --restart-only) ──
if [[ "${1:-}" != "--restart-only" ]]; then
    if [[ ! -d "$PAYSYNC_HOME/.git" ]]; then
        log "[!] Not a Git repository. Cloning fresh copy..."
        cd /tmp
        git clone https://github.com/AnoopG7/PaySync.git paysync-tmp
        rsync -a paysync-tmp/ "$PAYSYNC_HOME/"
        rm -rf paysync-tmp
    else
        log "[*] Pulling latest code from $BRANCH..."
        cd "$PAYSYNC_HOME"
        git fetch origin
        git reset --hard "origin/$BRANCH"
    fi
    log "[✓] Code updated."
else
    log "[*] Restart mode: skipping code pull."
fi

# ── Rebuild and restart containers ──
log "[*] Rebuilding and restarting Docker containers..."
cd "$PAYSYNC_HOME"

# Pull latest base images
docker compose pull 2>/dev/null || true

# Build and restart
docker compose up --build -d 2>&1 | while IFS= read -r line; do log "  $line"; done

# ── Verify deployment ──
log ""
log "[*] Verifying deployment..."
sleep 5

# Check containers
if docker ps --format "{{.Names}}" | grep -q "backend"; then
    log "[✓] Backend container is running"
else
    log "[✗] Backend container failed to start!"
fi

if docker ps --format "{{.Names}}" | grep -q "frontend"; then
    log "[✓] Frontend container is running"
else
    log "[✗] Frontend container failed to start!"
fi

# Check API health
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3001/api/health 2>/dev/null || echo "000")
if [[ "$HEALTH" == "200" ]]; then
    log "[✓] API health check passed (HTTP 200)"
else
    log "[✗] API health check failed (HTTP $HEALTH)"
fi

# ── Cleanup old images ──
log "[*] Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1 || true

log ""
log "=== Deployment Complete ==="
log "Branch:  $BRANCH"
log "Time:    $(date)"
log "Containers:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | while IFS= read -r line; do log "  $line"; done

echo ""
echo "Deployment log: $DEPLOY_LOG"
