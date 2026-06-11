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

# ── Step 3: Fill in terraform.tfvars ──
# NOTE: public_key_path must be an ABSOLUTE path (Terraform cannot expand ~)
# Find your IP with: curl -s http://checkip.amazonaws.com
#
# Required values:
#   ssh_allowed_cidr     = "YOUR_IP/32"
#   rds_master_password  = "YourStrongPassword123!"
#   public_key_path      = "/Users/you/.ssh/id_rsa.pub"

# ── Step 4: Deploy infrastructure ──
terraform init
terraform plan                # review — should show ~25 resources to create
terraform apply               # type "yes" — takes ~5 minutes

# ── Step 5: Launch the app (SSH in) ──
# Copy the EC2 IP from terraform output, then:
ssh ubuntu@<EC2_PUBLIC_IP>

# Create the .env file with RDS details (get them from terraform output):
cd paysync-cloud
cat > .env << 'EOF'
DB_TYPE=mysql
DB_HOST=<RDS_ENDPOINT>         # from terraform output
DB_PORT=3306
DB_NAME=paysync
DB_USER=paysync_admin
DB_PASSWORD=<YOUR_PASSWORD>
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# Start everything:
docker compose up -d

# Verify:
curl -sf http://localhost/api/health && echo "OK"
curl -sf http://localhost && echo "OK"

# ── Done! Open in your browser ──
open http://<EC2_PUBLIC_IP>
# Login: admin@paysync.cloud / admin123
# Jenkins: http://<EC2_PUBLIC_IP>:8080 (get admin password below)
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

```bash
# Generate if you don't have one:
ssh-keygen -t ed25519 -f ~/.ssh/id_rsa -N ""

# The PUBLIC key (~/.ssh/id_rsa.pub) is used by Terraform to create the EC2 key pair.
# The PRIVATE key (~/.ssh/id_rsa) is used to SSH into EC2.
```

> **Important:** Terraform's `file()` function does NOT expand `~`. When setting `public_key_path` in `terraform.tfvars`, you MUST use an absolute path like `/Users/yourname/.ssh/id_rsa.pub`.

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
│   ├── dashboard.json       # CloudWatch dashboard widget config
│   ├── alarms.json          # 7 alarms (CPU, disk, memory, status, RDS)
│   └── cloudwatch-agent.json # CW Agent config (mem/disk/process)
├── scripts/
│   ├── server-init.sh       # EC2 bootstrap (runs via user_data)
│   ├── backup.sh            # Daily DB backup
│   ├── deploy-app.sh        # Manual app deployment
│   ├── health-check.sh      # Cron health checks
│   ├── install-packages.sh  # Docker & system dependencies
│   ├── manage-users.sh      # Linux user management
│   ├── monitor-system.sh    # System monitoring
│   ├── rotate-logs.sh       # Docker log rotation
│   ├── set-permissions.sh   # File permissions
│   └── setup-cron.sh        # Cron job installer
├── backend/                 # Express API (knex, JWT auth)
├── frontend/                # React SPA (Vite, shadcn/ui)
├── docker-compose.yml       # 3 services: backend, frontend, jenkins
├── Jenkinsfile              # CI/CD pipeline
└── docs/
    └── aws-deployment.md    # This file
```

### 3.2 What Terraform Creates

| Resource | Spec | Notes |
|---|---|---|
| **VPC** | 10.0.0.0/16 | DNS hostnames enabled |
| **Public subnet** | 10.0.1.0/24 (ap-south-1a) | EC2 lives here |
| **Private subnet 1** | 10.0.10.0/24 (ap-south-1a) | RDS primary |
| **Private subnet 2** | 10.0.11.0/24 (ap-south-1b) | RDS standby |
| **Internet Gateway** | — | Public internet access |
| **S3 Gateway Endpoint** | — | Free; RDS backups to S3 |
| **EC2** | m7i-flex.large (2 vCPU, 8 GiB) | Ubuntu 24.04, 20 GB gp3 encrypted |
| **RDS** | db.t4g.micro MySQL 8.0 | 20 GB gp3, 7-day backups |
| **Security groups** | EC2 + RDS | Least-privilege rules |
| **Elastic IP** | Static public IP | Attached to EC2 |

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

# REQUIRED — absolute path to your SSH public key (Terraform cannot expand ~)
public_key_path = "/Users/yourname/.ssh/id_rsa.pub"
```

