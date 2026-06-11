#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# health-check.sh — System & Application Health Monitoring for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Checks API health, Docker container status, disk space, and memory usage.
# Designed to run as a cron job (every 5 minutes).
#
# Reference:
#   - CloudWatch alarms should be set alongside this for production monitoring.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ──
API_URL="http://localhost:3001/api/health"
DISK_WARN_PCT=80
MEM_WARN_PCT=80
ALERT_LOG="/var/log/paysync/health-alerts.log"

# ── Timestamp helper ──
now() { date +"%Y-%m-%d %H:%M:%S"; }

# ── Ensure log directory exists ──
mkdir -p "$(dirname "$ALERT_LOG")" 2>/dev/null || true

alert() {
    local level="$1"
    local message="$2"
    echo "[$(now)] [$level] $message" | tee -a "$ALERT_LOG"
}

echo "=== PaySync Health Check @ $(now) ==="
echo ""

FAILED=0

# ── 1. API Health ──
echo "────────────────────────────────────────────"
echo "  1. API HEALTH"
echo "────────────────────────────────────────────"
if command -v curl &>/dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        echo "   [✓] API is healthy (HTTP $HTTP_CODE)"
    else
        echo "   [✗] API returned HTTP $HTTP_CODE"
        alert "CRITICAL" "API health check failed: HTTP $HTTP_CODE"
        FAILED=$((FAILED + 1))
    fi
else
    echo "   [!] curl not installed"
    alert "WARNING" "curl not available for health check"
fi
echo ""

# ── 2. Docker Containers ──
echo "────────────────────────────────────────────"
echo "  2. DOCKER CONTAINERS"
echo "────────────────────────────────────────────"
if command -v docker &>/dev/null; then
    CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null || true)
    if echo "$CONTAINERS" | grep -q "backend"; then
        echo "   [✓] Backend container is running"
    else
        echo "   [✗] Backend container is NOT running"
        alert "CRITICAL" "Backend container is down"
        FAILED=$((FAILED + 1))
    fi
    if echo "$CONTAINERS" | grep -q "frontend"; then
        echo "   [✓] Frontend container is running"
    else
        echo "   [✗] Frontend container is NOT running"
        alert "CRITICAL" "Frontend container is down"
        FAILED=$((FAILED + 1))
    fi
else
    echo "   [!] Docker not installed"
    alert "WARNING" "Docker not installed"
fi
echo ""

# ── 3. Disk Usage ──
echo "────────────────────────────────────────────"
echo "  3. DISK USAGE"
echo "────────────────────────────────────────────"
if command -v df &>/dev/null; then
    df -h / | tail -1 | awk '{print "   Root: " $5 " used (" $3 "/" $2 ")"}'
    df -h / | tail -1 | awk '{gsub(/%/, "", $5); if ($5+0 > '"$DISK_WARN_PCT"') exit 1}' || {
        echo "   [✗] Disk usage exceeds ${DISK_WARN_PCT}% threshold!"
        alert "WARNING" "Disk usage above ${DISK_WARN_PCT}%"
        FAILED=$((FAILED + 1))
    }
else
    echo "   [!] df not available"
fi

# Check Docker disk usage
if command -v docker &>/dev/null; then
    echo ""
    docker system df 2>/dev/null || true
fi
echo ""

# ── 4. Memory Usage ──
echo "────────────────────────────────────────────"
echo "  4. MEMORY USAGE"
echo "────────────────────────────────────────────"
if command -v free &>/dev/null; then
    MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
    MEM_USED=$(free -m | awk '/^Mem:/{print $3}')
    MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
    echo "   Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
    if [[ "$MEM_PCT" -gt "$MEM_WARN_PCT" ]]; then
        echo "   [✗] Memory usage exceeds ${MEM_WARN_PCT}% threshold!"
        alert "WARNING" "Memory usage at ${MEM_PCT}%"
        FAILED=$((FAILED + 1))
    fi

    SWAP_USED=$(free -m | awk '/^Swap:/{print $3}')
    if [[ "${SWAP_USED:-0}" -gt 0 ]]; then
        echo "   Swap: ${SWAP_USED}MB used"
    fi
else
    echo "   [!] free not available"
fi
echo ""

# ── 5. Application-Specific Checks ──
echo "────────────────────────────────────────────"
echo "  5. APPLICATION CHECKS"
echo "────────────────────────────────────────────"
# Check if backend is responding with valid JSON
if command -v curl &>/dev/null; then
    RESPONSE=$(curl -s --max-time 5 "$API_URL" 2>/dev/null || echo '{"status":"error"}')
    STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
    if [[ "$STATUS" == "ok" ]]; then
        echo "   [✓] Backend API response valid"
    else
        echo "   [✗] Backend API returned unexpected status: $STATUS"
        FAILED=$((FAILED + 1))
    fi
fi

# Check SQLite database integrity
if [[ -f /opt/paysync/backend/data/paysync.db ]]; then
    if command -v sqlite3 &>/dev/null; then
        INTEGRITY=$(sqlite3 /opt/paysync/backend/data/paysync.db "PRAGMA integrity_check;" 2>/dev/null || echo "error")
        if [[ "$INTEGRITY" == "ok" ]]; then
            echo "   [✓] SQLite database integrity check passed"
        else
            echo "   [✗] Database integrity check failed: $INTEGRITY"
            alert "CRITICAL" "Database integrity check failed"
            FAILED=$((FAILED + 1))
        fi
    fi
fi
echo ""

# ── Summary ──
echo "────────────────────────────────────────────"
if [[ "$FAILED" -eq 0 ]]; then
    echo "   [✓] All checks passed — PaySync is healthy"
else
    echo "   [✗] $FAILED check(s) failed — review alerts above"
fi
echo "────────────────────────────────────────────"
echo ""
echo "Alerts logged to: $ALERT_LOG"
exit "$FAILED"
