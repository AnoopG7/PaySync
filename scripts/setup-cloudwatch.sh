#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# setup-cloudwatch.sh — Install & configure CloudWatch agent, dashboard, alarms
# ──────────────────────────────────────────────────────────────────────────────
# Run this ON the EC2 instance (after server-init.sh completes).
# Requires: AWS credentials configured on the instance (or instance profile).
#
# Usage:
#   sudo bash scripts/setup-cloudwatch.sh
# ──────────────────────────────────────────────────────────────────────────────

REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_ID=""
RDS_INSTANCE="paysync-mysql"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"
CW_CONFIG="/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json"
LOG_FILE="/var/log/paysync-cw-setup.log"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══════════════════════════════════════════════════════════════"
echo "  PaySync — CloudWatch Setup"
echo "  Started: $(date)"
echo "═══════════════════════════════════════════════════════════════"

# Get instance ID
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
echo "[*] Instance ID: $INSTANCE_ID"

# ── 1. Install CloudWatch Agent ──
echo "[1/4] Installing CloudWatch Agent"
if ! command -v amazon-cloudwatch-agent-ctl &>/dev/null; then
    curl -sLo /tmp/amazon-cloudwatch-agent.deb \
        "https://s3.$REGION.amazonaws.com/amazoncloudwatch-agent-$REGION/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb"
    dpkg -i -E /tmp/amazon-cloudwatch-agent.deb
    rm -f /tmp/amazon-cloudwatch-agent.deb
    echo "[✓] CloudWatch agent installed"
else
    echo "[✓] CloudWatch agent already installed"
fi