> **Security note:** Never commit `terraform.tfvars`. It's in `.gitignore` already.

### 3.4 Deploy

```bash
cd terraform

# Initialize (downloads AWS provider, sets up backend)
terraform init

# Preview what will be created
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
ssh_command            = "ssh -i ~/.ssh/id_rsa ubuntu@54.123.45.67"
jenkins_url            = "http://54.123.45.67:8080"
```

> **Write these down** — you'll need `ec2_public_ip` and `rds_endpoint` for the next steps.

---

## 4. EC2 Bootstrap & Application Launch

### 4.1 Automatic Bootstrap

When EC2 first boots, `server-init.sh` runs automatically via `user_data`:

1. Updates all system packages
2. Installs Docker Engine + compose plugin
3. Enables & starts Docker daemon
4. Clones the application repo from GitHub
5. **You** create the `.env` file (RDS credentials, JWT secret)
6. **You** run `docker compose up -d`

> The bootstrap runs **only on first boot**. If you stop/start the instance, it won't re-run.

### 4.2 Connect to EC2

```bash
# From your Mac:
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>

# You should see the Ubuntu MOTD and a shell prompt.
# The repo is already cloned at /home/ubuntu/paysync-cloud/
```

### 4.3 Create the .env File

The bootstrap cloned the repo, but **RDS credentials are too sensitive for user_data**. You must create `.env` manually:

```bash
cd /home/ubuntu/paysync-cloud

cat > .env << 'EOF'
# ── Database (RDS MySQL) ──
DB_TYPE=mysql
DB_HOST=<RDS_ENDPOINT>                 # e.g. paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=paysync
DB_USER=paysync_admin
DB_PASSWORD=<YOUR_RDS_PASSWORD>         # from terraform.tfvars

# ── Auth ──
JWT_SECRET=$(openssl rand -hex 32)     # generates a 64-char hex key

# ── App ──
NODE_ENV=production
EOF
```

Terraform output gives you the RDS endpoint. The shell command `$(openssl rand -hex 32)` generates a random JWT secret inline.

### 4.4 Launch the Application

```bash
cd /home/ubuntu/paysync-cloud

# Start all 3 services (backend, frontend, jenkins):
docker compose up -d

# Check everything is running:
docker compose ps

# Verify the API is healthy (via Nginx, port 80):
curl http://localhost/api/health

# Verify the frontend is served:
curl -sI http://localhost | head -1
# Should return: HTTP/1.1 200 OK
```

### 4.5 Verify from Your Browser

```bash
# From your Mac:
open http://<EC2_PUBLIC_IP>
```

You should see the PaySync login page. Use these demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | admin@paysync.cloud | admin123 |
| Manager | manager@paysync.cloud | manager123 |
| Staff | staff@paysync.cloud | staff123 |

---

## 5. CI/CD Setup (Jenkins)

Jenkins runs as a Docker container on the same EC2 (port 8080). The Docker socket is mounted so Jenkins can build and deploy locally — no separate Jenkins server or SSH deploy needed.

### 5.1 Access Jenkins

```bash
# Jenkins is already running at:
http://<EC2_PUBLIC_IP>:8080

# Get the initial admin password:
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
# Copy the 32-char hex string and paste in the browser
```

> Port 8080 is restricted to your IP (same CIDR as SSH).

### 5.2 Install Plugins

From Jenkins dashboard → **Manage Jenkins** → **Plugins** → **Available plugins**:
- Git
- Pipeline
- Docker Pipeline

### 5.3 Create a Pipeline Job

1. **New Item** → name: `paysync-cloud-deploy` → **Pipeline**
2. **Pipeline** section → Definition: **Pipeline script from SCM**
3. **SCM:** Git
4. **Repository URL:** `https://github.com/YOUR_ORG/paysync-cloud.git`
5. **Script Path:** `Jenkinsfile`
6. **Save**

### 5.4 Run the Pipeline

1. Click **Build with Parameters**
2. Branch: `main`
3. Click **Build**

The pipeline:
1. Checks out code from GitHub
2. Installs dependencies (`npm ci` in frontend + backend)
3. Runs type checks (`tsc --noEmit` in both)
4. Builds Docker images (`docker compose build`)
5. Deploys (`docker compose up -d`)
6. Verifies health endpoint (`curl http://localhost/api/health`)

