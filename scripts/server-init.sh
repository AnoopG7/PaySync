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
GIT_REPO="${GIT_REPO_URL:-https://github.com/AnoopG7/PaySync.git}"
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
echo "  [1/7] System Update"
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
echo "  [2/7] Installing Dependencies"
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
echo "  [3a/7] Installing Docker"
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

# Install Node.js 22.x (needed for Jenkins pipeline npm/tsc stages)
echo "────────────────────────────────────────────"
echo "  [3b/7] Installing Node.js 22.x"
echo "────────────────────────────────────────────"
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
    echo "[✓] Node.js: $(node --version)  npm: $(npm --version)"
else
    echo "[✓] Node.js already installed: $(node --version)"
fi
echo ""

# ── Step 4: Clone Repository ──
echo "────────────────────────────────────────────"
echo "  [4/7] Cloning Repository"
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
echo "  [5/7] Starting Application"
echo "────────────────────────────────────────────"
cd "$DEPLOY_DIR"

# Create .env file for Docker Compose (picked up by env_file: .env)
if [[ ! -f .env ]]; then
    JWT_SECRET="paysync-ec2-$(openssl rand -hex 16)"
    cat > .env << EOF
# ── Database (RDS MySQL) ──
# FIX_ME: Replace DB_HOST with the actual RDS endpoint from terraform output.
#   terraform output -raw rds_endpoint  |  cut -d: -f1
# Example: paysync-mysql.xxxxxxxxxxxx.ap-south-1.rds.amazonaws.com
DB_TYPE=mysql
DB_HOST=${RDS_HOST:-__REPLACE_ME__}
DB_PORT=3306
DB_NAME=paysync
DB_USER=paysync_admin
DB_PASSWORD=${RDS_PASSWORD:-AnoopRDS123!}

# ── Auth ──
JWT_SECRET=$JWT_SECRET

# ── Backend Port ──
PORT=3001
EOF
    echo "[*] Created .env (placeholder RDS_HOST — fix after SSH!)"
fi

# Add ubuntu user to docker group
usermod -aG docker ubuntu 2>/dev/null || true
echo "[*] Added ubuntu to docker group. (Logout and SSH back in for it to take effect — no need for newgrp)"

# Set permissions
chmod -R 755 .
chmod 640 .env && chgrp docker .env 2>/dev/null || true

# Start Docker Compose
docker compose up --build -d
echo "[✓] Application started."
echo ""

# ── Step 6: Health Check ──
echo "────────────────────────────────────────────"
echo "  [6/7] Post-Deployment Verification"
echo "────────────────────────────────────────────"
sleep 10

echo "--- Docker Containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "--- API Health ---"
curl -s --max-time 5 http://localhost/api/health || echo "Health check failed"

echo ""
echo "--- Frontend ---"
curl -s -o /dev/null -w "Frontend HTTP status: %{http_code}\n" --max-time 5 http://localhost:80 || echo "Frontend check failed"

echo ""

# ── Step 7: Supporting Services (CloudWatch, Jenkins, Cron) ──
echo "────────────────────────────────────────────"
echo "  [7/7] Supporting Services"
echo "────────────────────────────────────────────"

echo "--- CloudWatch Setup ---"
bash "$DEPLOY_DIR/scripts/setup-cloudwatch.sh" || echo "[!] CloudWatch setup had warnings (see above)"

echo ""
echo "--- Jenkins Setup ---"
bash "$DEPLOY_DIR/scripts/setup-jenkins.sh" || echo "[!] Jenkins setup had warnings (see above)"

echo ""
echo "--- Cron Setup ---"
bash "$DEPLOY_DIR/scripts/setup-cron.sh" || echo "[!] Cron setup had warnings (see above)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Initialization Complete!"
echo "  Time: $(date)"
echo "  Log:  $LOG_FILE"
echo ""
echo "  Admin URL:  http://$(curl -s http://checkip.amazonaws.com || echo '<PENDING-EIP>')"
echo "  Jenkins:    http://$(curl -s http://checkip.amazonaws.com || echo '<PENDING-EIP>'):8080"
echo "  Login:      admin@paysync.cloud / admin123"
echo "═══════════════════════════════════════════════════════════════"
