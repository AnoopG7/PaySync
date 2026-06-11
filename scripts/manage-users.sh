#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# manage-users.sh — Linux User & Group Administration for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./manage-users.sh add <username>              Create user + docker group
#   ./manage-users.sh remove <username>           Delete user
#   ./manage-users.sh list                        List all PaySync users
#   ./manage-users.sh add-to-group <user> <group> Add user to supplementary group
#   ./manage-users.sh ssh-key <username> <key>    Set SSH public key for user
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PAYSYNC_HOME="/opt/paysync"
SCRIPT_NAME=$(basename "$0")

usage() {
    echo "Usage: $SCRIPT_NAME {add|remove|list|add-to-group|ssh-key} [args...]"
    echo ""
    echo "Commands:"
    echo "  add <username>                    Create user with home + docker group"
    echo "  remove <username>                 Remove user and their home directory"
    echo "  list                              List all users who are PaySync staff"
    echo "  add-to-group <user> <group>       Add user to a supplementary group"
    echo "  ssh-key <username> '<pubkey>'     Set SSH authorized key for user"
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# -- Ensure we're on a Linux system with required tools
if [[ "$(uname)" != "Linux" ]]; then
    echo "[WARN] This script is designed for Linux (Amazon Linux / Ubuntu)."
    echo "       You can still study the logic for the exam."
fi

case "${1:-}" in
    add)
        USERNAME="${2:-}"
        if [[ -z "$USERNAME" ]]; then
            echo "Error: username required"
            usage
        fi
        if id "$USERNAME" &>/dev/null; then
            echo "User '$USERNAME' already exists."
            exit 0
        fi
        echo "[*] Creating user: $USERNAME"
        sudo useradd -m -s /bin/bash -c "PaySync User" "$USERNAME"
        echo "[*] Setting initial password (user must change on login)"
        echo "$USERNAME:PaySync@123" | sudo chpasswd
        sudo passwd --expire "$USERNAME" 2>/dev/null || true
        echo "[*] Adding $USERNAME to 'docker' group for container management"
        sudo usermod -aG docker "$USERNAME"
        echo "[*] Adding $USERNAME to 'sudo' group for administrative access"
        sudo usermod -aG sudo "$USERNAME"
        echo "[✓] User $USERNAME created successfully."
        echo "    Groups: $(groups "$USERNAME")"
        ;;
    remove)
        USERNAME="${2:-}"
        if [[ -z "$USERNAME" ]]; then
            echo "Error: username required"
            usage
        fi
        if ! id "$USERNAME" &>/dev/null; then
            echo "User '$USERNAME' does not exist."
            exit 0
        fi
        echo "[*] Removing user: $USERNAME"
        sudo userdel -r "$USERNAME" 2>/dev/null || {
            echo "[!] Could not delete home directory. Removing user only."
            sudo userdel "$USERNAME"
        }
        echo "[✓] User $USERNAME removed."
        ;;
    list)
        echo "=== PaySync Platform Users ==="
        echo "USERNAME    UID    GROUPS                HOME"
        echo "----------------------------------------------"
        awk -F: '!/^nobody|^root|^daemon|^bin|^sys|^games|^man|^mail|^news|^uucp/ && $3 >= 1000 { print $1, $3, $5 }' /etc/passwd 2>/dev/null || \
        cut -d: -f1,3,5 /etc/passwd | grep -E '^[^:]+:[0-9]{4,}:' | while IFS=: read -r user uid rest; do
            groups=$(groups "$user" 2>/dev/null | cut -d: -f2)
            echo "$user    $uid    $groups"
        done
        echo "----------------------------------------------"
        echo "[*] To check if Docker is installed: docker --version"
        echo "[*] To check Docker group membership: getent group docker"
        ;;
    add-to-group)
        USERNAME="${2:-}"
        GROUPNAME="${3:-}"
        if [[ -z "$USERNAME" || -z "$GROUPNAME" ]]; then
            echo "Error: username and group required"
            usage
        fi
        if ! id "$USERNAME" &>/dev/null; then
            echo "Error: user '$USERNAME' does not exist"
            exit 1
        fi
        if ! getent group "$GROUPNAME" &>/dev/null; then
            echo "[*] Group '$GROUPNAME' does not exist. Creating it."
            sudo groupadd "$GROUPNAME"
        fi
        sudo usermod -aG "$GROUPNAME" "$USERNAME"
        echo "[✓] User $USERNAME added to group $GROUPNAME"
        ;;
    ssh-key)
        USERNAME="${2:-}"
        PUBKEY="${3:-}"
        if [[ -z "$USERNAME" || -z "$PUBKEY" ]]; then
            echo "Error: username and public key required"
            usage
        fi
        if ! id "$USERNAME" &>/dev/null; then
            echo "Error: user '$USERNAME' does not exist"
            exit 1
        fi
        SSH_DIR="/home/$USERNAME/.ssh"
        sudo mkdir -p "$SSH_DIR"
        echo "$PUBKEY" | sudo tee -a "$SSH_DIR/authorized_keys" > /dev/null
        sudo chmod 700 "$SSH_DIR"
        sudo chmod 600 "$SSH_DIR/authorized_keys"
        sudo chown -R "$USERNAME:$USERNAME" "$SSH_DIR"
        echo "[✓] SSH public key installed for $USERNAME"
        ;;
    *)
        usage
        ;;
esac