---

## 6. Monitoring Setup (CloudWatch)

Pre-built configs are in `cloudwatch/`:

```
cloudwatch/
├── dashboard.json          # 5 metric widgets + error log viewer
├── alarms.json             # 7 alarms (CPU, disk, memory, status, RDS)
└── cloudwatch-agent.json   # CW Agent config for OS metrics
```

### 6.1 SNS Topic for Alerts

```bash
# Create SNS topic
aws sns create-topic --name paysync-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:YOUR_ACCOUNT_ID:paysync-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Check your email and confirm the subscription
```

### 6.2 Create Alarms

```bash
# Replace placeholders in alarms.json with actual values:
#   ${EC2_INSTANCE_ID}  →  from terraform output
#   ${RDS_INSTANCE_ID}  →  paysync-mysql
#   ${SNS_TOPIC_ARN}    →  from step 6.1

# Install all 7 alarms:
for alarm in $(jq -c '.Alarms[]' cloudwatch/alarms.json); do
  eval "aws cloudwatch put-metric-alarm --cli-input-json '$(echo $alarm | \
    sed "s/\$\{EC2_INSTANCE_ID\}/i-xxxxxxxx/; \
         s/\$\{RDS_INSTANCE_ID\}/paysync-mysql/; \
         s/\$\{SNS_TOPIC_ARN\}/arn:aws:sns:ap-south-1:.../")'"
done
```

### 6.3 CloudWatch Agent (OS Metrics)

The agent collects memory, disk, and process metrics. Install on EC2:

```bash
# SSH into EC2
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>

# Install
sudo apt install -y amazon-cloudwatch-agent

# Copy config
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
sudo cp /home/ubuntu/paysync-cloud/cloudwatch/cloudwatch-agent.json \
  /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-and-run -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Verify
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

### 6.4 CloudWatch Dashboard

```bash
# Replace placeholders and create dashboard
sed "s/\${AWS_REGION}/ap-south-1/g; s/\${EC2_INSTANCE_ID}/i-xxxxxxxx/g" \
  cloudwatch/dashboard.json > /tmp/dashboard-resolved.json

aws cloudwatch put-dashboard \
  --dashboard-name paysync-overview \
  --dashboard-body file:///tmp/dashboard-resolved.json
```

---

## 7. Maintenance & Operations

### 7.1 Daily Operations

```bash
# SSH into EC2
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>

# Check running containers
docker compose ps

# View logs
docker compose logs -f --tail=100 backend
docker compose logs -f --tail=100 frontend
docker compose logs -f --tail=50 jenkins

# Check system resources
df -h /
free -h
```

### 7.2 Backup & Restore

**Automated backup** runs daily at 2 AM via cron (`scripts/backup.sh`):
- Dumps RDS MySQL database
- Compresses with gzip
- Stores locally for 30 days

**Manual backup:**

```bash
# From EC2:
docker compose exec -T backend mysqldump \
  -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME \
  | gzip > /tmp/paysync-manual-$(date +%F).sql.gz
```

**Restore:**

```bash
# Copy backup file to EC2
scp -i ~/.ssh/id_rsa backup.sql.gz ubuntu@<EC2_PUBLIC_IP>:/tmp/

# SSH in and restore
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>
gunzip < /tmp/backup.sql.gz | docker compose exec -T backend \
  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME
```

### 7.3 Updating the Application

**With Jenkins (recommended):**
1. Push changes to GitHub
2. Trigger Jenkins pipeline
3. Pipeline builds and deploys automatically

**Manual update:**

```bash
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>
cd /home/ubuntu/paysync-cloud
git pull origin main
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -af --filter "until=24h"
```

### 7.4 Log Rotation

Docker logs are rotated every 6 hours by cron (`scripts/rotate-logs.sh`):

```bash
# View log directory
ls -la /var/log/paysync/

# Force rotation
sudo /opt/paysync/scripts/rotate-logs.sh
```

### 7.5 User Management (Linux)

```bash
sudo /opt/paysync/scripts/manage-users.sh add john
sudo /opt/paysync/scripts/manage-users.sh ssh-key john "ssh-rsa AAAAB3Nza..."
sudo /opt/paysync/scripts/manage-users.sh list
sudo /opt/paysync/scripts/manage-users.sh remove john
```

---

## 8. Troubleshooting

### 8.1 Application Not Reachable

```bash
# 1. Check EC2 is running
aws ec2 describe-instances --instance-ids $(terraform output -raw ec2_instance_id)

