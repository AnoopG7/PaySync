# AWS Deployment Guide — PaySync Cloud

> **Last Updated:** June 2026  
> **Region:** ap-south-1 (Mumbai)  
> **Prerequisites:** AWS account, Terraform installed, SSH key pair

---

## Table of Contents

1. [Quick Start (10 minutes)](#1-quick-start-10-minutes)
2. [Prerequisites](#2-prerequisites)
3. [Infrastructure Deployment (Terraform)](#3-infrastructure-deployment-terraform)
4. [EC2 Bootstrap & Application Launch](#4-ec2-bootstrap--application-launch)
5. [CI/CD Setup (Jenkins)](#5-cicd-setup-jenkins)
6. [Monitoring Setup (CloudWatch)](#6-monitoring-setup-cloudwatch)
7. [Maintenance & Operations](#7-maintenance--operations)
8. [Troubleshooting](#8-troubleshooting)
9. [Teardown](#9-teardown)

---

## 1. Quick Start (10 minutes)

The fastest path from zero to the PaySync app in your browser:

```bash
# ── Step 1: Configure AWS (one-time) ──
aws configure
#   AWS Access Key ID:     AKIA...
#   AWS Secret Access Key: wJalr...
#   Default region:        ap-south-1
#   Default output:        json

# ── Step 2: Set up terraform variables ──
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values:
#   ssh_allowed_cidr     = "YOUR_IP/32"      (curl -s http://checkip.amazonaws.com)
#   rds_master_password  = "YourStrongPassword123!"
#   key_pair_name        = "ec2-key"

# ── Step 3: Deploy infrastructure ──
terraform init                # Downloads AWS provider (~30 sec)
terraform plan                # Review — should show ~25 resources to create
terraform apply               # Type "yes" — takes ~5 minutes (RDS is the slow part)
terraform output > ../stack-outputs.txt   # Save outputs for reference

# ── Step 4: SSH in — fix RDS host, start containers ──
EC2_IP=$(terraform output -raw ec2_public_ip)
RDS_EP=$(terraform output -raw rds_endpoint | cut -d: -f1)

# The bootstrap already cloned the repo, installed Docker, Jenkins, CloudWatch.
# But .env has a placeholder DB_HOST. Fix it with a single sed command:
ssh -i ~/.ssh/ec2-key.pem ubuntu@$EC2_IP
sudo sed -i "s/DB_HOST=.*/DB_HOST=$RDS_EP/" /opt/paysync/.env
cd /opt/paysync && sudo docker compose up -d

# Verify:
curl -sf http://localhost/api/health && echo "OK"   # should return 200
curl -sI http://localhost | head -1                  # HTTP/1.1 200 OK

# ── Done! Open in your browser ──
open http://$EC2_IP
# Login: admin@paysync.cloud / admin123
# Jenkins: http://$EC2_IP:8080  (admin / admin123)
```

---

## 2. Prerequisites

### 2.1 Local Tools

```bash
# Required
aws --version        # AWS CLI v2 (install: brew install awscli)
terraform --version  # Terraform >= 1.5 (install: brew install terraform)
```

You do NOT need Docker, Node, or Jenkins on your Mac — they run on EC2.

### 2.2 AWS Account Setup

```bash
# Configure AWS CLI with your credentials
aws configure
# AWS Access Key ID:     AKIA...
# AWS Secret Access Key: wJalr...
# Default region:        ap-south-1
# Default output:        json
```

> **Need credentials?** Go to AWS Console → IAM → Users → your user → Security credentials → Create access key.

### 2.3 SSH Key Pair

You already have `ec2-key.pem` from the AWS Console (created in ap-south-1).
Place it at `~/.ssh/ec2-key.pem` and set correct permissions:

```bash
mv ~/Downloads/ec2-key.pem ~/.ssh/ec2-key.pem
chmod 400 ~/.ssh/ec2-key.pem
```

Terraform only needs the **key pair name** (`ec2-key`) — it does NOT read your `.pem` file.
The `.pem` is used locally by `ssh -i` to connect to EC2.

---

## 3. Infrastructure Deployment (Terraform)

### 3.1 Project Structure

```
AWS/
├── terraform/
│   ├── main.tf              # VPC, 1 public + 2 private subnets, IGW, S3 Endpoint
│   ├── ec2.tf               # EC2 m7i-flex.large, SG (22/80/443/8080)
│   ├── rds.tf               # RDS MySQL db.t4g.micro, private subnets
│   ├── outputs.tf           # Useful output values
│   ├── variables.tf         # All configurable variables
│   └── terraform.tfvars.example  # Template — copy, don't edit directly
├── cloudwatch/
│   ├── dashboard.json       # CloudWatch dashboard widget config (5 widgets)
│   ├── alarms.json          # 7 alarms (CPU, disk, memory, status, RDS)
│   └── cloudwatch-agent.json # CW Agent config (mem/disk/process/docker logs)
├── scripts/
│   ├── server-init.sh       # EC2 bootstrap (user_data) — runs everything below
│   ├── setup-jenkins.sh     # Native Jenkins install + inline pipeline config
│   ├── setup-cloudwatch.sh  # CloudWatch agent install + dashboard attempt
│   ├── setup-cron.sh        # Cron job installer (health, backup, rotate)
│   ├── backup.sh            # Daily DB backup (mysqldump + gzip)
│   ├── deploy-app.sh        # Manual app deployment (git pull + rebuild)
│   ├── health-check.sh      # Cron health checks (every 5 min)
│   ├── manage-users.sh      # Linux user management (add/remove/ssh-key)
│   ├── monitor-system.sh    # System diagnostic (CPU/mem/disk/network)
│   └── rotate-logs.sh       # Docker log rotation (every 6 hours)
├── backend/                 # Express API (knex, JWT auth, MySQL)
├── frontend/                # React SPA (Vite + TypeScript + shadcn/ui)
├── docker-compose.yml       # 2 services: backend + frontend (Jenkins is native)
├── Jenkinsfile              # CI/CD pipeline (also embedded inline in setup)
└── docs/
    └── aws-deployment.md    # This file
```

### 3.2 What Terraform Creates

| Resource | Spec | Notes |
|---|---|---|
| **VPC** | 10.0.0.0/16 | DNS hostnames enabled; 65,531 usable IPs |
| **Public subnet** | 10.0.1.0/24 (ap-south-1a) | EC2, EIP, NAT route live here |
| **Private subnet 1** | 10.0.10.0/24 (ap-south-1a) | RDS primary AZ |
| **Private subnet 2** | 10.0.11.0/24 (ap-south-1b) | RDS standby/multi-AZ |
| **Internet Gateway** | — | Attached to VPC, enables public access |
| **S3 Gateway Endpoint** | — | Free (no NAT needed); used by RDS backups |
| **EC2 Instance** | m7i-flex.large (2 vCPU, 8 GiB) | Ubuntu 24.04 LTS, 20 GB gp3 encrypted root volume |
| **RDS MySQL** | db.t4g.micro (1 vCPU, 1 GiB) | MySQL 8.0.44, 20 GB gp3, backup retention 7 days |
| **Security Group (EC2)** | Ingress: 22, 80, 443, 8080 | 22+8080 restricted to `ssh_allowed_cidr`; 80+443 open to all |
| **Security Group (RDS)** | Ingress: 3306 from EC2 SG | Uses SG reference, not CIDR |
| **Elastic IP** | Static IPv4 | Attached to EC2; persists across stop/start |

### 3.3 Configure Variables

Create `terraform.tfvars` from the example template:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
# terraform/terraform.tfvars

# REQUIRED — your public IP for SSH + Jenkins access
# Find it: curl -s http://checkip.amazonaws.com
ssh_allowed_cidr = "203.0.113.5/32"

# REQUIRED — RDS master password (minimum 8 chars, mix of types)
rds_master_password = "YourStrongPassword123!"

# REQUIRED — name of your existing AWS key pair (created in ap-south-1)
key_pair_name = "ec2-key"
```

> **Security note:** Never commit `terraform.tfvars`. It's in `.gitignore` already.

### 3.4 Deploy

```bash
cd terraform

# Initialize (downloads AWS provider, sets up backend)
terraform init

# Preview what will be created — verify ~25 resources
terraform plan

# Apply — type "yes" when prompted
# This takes about 4-5 minutes (RDS provisioning is the slowest part)
terraform apply

# Save outputs for reference
terraform output > ../stack-outputs.txt
```

### 3.5 Output Values

After `terraform apply` completes, you'll see:

```
ec2_public_ip          = "54.123.45.67"
ec2_instance_id        = "i-0abcdef1234567890"
rds_endpoint           = "paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com:3306"
rds_master_username    = "paysync_admin"
rds_database_name      = "paysync"
application_url        = "http://54.123.45.67"
ssh_command            = "ssh -i ~/.ssh/ec2-key.pem ubuntu@54.123.45.67"
jenkins_url            = "http://54.123.45.67:8080"
```

> **Write these down** — you'll need `ec2_public_ip` and `rds_endpoint` for the next steps.  
> To re-display later: `cd terraform && terraform output`

---

## 4. EC2 Bootstrap & Application Launch

### 4.1 Automatic Bootstrap (user_data)

When EC2 first boots, `server-init.sh` runs automatically via `user_data` (passed in `ec2.tf`).
It runs as root and produces a log at `/var/log/paysync-init.log`. Here is exactly what it does:

| # | Step | Detail |
|---|---|---|
| 1 | **System Update** | `apt update -y && apt upgrade -y` — brings the fresh Ubuntu image up to date |
| 2 | **Install Dependencies** | `git curl wget sqlite3 ufw htop` — basic toolkit for operations |
| 3a | **Install Docker** | `get.docker.com` script → Docker Engine + systemctl enable/start |
| 3b | **Install Node.js 22.x** | Nodesource `setup_22.x` → `apt install nodejs` — needed for Jenkins pipeline (npm ci, tsc) |
| 4 | **Clone Repository** | `git clone https://github.com/AnoopG7/PaySync.git` → `/opt/paysync` |
| 5 | **Create .env** | Generates `.env` with placeholder `DB_HOST=__REPLACE_ME__`, random JWT secret |
| 5 | **Start Docker Compose** | `docker compose up --build -d` — containers run but backend will crash until RDS host is fixed |
| 6 | **Health Check** | Sleep 10s, then verify containers + curl `localhost/api/health` |
| 7 | **CloudWatch Setup** | Calls `setup-cloudwatch.sh` — installs agent, attempts dashboard (may fail without IAM) |
| 7 | **Jenkins Setup** | Calls `setup-jenkins.sh` — installs Java 21 + Jenkins LTS + inline pipeline, logs: `admin/admin123` |
| 7 | **Cron Setup** | Calls `setup-cron.sh` — installs crontab entries for health/backup/rotate |

> The bootstrap runs **only on first boot**. If you stop/start the instance, it won't re-run.
> The full log is at `/var/log/paysync-init.log` on EC2.

### 4.2 Connect to EC2

```bash
# From your Mac, use the SSH command from terraform output:
EC2_IP=$(terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/ec2-key.pem ubuntu@$EC2_IP

# You should see the Ubuntu MOTD and a shell prompt.
# The repo is already cloned at /opt/paysync/.
# The bootstrap already ran — check the log:
sudo tail -50 /var/log/paysync-init.log
```

### 4.3 Fix the RDS Host in .env

The bootstrap created `.env` with a placeholder `DB_HOST=__REPLACE_ME__`.  
You must replace it with the actual RDS endpoint from terraform output:

```bash
# Get the RDS endpoint (from your Mac, not from EC2):
RDS_EP=$(terraform output -raw rds_endpoint | cut -d: -f1)
# cut -d: -f1 strips the ":3306" port suffix

# Inside the SSH session, run:
sudo sed -i "s/DB_HOST=.*/DB_HOST=$RDS_EP/" /opt/paysync/.env

# Verify it worked:
cat /opt/paysync/.env | grep DB_HOST
# Output: DB_HOST=paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com
```

### 4.4 Launch the Application

```bash
cd /opt/paysync
sudo docker compose up -d

# Check everything is running:
docker compose ps
# Both backend and frontend should show "Up"

# Verify the API is healthy (via Nginx reverse proxy on port 80):
curl http://localhost/api/health
# Should return JSON: {"status":"ok","timestamp":"..."}

# Verify the frontend is served:
curl -sI http://localhost | head -1
# Should return: HTTP/1.1 200 OK
```

If the backend fails to start, check logs:
```bash
docker compose logs --tail=50 backend
# Common issue: ECONNREFUSED → RDS host is wrong or security group isn't set.
```

### 4.5 Verify from Your Browser

```bash
# From your Mac:
open http://$EC2_IP
```

You should see the PaySync login page. Use these demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | admin@paysync.cloud | admin123 |
| Manager | manager@paysync.cloud | manager123 |
| Staff | staff@paysync.cloud | staff123 |

---

## 5. CI/CD Setup (Jenkins)

Jenkins runs **natively on EC2** (apt install, systemd service on port 8080).  
It is NOT in Docker — this avoids Docker-in-Docker complexity and gives Jenkins direct access to the host Docker socket.

The entire Jenkins setup (install, config, pipeline) is automated by `setup-jenkins.sh` during bootstrap (Step 7 of `server-init.sh`).

### 5.1 Access Jenkins

```
http://<EC2_IP>:8080
Login: admin / admin123
```

> Port 8080 is restricted to your IP (same CIDR as SSH).  
> If you get a 401 or login page instead of the dashboard, Jenkins is still starting. Wait 30s and refresh.

### 5.2 What setup-jenkins.sh Does

The Jenkins setup script performs these steps:

| # | Step | Detail |
|---|---|---|
| 1 | **Install Java 21** | `apt install fontconfig openjdk-21-jre` — Jenkins requires JRE |
| 2 | **Install Jenkins LTS** | Adds Jenkins apt repo, `apt install jenkins` |
| 3 | **Add Jenkins to docker group** | `usermod -aG docker jenkins` — so Jenkins can run `docker compose` commands |
| 4 | **Disable setup wizard** | Systemd override: `-Djenkins.install.runSetupWizard=false` |
| 5 | **Create admin user** | Groovy init script (`init.groovy.d/setup.groovy`) creates `admin` / `admin123` |
| 6 | **Set Jenkins URL** | Uses the EC2 public IP (from checkip.amazonaws.com) |
| 7 | **Start Jenkins** | `systemctl enable --now jenkins` + wait loop (up to 3 min) |
| 8 | **Create pipeline job** | Generates `config.xml` with inline `CpsFlowDefinition` — creates `paysync-pipeline` job |
| 9 | **Install plugins** | Jenkins CLI: `git`, `workflow-aggregator`, `blueocean` |
| 10 | **Auto-build (deferred)** | Triggers a build **only if** `.env` has a real RDS host (checks for `__REPLACE_ME__`). If placeholder found, prints the manual trigger command. |

### 5.3 Pipeline Stages

The `paysync-pipeline` job has 7 stages:

```
Checkout → Prepare Environment → Install Dependencies (parallel) 
→ Lint & Type Check (parallel) → Build Docker Images → Deploy → Health Check
```

| Stage | What happens | Time estimate |
|---|---|---|
| **Checkout** | `scmGit` clones `https://github.com/AnoopG7/PaySync.git` at the specified branch | ~20s |
| **Prepare Environment** | Copies `/opt/paysync/.env` into the Jenkins workspace so Docker Compose picks it up | ~1s |
| **Install Dependencies** | Runs `npm ci` in `frontend/` and `backend/` **in parallel** using Jenkins parallel stages. Uses the host Node.js 22.x installation. | ~30s |
| **Lint & Type Check** | Runs `npx tsc --noEmit` in frontend and backend **in parallel** — catches type errors before Docker build | ~20s |
| **Build Docker Images** | `docker compose -p paysync build` — builds the two Docker images (backend: node:22-alpine + tsx, frontend: multi-stage Vite build) | ~60s first time, ~10s cached |
| **Deploy** | `docker compose up -d --remove-orphans backend frontend` + `docker image prune -af --filter until=24h` | ~15s |
| **Health Check** | `curl -sf http://localhost:3001/api/health` — verifies the backend is responding | ~5s |

**Total pipeline time:** ~2-3 minutes fresh, ~1 minute cached.

> **Note:** The pipeline uses an **inline script** (not the `Jenkinsfile` from SCM).  
> Both define the same logic, but the inline version avoids dependency on GitHub availability during job creation.

### 5.4 Trigger a Build

Auto-build is skipped if `.env` still has the placeholder `__REPLACE_ME__`.  
Once you've fixed the RDS host (step 4.3), trigger a build:

**Option A — Jenkins UI:**

```
http://<EC2_IP>:8080/job/paysync-pipeline/
→ "Build with Parameters" → BRANCH=main → "Build"
```

**Option B — Jenkins CLI (the jar is already downloaded at `/tmp/jenkins-cli.jar`):**

```bash
# Inside the SSH session:
sudo java -jar /tmp/jenkins-cli.jar -s http://localhost:8080 \
  -auth "admin:admin123" build paysync-pipeline -p BRANCH=main

# Watch the build output:
sudo java -jar /tmp/jenkins-cli.jar -s http://localhost:8080 \
  -auth "admin:admin123" console paysync-pipeline -f
```

### 5.5 Troubleshooting Jenkins

```bash
# Check Jenkins service status
sudo systemctl status jenkins

# View live logs
sudo journalctl -u jenkins.service -f

# Restart Jenkins
sudo systemctl restart jenkins

# Check if Jenkins is listening
ss -tlnp | grep 8080

# View the pipeline job config
cat /var/lib/jenkins/jobs/paysync-pipeline/config.xml

# Jenkins workspace (where builds run)
ls -la /var/lib/jenkins/workspace/paysync-pipeline/

# View a specific build log
cat /var/lib/jenkins/jobs/paysync-pipeline/builds/1/log

# Initial admin password (if setup wizard somehow ran)
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

---

## 6. Monitoring Setup (CloudWatch)

Pre-built configs are in `cloudwatch/`:

```
cloudwatch/
├── dashboard.json          # 5 metric widgets: EC2 CPU/network, RDS, disk, memory, status checks
├── alarms.json             # 7 alarms: CPU >80%, disk >85%, memory >80%, status check fail, RDS CPU >80%, RDS connections >20, RDS storage <2GB
└── cloudwatch-agent.json   # CW Agent config: CPU, disk, memory, network, process, Docker logs, syslog
```

### 6.1 SNS Topic for Alerts (Manual Setup)

Alarms need an SNS topic to send notifications. This is not automated by Terraform to avoid hardcoding your email.

```bash
# Create SNS topic
aws sns create-topic --name paysync-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:YOUR_ACCOUNT_ID:paysync-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Check your email and confirm the subscription
# AWS sends a confirmation email — click the "Confirm subscription" link
```

### 6.2 Create Alarms (Manual Setup)

The alarms JSON file (`cloudwatch/alarms.json`) uses placeholders for instance-specific values:

| Placeholder | Replace with |
|---|---|
| `${EC2_INSTANCE_ID}` | `terraform output -raw ec2_instance_id` |
| `${RDS_INSTANCE_ID}` | `paysync-mysql` (fixed — this is our RDS identifier) |
| `${SNS_TOPIC_ARN}` | The ARN from Step 6.1 |

Run this one-liner to substitute and create all 7 alarms:

```bash
cd /path/to/AWS
for alarm in $(jq -c '.Alarms[]' cloudwatch/alarms.json); do
  eval "aws cloudwatch put-metric-alarm --cli-input-json '$(echo $alarm | \
    sed "s/\$\{EC2_INSTANCE_ID\}/$(cd terraform && terraform output -raw ec2_instance_id)/; \
         s/\$\{RDS_INSTANCE_ID\}/paysync-mysql/; \
         s/\$\{SNS_TOPIC_ARN\}/arn:aws:sns:ap-south-1:YOUR_ACCOUNT_ID:paysync-alerts/")'"
done
```

The 7 alarms created:

| Alarm | Metric | Threshold | Action |
|---|---|---|---|
| `paysync-cpu-high` | AWS/EC2 CPUUtilization | >80% for 5 min | SNS alert |
| `paysync-disk-high` | CWAgent disk_used_percent | >85% for 5 min | SNS alert |
| `paysync-memory-high` | CWAgent mem_used_percent | >80% for 5 min | SNS alert |
| `paysync-status-check` | AWS/EC2 StatusCheckFailed | >0 for 1 min | SNS alert |
| `paysync-rds-cpu-high` | AWS/RDS CPUUtilization | >80% for 5 min | SNS alert |
| `paysync-rds-connections` | AWS/RDS DatabaseConnections | >20 for 5 min | SNS alert |
| `paysync-rds-storage-low` | AWS/RDS FreeStorageSpace | <2GB for 5 min | SNS alert |

### 6.3 CloudWatch Agent (OS Metrics)

The CloudWatch agent is **installed automatically** during bootstrap by `setup-cloudwatch.sh` (Step 7 of `server-init.sh`). It collects:

- CPU usage (idle, user, system, iowait)
- Disk usage (used %, free bytes)
- Memory usage (used %, available bytes)
- Network connections (TCP established, time-wait)
- Process counts (total, sleeping, running, zombie)
- Docker container logs → `/aws/ec2/paysync/docker` log group
- System logs → `/aws/ec2/paysync/system` log group

**Verify the agent is running:**

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

**Note:** The agent needs IAM permissions to push metrics to CloudWatch.  
Since EC2 does **not** have an instance profile (by design — no IAM role attached), metric push will fail silently.  
The agent binary is installed and configured, but metrics won't appear in CloudWatch unless you either:

1. Attach an IAM instance profile with `CloudWatchAgentServerPolicy`, or
2. Configure `aws configure` with your user credentials on the instance (not recommended for production).

### 6.4 CloudWatch Dashboard

The dashboard is **attempted** during bootstrap (`setup-cloudwatch.sh` Step 4), but will fail without IAM permissions.  
This is expected and does not block the bootstrap — the error is caught with `|| true`.

To create the dashboard **manually later** (from your Mac, where AWS CLI is configured):

```bash
aws cloudwatch put-dashboard \
  --dashboard-name paysync \
  --dashboard-body file://cloudwatch/dashboard.json
```

The dashboard shows 5 widgets:
1. **EC2 Compute & Network** — CPU %, Network In/Out (time series, 5 min period)
2. **RDS MySQL** — CPU %, Connections, Free Storage (time series, 5 min period)
3. **Disk Usage** — CWAgent disk_used_percent (0-100% axis)
4. **Memory** — CWAgent mem_used_percent (0-100% axis)
5. **EC2 Status Checks** — StatusCheckFailed (1 min period, aggregate)

---

## 7. Maintenance & Operations

### 7.1 Daily Operations

```bash
# SSH into EC2
ssh -i ~/.ssh/ec2-key.pem ubuntu@$(cd /path/to/AWS/terraform && terraform output -raw ec2_public_ip)

# Check running containers
docker compose ps

# View live logs
docker compose logs -f --tail=100 backend
docker compose logs -f --tail=100 frontend

# Check system resources
df -h /          # Disk usage (should be <60%)
free -h          # Memory usage
htop             # Interactive process viewer (installed by bootstrap)

# Check bootstrap log for any errors
tail -20 /var/log/paysync-init.log
```

### 7.2 Backup & Restore

**Automated backup** runs daily at 2 AM via cron (`scripts/backup.sh`):
- Connects to RDS and runs `mysqldump`
- Compresses output with gzip
- Stores in `/opt/paysync/backups/` with filename `paysync-YYYY-MM-DD.sql.gz`
- Retains backups for 30 days (older files are auto-deleted)

**Manual backup:**

```bash
# Run a backup right now:
sudo /opt/paysync/scripts/backup.sh

# Or use docker compose exec directly:
docker compose exec -T backend mysqldump \
  -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME \
  | gzip > /tmp/paysync-manual-$(date +%F).sql.gz

# List existing backups:
ls -lh /opt/paysync/backups/
```

**Restore from backup:**

```bash
# Copy a backup file to EC2
scp -i ~/.ssh/ec2-key.pem /path/to/backup.sql.gz ubuntu@$EC2_IP:/tmp/

# SSH in and restore
ssh -i ~/.ssh/ec2-key.pem ubuntu@$EC2_IP
gunzip < /tmp/backup.sql.gz | docker compose exec -T backend \
  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME
```

### 7.3 Updating the Application

**With Jenkins (recommended method):**

1. Push your code changes to GitHub (`git push origin main`)
2. Trigger the Jenkins pipeline:
   - UI: `http://<EC2_IP>:8080/job/paysync-pipeline/` → "Build with Parameters"
   - CLI: `sudo java -jar /tmp/jenkins-cli.jar -s http://localhost:8080 -auth "admin:admin123" build paysync-pipeline -p BRANCH=main`
3. Jenkins will: checkout → npm ci → tsc → docker build → deploy → health check
4. Total time: ~2-3 minutes

**Manual update (without Jenkins):**

```bash
cd /opt/paysync
sudo git pull origin main
sudo docker compose build --pull
sudo docker compose up -d --remove-orphans
sudo docker image prune -af --filter "until=24h"
```

### 7.4 Log Rotation

Docker logs grow unbounded by default. The cron job rotates them every 6 hours.

```bash
# View log directory
ls -la /var/log/paysync/

# Force rotation immediately:
sudo /opt/paysync/scripts/rotate-logs.sh

# Check disk space reclaimed:
df -h /
```

The rotation script:
1. Finds all Docker container log files
2. Truncates them to zero size (doesn't delete — just empties)
3. Keeps the last 3 rotated logs per container
4. Runs via cron at 00:00, 06:00, 12:00, 18:00

### 7.5 Cron Jobs

Installed automatically by `setup-cron.sh` during bootstrap. The crontab is at `/etc/cron.d/paysync`:

```cron
# PaySync Cron Jobs — managed by setup-cron.sh

# Health check every 5 minutes
*/5 * * * * root /opt/paysync/scripts/health-check.sh

# Database backup daily at 2 AM
0 2 * * * root /opt/paysync/scripts/backup.sh

# Docker log rotation every 6 hours
0 */6 * * * root /opt/paysync/scripts/rotate-logs.sh
```

> **Note:** All cron jobs run as `root` to ensure they have permission to access Docker and system files.

### 7.6 User Management (Linux)

The `manage-users.sh` script manages Linux user accounts on the EC2 instance (not the application users):

```bash
# View script usage
sudo /opt/paysync/scripts/manage-users.sh --help

# Commands:
sudo /opt/paysync/scripts/manage-users.sh add john            # Create user 'john' with home dir + sudo
sudo /opt/paysync/scripts/manage-users.sh remove john         # Delete user 'john'
sudo /opt/paysync/scripts/manage-users.sh list                # List all users + their SSH keys
sudo /opt/paysync/scripts/manage-users.sh ssh-key john "ssh-rsa AAAAB3Nza..."  # Add SSH public key for 'john'
sudo /opt/paysync/scripts/manage-users.sh lock john           # Lock account (disable login)
sudo /opt/paysync/scripts/manage-users.sh unlock john         # Unlock account
```

---

## 8. Troubleshooting

### 8.1 Application Not Reachable

```bash
# 1. Check EC2 is running
aws ec2 describe-instances --instance-ids $(cd terraform && terraform output -raw ec2_instance_id)

# 2. Check security group rules
aws ec2 describe-security-groups --group-ids $(cd terraform && terraform output -raw ec2_security_group_id)

# 3. SSH in and check Docker
ssh -i ~/.ssh/ec2-key.pem ubuntu@$(cd terraform && terraform output -raw ec2_public_ip)
docker compose ps
docker compose logs --tail=50

# 4. Check Nginx reverse proxy
curl -I http://localhost:80

# 5. Check backend health directly (port 3001)
curl http://localhost:3001/api/health

# 6. Check the bootstrap log for errors
sudo tail -100 /var/log/paysync-init.log
```

### 8.2 Database Connection Issues

```bash
# 1. Check RDS state (should be "available")
aws rds describe-db-instances --db-instance-identifier paysync-mysql

# 2. From EC2, test network connectivity to RDS
nc -zv $(terraform output -raw rds_endpoint | cut -d: -f1) 3306

# 3. Check .env file has the correct host
cat /opt/paysync/.env | grep DB_HOST
# Should be: DB_HOST=paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com

# 4. Check backend logs for DB errors
docker compose logs --tail=50 backend | grep -i "error\|knex\|connect"

# 5. Verify RDS security group allows traffic from EC2 SG
# RDS SG should have an inbound rule: MySQL (3306) → source: <ec2-sg-id>
```

### 8.3 Docker Issues

```bash
# Check Docker daemon is running
sudo systemctl status docker

# Check disk space (Docker images/logs can fill up quickly)
df -h /

# Clean up Docker resources
docker system prune -af    # Remove all unused containers, images, networks
docker compose down        # Stop all containers
docker compose build --no-cache  # Rebuild from scratch (no layer cache)
docker compose up -d       # Start fresh

# View disk usage by Docker
docker system df
```

### 8.4 Jenkins Issues

```bash
# Jenkins won't start
sudo systemctl status jenkins
sudo journalctl -u jenkins.service --no-pager -n 50

# Common fix: restart
sudo systemctl restart jenkins

# Wait for it to come up:
for i in {1..30}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null)
  echo "Attempt $i: HTTP $STATUS"
  [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ] && break
  sleep 5
done

# Pipeline fails to clone
# Check Jenkins can reach GitHub:
sudo -u jenkins git ls-remote https://github.com/AnoopG7/PaySync.git

# Pipeline can't run docker
# Check jenkins user is in docker group:
groups jenkins
# Should include "docker" — if not: sudo usermod -aG docker jenkins && sudo systemctl restart jenkins
```

### 8.5 Common Errors

| Error | Likely Cause | Solution |
|---|---|---|
| `Connection refused` on port 80 | Nginx container not running | `docker compose ps` — if backend/frontend missing, check logs |
| `ECONNREFUSED` from backend logs | Backend can't reach RDS | Verify `.env` DB_HOST is correct; check RDS SG allows traffic from EC2 SG |
| `Access denied for user 'paysync_admin'@'...'` | Wrong RDS password in `.env` | Check `DB_PASSWORD` in `/opt/paysync/.env` matches `rds_master_password` in `terraform.tfvars` |
| `getaddrinfo ENOTFOUND` in backend | DB_HOST is still `__REPLACE_ME__` (placeholder) | Run the `sed` command from step 4.3 to fix it |
| Disk full (`No space left on device`) | Docker logs or old images accumulated | `sudo /opt/paysync/scripts/rotate-logs.sh` + `docker system prune -af` |
| `terraform apply` fails on RDS creation | RDS instance name already taken in the region | Change `rds_db_name` in `variables.tf` or delete the old RDS instance |
| `key pair 'ec2-key' not found` | Key pair doesn't exist in ap-south-1 | Create it in AWS Console (EC2 → Key Pairs → Create), or change `key_pair_name` |
| `Permission denied (publickey)` when SSHing | Wrong key file or wrong permissions | `ssh -i ~/.ssh/ec2-key.pem ubuntu@IP` with `chmod 400 ~/.ssh/ec2-key.pem` |
| Jenkins `401 Unauthorized` or login loop | Wrong credentials or setup wizard ran despite init.groovy.d | Check `sudo journalctl -u jenkins.service` for init script output |
| Jenkins pipeline shows `null` for build | Jenkins CLI auth failed | Use UI instead: `http://<EC2_IP>:8080/job/paysync-pipeline/build?delay=0sec` |
| `curl: (28) Connection timed out` on `localhost:3001` | Backend container crashed during startup | `docker compose logs backend` — check for migration or DB errors |
| Frontend loads but API calls fail with 502 | Nginx can't reach backend | `docker compose restart backend`; check `docker compose logs frontend` for Nginx errors |
| `npm ERR!` in Jenkins pipeline | Node.js not found or wrong version | `ssh` in and check `node --version` — should be v22.x; re-run `setup-jenkins.sh` if needed |
| `CloudWatch agent` starts but no metrics in console | No IAM instance profile attached | This is expected by design. Either attach a role with `CloudWatchAgentServerPolicy` or accept metrics won't push. |

---

## 9. Teardown

### 9.1 Destroy Everything (Terraform)

```bash
# ⚠️ WARNING: Destroys ALL infrastructure. Data is lost.
# RDS data, Docker volumes, all application data — gone permanently.

cd terraform
terraform destroy -auto-approve
```

Terraform will tear down in this order:
1. **Security groups** (dependencies removed first)
2. **EC2 instance** (via the aws_instance resource)
3. **Elastic IP** (released)
4. **RDS instance** (deleted with `skip_final_snapshot = true`)
5. **S3 Gateway Endpoint** (detached from route tables)
6. **Internet Gateway** (detached from VPC)
7. **Subnets** (public + both private)
8. **VPC** (finally deleted)

### 9.2 Manual Cleanup (if terraform destroy fails)

If `terraform destroy` fails partway through (e.g., RDS has deletion protection still on):

```bash
# Delete RDS (most common failure point)
aws rds modify-db-instance \
  --db-instance-identifier paysync-mysql \
  --deletion-protection false
aws rds delete-db-instance \
  --db-instance-identifier paysync-mysql \
  --skip-final-snapshot

# Terminate EC2 (if orphaned)
aws ec2 terminate-instances --instance-ids i-xxxxxxxxxxxxxxxxx

# Release Elastic IP (if orphaned)
aws ec2 release-address --allocation-id eipalloc-xxxxxxxx

# Delete VPC (this will fail if any dependencies remain)
aws ec2 delete-vpc --vpc-id vpc-xxxxxxxx

# Clear terraform state so you can re-apply cleanly
cd terraform
rm -rf .terraform terraform.tfstate*
```

---

## Appendix: Quick Reference

### Useful Commands

```bash
# Terraform
terraform init          # Initialize providers (~30 sec)
terraform plan          # Preview changes
terraform apply         # Deploy infrastructure (~5 min)
terraform destroy       # Destroy everything
terraform output        # Show output values
terraform output -raw ec2_public_ip   # Get just the IP
terraform state list    # List managed resources
terraform state rm <resource>         # Remove from state (use carefully)

# Docker
docker compose ps       # List running containers
docker compose logs -f  # Follow all logs
docker compose logs -f --tail=100 backend  # Backend logs only
docker compose up -d    # Start services in background
docker compose down     # Stop and remove containers
docker compose build    # Rebuild images (no cache)
docker system prune -af # Clean everything unused
docker system df        # Show Docker disk usage

# AWS CLI
aws ec2 describe-instances --filters "Name=tag:Name,Values=paysync-app-server"
aws rds describe-db-instances --db-instance-identifier paysync-mysql
aws cloudwatch describe-alarms
aws sns list-topics
aws cloudwatch put-dashboard --dashboard-name paysync --dashboard-body file://cloudwatch/dashboard.json

# Linux (on EC2)
journalctl -u jenkins.service -f          # Jenkins logs
tail -f /var/log/paysync-init.log         # Bootstrap log
ss -tlnp                                   # Listening ports
docker compose exec backend node -e "console.log(process.env.DB_HOST)"  # Check env inside container
```

### Cron Jobs on EC2

```cron
# File: /etc/cron.d/paysync
# Managed by: scripts/setup-cron.sh

*/5 * * * * root /opt/paysync/scripts/health-check.sh          # Health check every 5 min
0 2 * * * root /opt/paysync/scripts/backup.sh                  # Database backup daily at 2 AM
0 */6 * * * root /opt/paysync/scripts/rotate-logs.sh           # Docker log rotation every 6 hours
```

### File Locations on EC2

| Path | Purpose |
|---|---|
| `/opt/paysync/` | Application code (cloned from GitHub) |
| `/opt/paysync/.env` | Environment variables (DB_HOST, JWT_SECRET, etc.) — **fix DB_HOST after SSH** |
| `/opt/paysync/scripts/` | All shell scripts (setup, deploy, backup, health-check, etc.) |
| `/opt/paysync/backups/` | Daily database backups (auto-deleted after 30 days) |
| `/var/log/paysync-init.log` | Bootstrap log — check if `server-init.sh` had errors |
| `/var/log/paysync-cw-setup.log` | CloudWatch setup log |
| `/var/log/paysync/` | Rotated Docker logs (if rotation ran) |
| `/var/lib/jenkins/` | Jenkins home directory |
| `/var/lib/jenkins/jobs/paysync-pipeline/` | Jenkins pipeline job files |
| `/var/lib/jenkins/workspace/paysync-pipeline/` | Jenkins workspace (build artifacts) |
| `/etc/cron.d/paysync` | Cron job definitions |
| `/tmp/jenkins-cli.jar` | Jenkins CLI client (pre-downloaded) |
| `/var/lib/jenkins/secrets/initialAdminPassword` | Jenkins initial password (only if setup wizard ran) |

### Terraform State & Sensitive Files

| File | Purpose | Committed? |
|---|---|---|
| `terraform/terraform.tfvars` | Your passwords, IPs, key names | ❌ No (`.gitignore`) |
| `terraform/terraform.tfvars.example` | Template with dummy values | ✅ Yes |
| `terraform/.terraform/` | Provider plugins & modules | ❌ No (`.gitignore`) |
| `terraform/terraform.tfstate*` | Terraform state (contains secrets) | ❌ No (`.gitignore`) |
| `~/.ssh/ec2-key.pem` | SSH private key for EC2 access | ❌ No |

### Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────────┬────────────────────────────────────────┘
                     │
              ┌──────┴──────┐
              │  Elastic IP  │  (static public IP)
              └──────┬──────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│  Security Group (EC2)          Ports: 22, 80, 443, 8080     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  EC2 Instance  (m7i-flex.large, Ubuntu 24.04)      │    │
│  │  ┌──────────────────┐  ┌──────────────────┐        │    │
│  │  │  Nginx (port 80) │  │  Jenkins (8080)  │        │    │
│  │  │  reverse proxy   │  │  native systemd  │        │    │
│  │  └────────┬─────────┘  └──────────────────┘        │    │
│  │           │                                         │    │
│  │  ┌────────┴─────────┐  ┌──────────────────┐        │    │
│  │  │  Frontend        │  │  Backend (3001)  │        │    │
│  │  │  (nginx:80)      │  │  Express + knex  │        │    │
│  │  └──────────────────┘  └────────┬─────────┘        │    │
│  └─────────────────────────────────┼───────────────────┘    │
└────────────────────────────────────┼─────────────────────────┘
                                     │ TCP 3306
┌────────────────────────────────────┼─────────────────────────┐
│  Security Group (RDS)             │                          │
│  ┌────────────────────────────────┴──────────────────┐      │
│  │  RDS MySQL (db.t4g.micro, private subnet)         │      │
│  │  DB: paysync, User: paysync_admin                │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```
