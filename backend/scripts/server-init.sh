#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# server-init.sh — EC2 Bootstrap / Server Initialization for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# One-time setup script for a fresh EC2 instance. Installs prerequisites,
# clones the repository, and starts the application.
#
# This can be passed as EC2 user_data during launch for fully automated setup.
#
# Usage:
#   sudo bash server-init.sh
#   # Or pass as EC2 user-data (base64 encoded)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration (override via environment) ──
GIT_REPO="${GIT_REPO_URL:-https://github.com/YOUR_ORG/paysync-cloud.git}"
DEPLOY_DIR="/opt/paysync"
BRANCH="${DEPLOY_BRANCH:-main}"
LOG_FILE="/var/log/paysync-init.log"

# Redirect all output to log file
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══════════════════════════════════════════════════════════════"
echo "  PaySync Cloud — Server Initialization"
echo "  Started: $(date)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── Step 1: System Update ──
echo "────────────────────────────────────────────"
echo "  [1/6] System Update"
echo "────────────────────────────────────────────"
if command -v apt &>/dev/null; then
    apt update -y && apt upgrade -y
elif command -v yum &>/dev/null; then
    yum update -y
fi
echo "[✓] System updated."
echo ""

# ── Step 2: Install Dependencies ──
echo "────────────────────────────────────────────"
echo "  [2/6] Installing Dependencies"
echo "────────────────────────────────────────────"
if command -v apt &>/dev/null; then
    apt install -y git curl wget sqlite3 ufw htop
elif command -v yum &>/dev/null; then
    yum install -y git curl wget sqlite ufw htop
fi
echo "[✓] Dependencies installed."
echo ""

# ── Step 3: Install Docker (if not present) ──
echo "────────────────────────────────────────────"
echo "  [3/6] Installing Docker"
echo "────────────────────────────────────────────"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "[✓] Docker installed: $(docker --version)"
else
    echo "[✓] Docker already installed: $(docker --version)"
fi

# Install Docker Compose plugin if missing
if ! docker compose version &>/dev/null; then
    apt install -y docker-compose-plugin 2>/dev/null || \
    yum install -y docker-compose-plugin 2>/dev/null || true
fi
echo "[✓] Docker Compose: $(docker compose version 2>/dev/null || echo 'N/A')"
echo ""

# ── Step 4: Clone Repository ──
echo "────────────────────────────────────────────"
echo "  [4/6] Cloning Repository"
echo "────────────────────────────────────────────"
if [[ -d "$DEPLOY_DIR" ]]; then
    echo "[*] Directory $DEPLOY_DIR already exists. Updating..."
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    mkdir -p "$(dirname "$DEPLOY_DIR")"
    git clone --branch "$BRANCH" "$GIT_REPO" "$DEPLOY_DIR"
fi
echo "[✓] Repository cloned at $DEPLOY_DIR"
echo ""

# ── Step 5: Configure & Launch ──
echo "────────────────────────────────────────────"
echo "  [5/6] Starting Application"
echo "────────────────────────────────────────────"
cd "$DEPLOY_DIR"

# Create env file from example if not exists
if [[ ! -f backend/.env ]]; then
    cat > backend/.env << EOF
PORT=3001
DB_TYPE=sqlite
JWT_SECRET=paysync-ec2-$(openssl rand -hex 16)

# ── For RDS MySQL deployment, replace DB_TYPE and uncomment: ──
# DB_TYPE=mysql
# DB_HOST=paysync-mysql.xxxxxx.us-east-1.rds.amazonaws.com
# DB_PORT=3306
# DB_NAME=paysync
# DB_USER=paysync_admin
# DB_PASSWORD=YourStrongPassword
EOF
    echo "[*] Created backend/.env with random JWT secret"
    echo "    To switch to RDS MySQL, edit backend/.env and run: docker compose up -d"
fi

# Set permissions
chmod -R 755 .
chmod 600 backend/.env 2>/dev/null || true

# Start Docker Compose
docker compose up --build -d
echo "[✓] Application started."
echo ""

# ── Step 6: Health Check ──
echo "────────────────────────────────────────────"
echo "  [6/6] Post-Deployment Verification"
echo "────────────────────────────────────────────"
sleep 10

echo "--- Docker Containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "--- API Health ---"
curl -s --max-time 5 http://localhost:3001/api/health || echo "Health check failed"

echo ""
echo "--- Frontend ---"
curl -s -o /dev/null -w "Frontend HTTP status: %{http_code}\n" --max-time 5 http://localhost:80 || echo "Frontend check failed"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Initialization Complete!"
echo "  Time: $(date)"
echo "  Log:  $LOG_FILE"
echo ""
echo "  Admin URL:  http://$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo 'localhost')"
echo "  Login:      admin@paysync.cloud / admin123"
echo "═══════════════════════════════════════════════════════════════"
