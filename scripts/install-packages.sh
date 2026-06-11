#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# install-packages.sh — Package Management for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Installs required system packages on Amazon Linux / Ubuntu for running
# the PaySync Digital Payments Cloud platform.
#
# References:
#   - apt: https://man7.org/linux/man-pages/man8/apt.8.html
#   - yum: https://man7.org/linux/man-pages/man8/yum.8.html
#   - Docker: https://docs.docker.com/engine/install/
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Detect package manager ──
detect_pkg_manager() {
    if command -v apt &>/dev/null; then
        echo "apt"
    elif command -v yum &>/dev/null; then
        echo "yum"
    elif command -v dnf &>/dev/null; then
        echo "dnf"
    else
        echo "unknown"
    fi
}

PKG_MANAGER=$(detect_pkg_manager)
echo "=== PaySync Package Installation ==="
echo "Detected package manager: $PKG_MANAGER"
echo ""

if [[ "$PKG_MANAGER" == "unknown" ]]; then
    echo "[!] Unsupported package manager. This script supports apt (Ubuntu/Debian)"
    echo "    and yum/dnf (Amazon Linux / RHEL / CentOS)."
    exit 1
fi

# ── Common packages needed for PaySync ──
COMMON_PACKAGES=(
    git
    curl
    wget
    htop
    tree
    unzip
    jq
    vim
    ufw
)

# ── Docker installation ──
install_docker() {
    if command -v docker &>/dev/null; then
        echo "[✓] Docker already installed: $(docker --version)"
        return
    fi

    echo "[*] Installing Docker..."
    case "$PKG_MANAGER" in
        apt)
            # Reference: https://docs.docker.com/engine/install/ubuntu/
            sudo apt update -y
            sudo apt install -y ca-certificates curl
            sudo install -m 0755 -d /etc/apt/keyrings
            sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
            sudo chmod a+r /etc/apt/keyrings/docker.asc
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt update -y
            sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        yum|dnf)
            # Reference: https://docs.docker.com/engine/install/centos/
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl enable docker
            sudo systemctl start docker
            ;;
    esac
    echo "[✓] Docker installed: $(docker --version)"
    echo "[✓] Docker Compose: $(docker compose version)"
}

# ── Install common packages ──
echo "[*] Installing common packages..."
case "$PKG_MANAGER" in
    apt)
        sudo apt update -y
        sudo apt install -y "${COMMON_PACKAGES[@]}"
        ;;
    yum|dnf)
        sudo "$PKG_MANAGER" install -y "${COMMON_PACKAGES[@]}"
        ;;
esac
echo "[✓] Common packages installed."

# ── Install Docker ──
install_docker

# ── Verify ──
echo ""
echo "=== Installed Versions ==="
echo "Git:     $(git --version 2>/dev/null || echo 'N/A')"
echo "Curl:    $(curl --version 2>/dev/null | head -1 || echo 'N/A')"
echo "Docker:  $(docker --version 2>/dev/null || echo 'N/A')"
echo "Compose: $(docker compose version 2>/dev/null || echo 'N/A')"
echo "Htop:    $(htop --version 2>/dev/null | head -1 || echo 'N/A')"
echo "JQ:      $(jq --version 2>/dev/null || echo 'N/A')"
echo ""
echo "[✓] Package installation complete."
echo ""
echo "Next steps:"
echo "  1. Add your user to the docker group: sudo usermod -aG docker \$USER"
echo "  2. Log out and back in for group changes to take effect."
echo "  3. Run server-init.sh to deploy the PaySync application."