# ── 2. Write agent config ──
echo "[2/4] Writing agent config"
mkdir -p "$(dirname "$CW_CONFIG")"
cat > "$CW_CONFIG" << CWEOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root",
    "logfile": "/var/log/amazon/amazon-cloudwatch-agent/amazon-cloudwatch-agent.log"
  },
  "metrics": {
    "namespace": "CWAgent",
    "append_dimensions": {
      "InstanceId": "\${aws:InstanceId}",
      "InstanceType": "\${aws:InstanceType}"
    },
    "aggregation_dimensions": [["InstanceId"]],
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {"name": "cpu_usage_idle",   "rename": "CPU_IDLE",   "unit": "Percent"},
          {"name": "cpu_usage_user",   "rename": "CPU_USER",   "unit": "Percent"},
          {"name": "cpu_usage_system", "rename": "CPU_SYSTEM", "unit": "Percent"},
          {"name": "cpu_usage_iowait", "rename": "CPU_IOWAIT", "unit": "Percent"}
        ],
        "metrics_collection_interval": 60,
        "totalcpu": true
      },
      "disk": {
        "measurement": [
          {"name": "disk_used_percent", "rename": "DISK_USED_PCT", "unit": "Percent"},
          {"name": "disk_free",         "rename": "DISK_FREE",     "unit": "Bytes"}
        ],
        "metrics_collection_interval": 60,
        "resources": ["/"],
        "ignore_file_system_types": ["tmpfs", "devtmpfs", "overlay", "squashfs"]
      },
      "mem": {
        "measurement": [
          {"name": "mem_used_percent", "rename": "MEM_USED_PCT", "unit": "Percent"},
          {"name": "mem_available",    "rename": "MEM_AVAIL",    "unit": "Bytes"}
        ],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": [
          {"name": "netstat_tcp_established", "rename": "TCP_ESTABLISHED", "unit": "Count"},
          {"name": "netstat_tcp_time_wait",   "rename": "TCP_TIMEWAIT",   "unit": "Count"}
        ],
        "metrics_collection_interval": 60
      },
      "processes": {
        "measurement": [
          {"name": "processes_total",   "rename": "PROC_TOTAL",  "unit": "Count"},
          {"name": "processes_sleeping","rename": "PROC_SLEEP",  "unit": "Count"},
          {"name": "processes_running", "rename": "PROC_RUN",    "unit": "Count"},
          {"name": "processes_zombie",  "rename": "PROC_ZOMBIE", "unit": "Count"}
        ],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/docker/containers/*/*-json.log",
            "log_group_name": "/aws/ec2/paysync/docker",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "/aws/ec2/paysync/system",
            "log_stream_name": "{instance_id}-syslog",
            "timezone": "UTC"
          }
        ]
      }
    }
  }
}
CWEOF
echo "[✓] Agent config written"

# ── 3. Start CloudWatch Agent ──
echo "[3/4] Starting CloudWatch Agent"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config -m ec2 -s \
    -c "file:$CW_CONFIG"
echo "[✓] Agent started"

# ── 4. Create CloudWatch Dashboard ──
echo "[4/4] Creating CloudWatch Dashboard"
# NOTE: Requires IAM credentials — will fail on fresh EC2 without instance profile
aws cloudwatch put-dashboard --region "$REGION" --dashboard-name paysync --dashboard-body "{
  \"widgets\": [
    {
      \"type\": \"metric\", \"x\": 0, \"y\": 0, \"width\": 12, \"height\": 6,
      \"properties\": {
        \"metrics\": [
          [\"AWS/EC2\", \"CPUUtilization\", { \"stat\": \"Average\", \"label\": \"CPU %\" }],
          [\"AWS/EC2\", \"NetworkIn\",  { \"stat\": \"Sum\", \"label\": \"Network In\" }],
          [\"AWS/EC2\", \"NetworkOut\", { \"stat\": \"Sum\", \"label\": \"Network Out\" }]
        ],
        \"period\": 300, \"region\": \"$REGION\", \"title\": \"EC2 — Compute & Network\",
        \"view\": \"timeSeries\", \"stacked\": false, \"liveData\": false
      }
    },
    {
      \"type\": \"metric\", \"x\": 12, \"y\": 0, \"width\": 12, \"height\": 6,
      \"properties\": {
        \"metrics\": [
          [\"AWS/RDS\", \"CPUUtilization\",       { \"stat\": \"Average\", \"label\": \"CPU %\" }],
          [\"AWS/RDS\", \"DatabaseConnections\",  { \"stat\": \"Average\", \"label\": \"Connections\" }],
          [\"AWS/RDS\", \"FreeStorageSpace\",     { \"stat\": \"Average\", \"label\": \"Free Storage\", \"yAxis\": \"right\" }]
        ],
        \"period\": 300, \"region\": \"$REGION\", \"title\": \"RDS — MySQL\",
        \"view\": \"timeSeries\", \"stacked\": false, \"liveData\": false
      }
    },
    {
      \"type\": \"metric\", \"x\": 0, \"y\": 6, \"width\": 8, \"height\": 6,
      \"properties\": {
        \"metrics\": [
          [\"CWAgent\", \"disk_used_percent\", { \"stat\": \"Average\", \"label\": \"Disk %\" }]
        ],
        \"period\": 300, \"region\": \"$REGION\", \"title\": \"Disk Usage\",
        \"view\": \"timeSeries\", \"yAxis\": { \"left\": { \"min\": 0, \"max\": 100 } }
      }
    },
    {
      \"type\": \"metric\", \"x\": 8, \"y\": 6, \"width\": 8, \"height\": 6,
      \"properties\": {
        \"metrics\": [
          [\"CWAgent\", \"mem_used_percent\", { \"stat\": \"Average\", \"label\": \"Memory %\" }]
        ],
        \"period\": 300, \"region\": \"$REGION\", \"title\": \"Memory\",
        \"view\": \"timeSeries\", \"yAxis\": { \"left\": { \"min\": 0, \"max\": 100 } }
      }
    },
    {
      \"type\": \"metric\", \"x\": 16, \"y\": 6, \"width\": 8, \"height\": 6,
      \"properties\": {
        \"metrics\": [
          [\"AWS/EC2\", \"StatusCheckFailed\", { \"stat\": \"Maximum\", \"label\": \"Status Check Failed\", \"period\": 60 }]
        ],
        \"period\": 60, \"region\": \"$REGION\", \"title\": \"EC2 Status Checks\",
        \"view\": \"timeSeries\", \"yAxis\": { \"left\": { \"min\": 0, \"max\": 1 } }
      }
    }
  ]
}" || echo "[!] Dashboard creation failed (expected if no IAM role — install manually later)"
echo "[✓] Dashboard step complete"
