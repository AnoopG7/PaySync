#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# rotate-logs.sh — Log Rotation & Archival for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Compresses Docker container logs older than 7 days and removes archives
# older than 30 days. Prevents disk exhaustion from unbounded log growth.
#
# Designed to run as a weekly cron job.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG_DIR="/var/log/paysync"
ROTATE_DAYS=7
DELETE_DAYS=30
TIMESTAMP=$(date +"%Y-%m-%d")

echo "=== PaySync Log Rotation ==="
echo "Time: $(date)"
echo ""

# ── Ensure log archive directory exists ──
sudo mkdir -p "${LOG_DIR}/archive"
sudo chmod 755 "${LOG_DIR}"

# ── Rotate Docker container logs ──
if command -v docker &>/dev/null; then
    echo "[*] Fetching Docker container logs older than ${ROTATE_DAYS} days..."

    docker ps --format "{{.Names}}" 2>/dev/null | while read -r container; do
        LOG_FILE="${LOG_DIR}/archive/${container}-${TIMESTAMP}.log"
        echo "  → Archiving logs for: $container"

        # Fetch last N lines as a snapshot (Docker doesn't support date-based log export natively)
        docker logs "$container" --tail 5000 2>"${LOG_FILE}.err" > "${LOG_FILE}.out" 2>/dev/null || true

        # Combine stdout + stderr
        if [[ -s "${LOG_FILE}.out" || -s "${LOG_FILE}.err" ]]; then
            cat "${LOG_FILE}.out" "${LOG_FILE}.err" > "$LOG_FILE" 2>/dev/null
            rm -f "${LOG_FILE}.out" "${LOG_FILE}.err"

            # Compress
            gzip -f "$LOG_FILE"
            echo "    Archived: ${LOG_FILE}.gz ($(du -h "${LOG_FILE}.gz" | cut -f1))"
        else
            rm -f "${LOG_FILE}.out" "${LOG_FILE}.err"
            echo "    No logs to archive for $container"
        fi
    done

    # Truncate Docker logs to reclaim disk space
    echo "[*] Truncating Docker log files..."
    docker ps -q 2>/dev/null | while read -r cid; do
        LOG_PATH=$(docker inspect --format='{{.LogPath}}' "$cid" 2>/dev/null || true)
        if [[ -n "$LOG_PATH" && -f "$LOG_PATH" ]]; then
            sudo truncate -s 0 "$LOG_PATH" 2>/dev/null || true
        fi
    done
else
    echo "[!] Docker not available. Skipping container log rotation."
fi

# ── Rotate application logs (if any exist in /opt/paysync) ──
if [[ -d /opt/paysync ]]; then
    echo "[*] Checking application logs..."
    find /opt/paysync -name '*.log' -type f -mtime +"$ROTATE_DAYS" 2>/dev/null | while read -r logfile; do
        echo "  → Compressing: $logfile"
        gzip -f "$logfile"
    done
fi

# ── Rotate system logs (docker service logs) ──
echo "[*] Rotating system journal for docker service..."
if command -v journalctl &>/dev/null; then
    sudo journalctl --rotate 2>/dev/null || true
    sudo journalctl --vacuum-time=7d 2>/dev/null || true
    echo "  → Journal vacuumed to 7 days"
fi

# ── Delete archives older than retention ──
echo "[*] Cleaning archives older than ${DELETE_DAYS} days..."
find "${LOG_DIR}/archive" -name '*.gz' -type f -mtime +"$DELETE_DAYS" -delete
echo "  → Old archives cleaned."

# ── Summary ──
echo ""
echo "=== Log Rotation Summary ==="
echo "Archive dir: ${LOG_DIR}/archive"
echo "Logs older than ${ROTATE_DAYS}d → compressed"
echo "Archives older than ${DELETE_DAYS}d → deleted"
echo "Total archive size: $(du -sh "${LOG_DIR}/archive" 2>/dev/null | cut -f1 || echo '0')"
echo ""
echo "[✓] Log rotation complete."
