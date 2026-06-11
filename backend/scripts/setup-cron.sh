#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-cron.sh — Cron Job Installation for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Installs all required cron jobs for automated PaySync platform maintenance.
# Run once during initial server setup.
#
# Cron schedule:
#   Every 5 min   → health-check.sh    (system + application monitoring)
#   Daily at 2am  → backup.sh          (database backup)
#   Weekly at 3am → rotate-logs.sh     (log rotation & archival)
#
# References:
#   - cron: https://man7.org/linux/man-pages/man8/cron.8.html
#   - crontab: https://man7.org/linux/man-pages/man5/crontab.5.html
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPTS_DIR="/opt/paysync/backend/scripts"
CRON_FILE="/tmp/paysync-crontab"

echo "=== PaySync Cron Setup ==="
echo ""

# ── Verify scripts exist ──
echo "[*] Verifying script paths..."
for script in health-check.sh backup.sh rotate-logs.sh; do
    if [[ -f "${SCRIPTS_DIR}/${script}" ]]; then
        echo "  ✓ ${script} found"
    else
        echo "  ✗ ${script} NOT found at ${SCRIPTS_DIR}/${script}"
        echo "    Will still install cron entry (fix path later if needed)"
    fi
done
echo ""

# ── Create crontab content ──
echo "[*] Building crontab..."

cat > "$CRON_FILE" << EOF
# ── PaySync Cloud Cron Jobs ──────────────────────────────────────────
# Managed by setup-cron.sh — do not edit manually
# Last updated: $(date)

# Health check every 5 minutes
*/5 * * * * ${SCRIPTS_DIR}/health-check.sh > /dev/null 2>&1

# Database backup daily at 2:00 AM
0 2 * * * ${SCRIPTS_DIR}/backup.sh > /dev/null 2>&1

# Log rotation weekly on Sunday at 3:00 AM
0 3 * * 0 ${SCRIPTS_DIR}/rotate-logs.sh > /dev/null 2>&1

# ── System Maintenance ───────────────────────────────────────────────

# Clean Docker unused resources daily at 4:00 AM
0 4 * * * docker system prune -f --volumes > /dev/null 2>&1

# ── PaySync Cloud Cron Jobs End ──────────────────────────────────────
EOF

echo "[✓] Crontab content written."

# ── Install crontab ──
echo "[*] Installing crontab for current user..."
crontab "$CRON_FILE" 2>&1 || {
    echo "[!] Failed to install crontab. Trying with sudo..."
    sudo crontab -u "$(whoami)" "$CRON_FILE" 2>/dev/null || {
        echo "[✗] Could not install crontab. Manual step required."
        echo "    Run: crontab ${CRON_FILE}"
        exit 1
    }
}

rm -f "$CRON_FILE"

# ── Verify installation ──
echo ""
echo "[*] Verifying installed cron jobs..."
crontab -l 2>/dev/null || sudo crontab -l 2>/dev/null || echo "  (could not list crontab)"
echo ""

# ── Ensure cron daemon is running ──
echo "[*] Checking cron daemon status..."
if command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet cron 2>/dev/null || systemctl is-active --quiet crond 2>/dev/null; then
        echo "  ✓ Cron daemon is running"
    else
        echo "  [!] Cron daemon not running. Starting..."
        sudo systemctl start cron 2>/dev/null || sudo systemctl start crond 2>/dev/null || {
            echo "  [!] Could not start cron. Start manually: sudo systemctl start cron"
        }
    fi
fi

echo ""
echo "[✓] Cron setup complete."
echo ""
echo "Installed schedule:"
echo "  ┌─────────────┬──────────────────────┬──────────────────────┐"
echo "  │ Interval     │ Script               │ Purpose              │"
echo "  ├─────────────┼──────────────────────┼──────────────────────┤"
echo "  │ Every 5 min │ health-check.sh      │ System monitoring    │"
echo "  │ Daily 2am   │ backup.sh            │ DB backup            │"
echo "  │ Sun 3am     │ rotate-logs.sh       │ Log rotation         │"
echo "  │ Daily 4am   │ docker system prune  │ Cleanup              │"
echo "  └─────────────┴──────────────────────┴──────────────────────┘"
echo ""
echo "To edit manually: crontab -e"
echo "To view logs: grep CRON /var/log/syslog"
