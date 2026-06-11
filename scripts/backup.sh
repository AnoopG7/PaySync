#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# backup.sh — Database Backup & Recovery for PaySync Cloud
# ──────────────────────────────────────────────────────────────────────────────
# Creates timestamped dumps (SQLite .dump or mysqldump depending on DB_TYPE),
# compresses them, and cleans up old backups. Designed to run as a cron job
# for automated disaster recovery readiness.
#
# RPO: 1 hour (runs hourly via cron)
# RTO: 4 hours (restore from latest backup + docker compose up)
#
# Supports:
#   - DB_TYPE=sqlite  → sqlite3 .dump (local dev)
#   - DB_TYPE=mysql   → mysqldump via Docker (AWS RDS / local MySQL)
#   - S3 upload       → if S3_BACKUP_BUCKET is set and aws cli available
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ──
PAYSYNC_HOME="/opt/paysync"
BACKUP_DIR="${PAYSYNC_HOME}/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/paysync-${TIMESTAMP}.sql"
BACKUP_GZ="${BACKUP_FILE}.gz"

# Database type (sqlite or mysql) — set in .env on EC2
DB_TYPE="${DB_TYPE:-sqlite}"

# MySQL / RDS connection params (from .env)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-paysync}"
DB_USER="${DB_USER:-paysync_admin}"
DB_PASSWORD="${DB_PASSWORD:-}"

# SQLite path (local dev)
DB_FILE="${DB_FILE:-${PAYSYNC_HOME}/backend/data/paysync.db}"

# Optional: S3 bucket for off-site backups
S3_BUCKET="${S3_BACKUP_BUCKET:-}"

# ── Ensure backup directory exists ──
mkdir -p "$BACKUP_DIR"

echo "=== PaySync Database Backup ==="
echo "Time:    $(date)"
echo "Type:    $DB_TYPE"
echo "Dest:    $BACKUP_GZ"
echo ""

# ── Create dump ──
case "$DB_TYPE" in
  sqlite)
    if [[ ! -f "$DB_FILE" ]]; then
      echo "[!] SQLite DB not found at $DB_FILE"
      exit 1
    fi
    echo "[*] Dumping SQLite..."
    if command -v sqlite3 &>/dev/null; then
      sqlite3 "$DB_FILE" .dump > "$BACKUP_FILE"
    elif command -v docker &>/dev/null; then
      docker run --rm -v "$DB_FILE:/data/db.sqlite" -v "$BACKUP_DIR:/backups" \
        alpine/sqlite:latest /data/db.sqlite .dump > "$BACKUP_FILE" 2>/dev/null || {
        echo "[!] sqlite3 dump failed."
        exit 1
      }
    else
      echo "[!] sqlite3 not found. Install: sudo apt install sqlite3"
      exit 1
    fi
    ;;
  mysql)
    if [[ -z "$DB_PASSWORD" ]]; then
      echo "[!] DB_PASSWORD not set. Cannot connect to MySQL."
      exit 1
    fi
    echo "[*] Dumping MySQL from ${DB_HOST}:${DB_PORT}/${DB_NAME}..."
    if command -v mysqldump &>/dev/null; then
      MYSQL_PWD="$DB_PASSWORD" mysqldump \
        -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
        --single-transaction --routines --triggers \
        "$DB_NAME" > "$BACKUP_FILE"
    elif command -v docker &>/dev/null; then
      docker run --rm \
        -e MYSQL_PWD="$DB_PASSWORD" \
        mysql:8.0 \
        mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
          --single-transaction --routines --triggers \
          "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || {
        echo "[!] mysqldump via Docker failed."
        exit 1
      }
    else
      echo "[!] mysqldump not found. Install: sudo apt install mysql-client"
      exit 1
    fi
    ;;
  *)
    echo "[!] Unknown DB_TYPE: $DB_TYPE (use sqlite or mysql)"
    exit 1
    ;;
esac

# Verify dump
if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "[!] Backup file is empty. Backup may have failed."
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[✓] Dump created: $(wc -l < "$BACKUP_FILE") lines"

# ── Compress ──
echo "[*] Compressing with gzip..."
gzip -f "$BACKUP_FILE"
echo "[✓] Compressed: $(du -h "$BACKUP_GZ" | cut -f1)"

# ── Latest symlink ──
ln -sf "$BACKUP_GZ" "${BACKUP_DIR}/paysync-latest.sql.gz"
echo "[✓] Symlinked: paysync-latest.sql.gz"

# ── Clean old backups ──
echo "[*] Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'paysync-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
echo "[✓] Old backups cleaned."

# ── Upload to S3 ──
if [[ -n "$S3_BUCKET" ]]; then
  if command -v aws &>/dev/null; then
    echo "[*] Uploading to S3: s3://${S3_BUCKET}/backups/"
    aws s3 cp "$BACKUP_GZ" "s3://${S3_BUCKET}/backups/" --storage-class STANDARD_IA
    echo "[✓] Uploaded to S3."
  else
    echo "[!] AWS CLI not installed. Install: sudo apt install awscli"
  fi
fi

# ── Summary ──
echo ""
echo "=== Backup Summary ==="
echo "File:      $BACKUP_GZ"
echo "Size:      $(du -h "$BACKUP_GZ" | cut -f1)"
echo "Retention: $RETENTION_DAYS days"
echo "S3 Backup: $([ -n "$S3_BUCKET" ] && echo 'Enabled' || echo 'Disabled')"
echo ""
echo "To restore:"
echo "  SQLite: gunzip -c paysync-latest.sql.gz | sqlite3 paysync.db"
echo "  MySQL:  gunzip -c paysync-latest.sql.gz | mysql -h HOST -u USER -p DB_NAME"
echo ""
echo "[✓] Backup complete."