# 2. Check security group rules
aws ec2 describe-security-groups --group-ids $(terraform output -raw ec2_security_group_id)

# 3. SSH in and check Docker
ssh -i ~/.ssh/id_rsa ubuntu@<EC2_PUBLIC_IP>
docker compose ps
docker compose logs --tail=50

# 4. Check Nginx
curl -I http://localhost:80

# 5. Check backend health
curl http://localhost/api/health
```

### 8.2 Database Connection Issues

```bash
# 1. Check RDS state
aws rds describe-db-instances --db-instance-identifier paysync-mysql

# 2. From EC2, test connectivity
nc -zv <RDS_ENDPOINT> 3306

# 3. Check .env file
cat /home/ubuntu/paysync-cloud/.env | grep DB_
```

### 8.3 Docker Issues

```bash
# Check Docker daemon
sudo systemctl status docker

# Check disk space
df -h /

# Clean up Docker resources
docker system prune -af

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

### 8.4 Common Errors

| Error | Likely Cause | Solution |
|---|---|---|
| `Connection refused` on port 80 | Nginx container not running | Check `docker compose ps` and logs |
| `ECONNREFUSED` from backend | Backend can't reach RDS | Verify `.env` DB_HOST + security group |
| `Access denied for user` | Wrong RDS credentials | Check `DB_USER` / `DB_PASSWORD` in `.env` |
| Disk full | Docker logs or old images | Run `rotate-logs.sh` + `docker system prune` |
| `terraform apply` fails on RDS | RDS name already taken | Change `rds_db_name` in variables |
| Jenkins pipeline timeout | Network issues on EC2 | Check internet gateway + route table |
| `file() error` in terraform | `~` not expanded in public_key_path | Use absolute path like `/Users/you/.ssh/id_rsa.pub` |

---

## 9. Teardown

### 9.1 Destroy Everything (Terraform)

```bash
# ⚠️ WARNING: Destroys ALL infrastructure. Data is lost.

cd terraform
terraform destroy -auto-approve
```

### 9.2 Manual Cleanup (if terraform fails)

```bash
# Delete RDS
aws rds modify-db-instance \
  --db-instance-identifier paysync-mysql \
  --deletion-protection false
aws rds delete-db-instance \
  --db-instance-identifier paysync-mysql \
  --skip-final-snapshot

# Terminate EC2
aws ec2 terminate-instances --instance-ids i-xxxxxxxxxxxxxxxxx

# Delete VPC (this will fail if dependencies remain)
aws ec2 delete-vpc --vpc-id vpc-xxxxxxxx
```

---

## A. Appendix: Quick Reference

### Useful Commands

```bash
# Terraform
terraform init          # Initialize providers
terraform plan          # Preview changes
terraform apply         # Deploy infrastructure
terraform destroy       # Destroy everything
terraform output        # Show output values
terraform state list    # List managed resources

# Docker
docker compose ps       # List containers
docker compose logs -f  # Follow logs
docker compose up -d    # Start services
docker compose down     # Stop services
docker system prune -af # Clean everything

# AWS CLI
aws ec2 describe-instances --filters "Name=tag:Name,Values=paysync-app-server"
aws rds describe-db-instances --db-instance-identifier paysync-mysql
aws cloudwatch describe-alarms
```

### Cron Jobs on EC2

```cron
# Managed by scripts/setup-cron.sh
*/5 * * * * /opt/paysync/scripts/health-check.sh          # Health check every 5 min
0 2 * * * /opt/paysync/scripts/backup.sh                  # Backup daily at 2 AM
0 */6 * * * /opt/paysync/scripts/rotate-logs.sh           # Log rotation every 6 hours
```

### File Locations on EC2

| Path | Purpose |
|---|---|
| `/home/ubuntu/paysync-cloud/` | Application code (cloned repo) |
| `/opt/paysync/scripts/` | Shell scripts |
| `/var/log/paysync/` | Application logs |
| `/etc/cron.d/paysync` | Cron jobs |
| `/home/ubuntu/paysync-cloud/.env` | Environment variables |
