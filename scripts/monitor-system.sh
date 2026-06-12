#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# monitor-system.sh — Process Monitoring & System Logs for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Demonstrates Linux process monitoring, system log inspection, and
# troubleshooting commands for the PaySync platform.
#
# References:
#   - ps:     https://man7.org/linux/man-pages/man1/ps.1.html
#   - top:    https://man7.org/linux/man-pages/man1/top.1.html
#   - df:     https://man7.org/linux/man-pages/man1/df.1.html
#   - free:   https://man7.org/linux/man-pages/man1/free.1.html
#   - journalctl: https://man7.org/linux/man-pages/man1/journalctl.1.html
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  PaySync System Monitoring Report"
echo "  Generated: $(date)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── Section 1: System Uptime & Load ──
echo "───────────────────────────────────────────────────────────────"
echo "  1. SYSTEM UPTIME & LOAD"
echo "───────────────────────────────────────────────────────────────"
uptime
echo ""
echo "Load averages (1/5/15 min): $(cat /proc/loadavg 2>/dev/null | cut -d' ' -f1-3 || sysctl -n vm.loadavg 2>/dev/null || echo 'N/A')"
echo ""

# ── Section 2: CPU & Memory ──
echo "───────────────────────────────────────────────────────────────"
echo "  2. CPU & MEMORY USAGE"
echo "───────────────────────────────────────────────────────────────"
echo "--- Memory (free -h) ---"
free -h 2>/dev/null || vm_stat 2>/dev/null || echo "Memory info not available"
echo ""
echo "--- Top CPU-consuming processes ---"
ps aux --sort=-%cpu 2>/dev/null | head -6 || ps aux -r 2>/dev/null | head -6
echo ""

# ── Section 3: Disk Usage ──
echo "───────────────────────────────────────────────────────────────"
echo "  3. DISK USAGE"
echo "───────────────────────────────────────────────────────────────"
df -h 2>/dev/null || echo "df not available"
echo ""
echo "--- Largest directories under /opt/paysync (if exists) ---"
if [[ -d /opt/paysync ]]; then
    du -sh /opt/paysync/*/ 2>/dev/null | sort -rh | head -10
else
    echo "/opt/paysync does not exist"
fi
echo ""

# ── Section 4: Running Processes (Docker) ──
echo "───────────────────────────────────────────────────────────────"
echo "  4. DOCKER CONTAINERS"
echo "───────────────────────────────────────────────────────────────"
if command -v docker &>/dev/null; then
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not running"
else
    echo "Docker not installed"
fi
echo ""

# ── Section 5: System Logs (last 20 lines) ──
echo "───────────────────────────────────────────────────────────────"
echo "  5. RECENT SYSTEM LOGS (journalctl /var/log/syslog)"
echo "───────────────────────────────────────────────────────────────"
if command -v journalctl &>/dev/null; then
    echo "--- Last 10 kernel messages ---"
    sudo journalctl -k -n 10 --no-pager 2>/dev/null || echo "journalctl not available (try: /var/log/syslog)"
elif [[ -f /var/log/syslog ]]; then
    tail -10 /var/log/syslog 2>/dev/null
elif [[ -f /var/log/messages ]]; then
    tail -10 /var/log/messages 2>/dev/null
else
    echo "No system logs found"
fi
echo ""

# ── Section 6: Open Ports ──
echo "───────────────────────────────────────────────────────────────"
echo "  6. LISTENING PORTS"
echo "───────────────────────────────────────────────────────────────"
ss -tlnp 2>/dev/null | head -15 || netstat -tlnp 2>/dev/null | head -15 || echo "Socket stats not available"
echo ""

# ── Section 7: Network Connections ──
echo "───────────────────────────────────────────────────────────────"
echo "  7. NETWORK CONNECTIONS"
echo "───────────────────────────────────────────────────────────────"
ss -tun 2>/dev/null | head -10 || netstat -tun 2>/dev/null | head -10 || echo "N/A"
echo ""

# ── Section 8: Troubleshooting Tips ──
echo "───────────────────────────────────────────────────────────────"
echo "  8. TROUBLESHOOTING CHEAT SHEET"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "  🔍 Process Issues:"
echo "     ps aux | grep node          # Check if Node/Express is running"
echo "     top -o %CPU                 # Live CPU monitor"
echo "     htop                        # Interactive process viewer"
echo ""
echo "  🔍 Log Issues:"
echo "     tail -f /var/log/syslog     # Watch system logs"
echo "     journalctl -u docker        # Docker service logs"
echo "     docker logs backend         # PaySync backend logs"
echo "     docker logs frontend        # PaySync frontend logs"
echo ""
echo "  🔍 Network Issues:"
echo "     curl localhost:3001/api/health  # Check backend health"
echo "     curl localhost:80               # Check frontend health"
echo "     ping -c 3 google.com            # Check internet connectivity"
echo "     nslookup aws.amazon.com         # DNS resolution"
echo ""
echo "  🔍 Disk Issues:"
echo "     df -h                        # Disk space usage"
echo "     du -sh /opt/paysync/*        # App directory sizes"
echo "     lsof | grep deleted          # Find file handle leaks"
echo ""
echo "  🔍 Docker Issues:"
echo "     docker ps -a                 # All containers (incl. stopped)"
echo "     docker logs backend --tail 50  # Last 50 log lines"
echo "     docker compose down && docker compose up -d  # Restart stack"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Report complete."
echo "═══════════════════════════════════════════════════════════════"
