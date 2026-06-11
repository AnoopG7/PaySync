#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# set-permissions.sh — File Permission Configuration for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Secures the PaySync application directory with appropriate ownership,
# file modes, and read/write/execute rules for security compliance.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PAYSYNC_HOME="/opt/paysync"
DEPLOY_USER="paysync"
DEPLOY_GROUP="paysync"

echo "=== PaySync File Permission Setup ==="
echo "Target: $PAYSYNC_HOME"
echo ""

if [[ ! -d "$PAYSYNC_HOME" ]]; then
    echo "[!] Directory $PAYSYNC_HOME does not exist."
    echo "    Run server-init.sh first or create the directory manually:"
    echo "    sudo mkdir -p $PAYSYNC_HOME"
    exit 1
fi

# ── Step 1: Create dedicated service user if needed ──
if ! id "$DEPLOY_USER" &>/dev/null; then
    echo "[*] Creating service user: $DEPLOY_USER"
    sudo useradd --no-create-home --shell /sbin/nologin "$DEPLOY_USER"
fi

if ! getent group "$DEPLOY_GROUP" &>/dev/null; then
    echo "[*] Creating service group: $DEPLOY_GROUP"
    sudo groupadd "$DEPLOY_GROUP"
fi

# ── Step 2: Set ownership recursively ──
echo "[*] Setting ownership to $DEPLOY_USER:$DEPLOY_GROUP"
sudo chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$PAYSYNC_HOME"

# ── Step 3: Set directory permissions ──
echo "[*] Setting 755 on all directories (rwxr-xr-x)"
sudo find "$PAYSYNC_HOME" -type d -exec chmod 755 {} +

# ── Step 4: Set file permissions ──
echo "[*] Setting 644 on all files (rw-r--r--)"
sudo find "$PAYSYNC_HOME" -type f -exec chmod 644 {} +

# ── Step 5: Make scripts executable ──
if [[ -d "$PAYSYNC_HOME/scripts" ]]; then
    echo "[*] Making shell scripts executable (755)"
    sudo find "$PAYSYNC_HOME/scripts" -name '*.sh' -exec chmod 755 {} +
fi

# ── Step 6: Protect sensitive files ──
echo "[*] Protecting .env file (600 — owner read/write only)"
ENV_FILE="$PAYSYNC_HOME/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
    sudo chmod 600 "$ENV_FILE"
    sudo chown "$DEPLOY_USER:$DEPLOY_GROUP" "$ENV_FILE"
fi

echo "[*] Protecting SSH-related artifacts"
find "$PAYSYNC_HOME" -name 'id_rsa' -o -name 'id_ed25519' 2>/dev/null | while read -r key; do
    sudo chmod 600 "$key"
    echo "    Secured: $key"
done

# ── Step 7: SQLite database file permissions ──
DB_FILE="$PAYSYNC_HOME/backend/data/paysync.db"
if [[ -f "$DB_FILE" ]]; then
    echo "[*] Setting 644 on database file"
    sudo chmod 644 "$DB_FILE"
fi

# ── Verify ──
echo ""
echo "=== Verification ==="
echo "Owner: $(stat -c '%U:%G' "$PAYSYNC_HOME" 2>/dev/null || stat -f '%Su:%Sg' "$PAYSYNC_HOME" 2>/dev/null || echo 'N/A')"
echo "Root perms: $(stat -c '%a' "$PAYSYNC_HOME" 2>/dev/null || stat -f '%Lp' "$PAYSYNC_HOME" 2>/dev/null || echo 'N/A')"
echo ""
echo "[✓] Permissions configured successfully."
echo ""
echo "Manual references:"
echo "  chmod — change file modes: https://man7.org/linux/man-pages/man1/chmod.1.html"
echo "  chown — change file owner: https://man7.org/linux/man-pages/man1/chown.1.html"
echo "  chgrp — change group:      https://man7.org/linux/man-pages/man1/chgrp.1.html"
