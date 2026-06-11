# AWS Deployment Guide — PaySync Cloud

> **Last Updated:** June 2026  
> **Prerequisites:** AWS account, Terraform installed, SSH key pair

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Infrastructure Deployment (Terraform)](#3-infrastructure-deployment-terraform)
4. [EC2 Bootstrap & Application Launch](#4-ec2-bootstrap--application-launch)
5. [CI/CD Setup (Jenkins)](#5-cicd-setup-jenkins)
6. [Monitoring Setup (CloudWatch)](#6-monitoring-setup-cloudwatch)
7. [Maintenance & Operations](#7-maintenance--operations)
8. [Troubleshooting](#8-troubleshooting)
9. [Teardown](#9-teardown)

---

## 1. Overview

This guide walks through deploying the PaySync Cloud platform on AWS:
- **EC2** m7i-flex.large running Docker Compose (Nginx + Express + React + Jenkins)
- **RDS** db.t4g.micro MySQL (automated backups)
- **CloudWatch** alarms for CPU, disk, status checks
- **Jenkins** CI/CD pipeline for automated builds and deployments

---

## 2. Prerequisites

### 2.1 Local Tools

```bash
# Required
aws --version        # AWS CLI v2
terraform --version  # Terraform >= 1.5
docker --version     # Docker Engine
docker compose version
node --version       # Node >= 22

# Optional (for CI/CD)
jenkins              # Jenkins server (or use Jenkins-as-a-Service)
```

### 2.2 AWS Account Setup

```bash
# Configure AWS CLI with your credentials
aws configure
# AWS Access Key ID:     AKIA...
# AWS Secret Access Key: wJalr...
# Default region:        ap-south-1
# Default output:        json
```

### 2.3 SSH Key Pair

```bash
# Generate an SSH key pair (if you don't have one)
ssh-keygen -t ed25519 -f ~/.ssh/id_rsa -N ""

# The public key is used by Terraform (aws_key_pair resource)
# The private key is used to SSH into EC2 and by Jenkins
```

---

## 3. Infrastructure Deployment (Terraform)

### 3.1 Directory Structure

```
AWS/
├── terraform/
│   ├── main.tf         # VPC, 1 public + 2 private subnets, IGW, S3 Endpoint
│   ├── ec2.tf          # EC2 m7i-flex.large in public subnet, SG (22/80/443/8080)
│   ├── rds.tf          # RDS MySQL in private subnets, SG (3306 from EC2 only)
│   ├── outputs.tf      # Useful output values
│   └── variables.tf    # All configurable variables
├── cloudwatch/
│   ├── dashboard.json        # CloudWatch dashboard widget config
│   ├── alarms.json           # 7 alarms (CPU, disk, memory, status, RDS)
│   └── cloudwatch-agent.json # CW Agent config for mem/disk/process metrics
├── scripts/
│   ├── server-init.sh        # EC2 bootstrap script (referenced by ec2.tf)
│   ├── backup.sh             # Daily DB backup
│   ├── deploy-app.sh         # Manual app deployment
│   ├── health-check.sh       # Cron health checks
│   ├── install-packages.sh   # Docker & system deps
│   ├── manage-users.sh       # Linux user management
│   ├── monitor-system.sh     # System monitoring
│   ├── rotate-logs.sh        # Docker log rotation
│   ├── set-permissions.sh    # File permissions
│   └── setup-cron.sh         # Cron job installer
└── docs/
```

### 3.2 Configure Variables

Create a `terraform.tfvars` file (never commit it):

```hcl
# terraform/terraform.tfvars
aws_region         = "ap-south-1"
rds_master_password = "YourStrongPassword123!"
ssh_allowed_cidr   = "YOUR_IP_ADDRESS/32"  # e.g., "203.0.113.5/32"
```

> **Security note:** For production, use a secrets manager or `terraform
> apply -var="rds_master_password=..."` instead of plain-text files.

### 3.3 Deploy

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview resources
terraform plan

# Apply (creates VPC, subnets, EC2, RDS, security groups)
terraform apply -auto-approve

# Save outputs for later use
terraform output > ../stack-outputs.txt
```

### 3.4 Output Values

After `terraform apply`, you'll see:

```
ec2_public_ip          = "54.123.45.67"
rds_endpoint           = "paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com:3306"
rds_master_username    = "paysync_admin"
rds_database_name      = "paysync"
application_url        = "http://54.123.45.67"
ssh_command            = "ssh -i ~/.ssh/id_rsa ubuntu@54.123.45.67"
```

---

## 4. EC2 Bootstrap & Application Launch

### 4.1 Automatic Bootstrap

The EC2 instance runs `server-init.sh` via `user_data` on first launch.
This script:

1. Updates all system packages
2. Installs Docker Engine (`docker-ce`, `docker-ce-cli`, `containerd.io`)
3. Installs `docker compose` plugin
4. Starts and enables Docker daemon
5. Clones the application repo from GitHub
6. Creates `.env` from template
7. Runs `docker compose up -d`

> **Note:** The bootstrap only runs on **first boot**. If you terminate the
> instance and Terraform creates a new one, bootstrap runs again automatically.

### 4.2 Manual Deployment (if bootstrap fails)

```bash
# SSH into EC2
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Clone the repository
git clone https://github.com/YOUR_ORG/paysync-cloud.git
cd paysync-cloud

# Create .env file
cat > .env << 'EOF'
DB_TYPE=mysql
DB_HOST=paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=paysync
DB_USER=paysync_admin
DB_PASSWORD=YourStrongPassword123!
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# Start the application
docker compose up -d

# Verify
docker compose ps
curl http://localhost/api/health
```

### 4.3 Verify Deployment

```bash
# From your local machine:
# 1. Check application is reachable
curl http://YOUR_EC2_IP

# 2. Check health endpoint
curl http://YOUR_EC2_IP/api/health

# 3. Open in browser
open http://YOUR_EC2_IP

# 4. Demo logins
#    admin@paysync.cloud / admin123
#    manager@paysync.cloud / manager123
#    staff@paysync.cloud / staff123
```

---

## 5. CI/CD Setup (Jenkins)

Jenkins runs as a **Docker container on the same EC2** alongside the app
(port 8080). The Docker socket is mounted so Jenkins can build and deploy
locally — no separate Jenkins server or SSH deploy needed.

### 5.1 Access Jenkins

After `terraform apply`, Jenkins is available at:

```
http://YOUR_EC2_IP:8080
```

> **Note:** Port 8080 is restricted to your IP (same CIDR as SSH).
> If you need to unlock Jenkins for the first time, SSH into EC2 and run:
> ```bash
> ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP
> docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
> ```

### 5.2 Install Required Jenkins Plugins

From the Jenkins dashboard → **Manage Jenkins** → **Plugins** → **Available**:
- **Git**
- **Pipeline**
- **Docker Pipeline**

### 5.3 Create Pipeline Job

1. In Jenkins: **New Item** → **Pipeline**
2. Name: `paysync-cloud-deploy`
3. Pipeline → Definition: **Pipeline script from SCM**
4. SCM: **Git**
5. Repository URL: `https://github.com/YOUR_ORG/paysync-cloud.git`
6. Script Path: `Jenkinsfile`
7. Save

### 5.4 Run Pipeline

1. Click **Build with Parameters**
2. Branch: `main`
3. Click **Build**

The pipeline will:
- Check out code from GitHub
- Install dependencies (npm ci)
- Run lint + type checks (tsc --noEmit)
- Build Docker images via `docker compose build`
- Deploy via `docker compose up -d`
- Verify health endpoint

---

## 6. Monitoring Setup (CloudWatch)

Pre-built configuration files are in `cloudwatch/`:

```
cloudwatch/
├── dashboard.json          # CloudWatch dashboard (EC2 + RDS + CW Agent metrics)
├── alarms.json             # 7 alarms (CPU, disk, memory, status, RDS)
└── cloudwatch-agent.json   # CW Agent config for OS-level metrics
```

### 6.1 SNS Topic for Notifications

```bash
# Create SNS topic
aws sns create-topic --name paysync-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:xxxxxxxxxxxx:paysync-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via the email link you receive
```

### 6.2 Create Alarms

Replace `${EC2_INSTANCE_ID}`, `${RDS_INSTANCE_ID}`, and `${SNS_TOPIC_ARN}`
in `cloudwatch/alarms.json` with your actual values, then:

```bash
# Requires CLI JSON parser (jq)
for alarm in $(jq -c '.Alarms[]' cloudwatch/alarms.json); do
  eval "aws cloudwatch put-metric-alarm --cli-input-json '$(echo $alarm | sed "s/\$\{EC2_INSTANCE_ID\}/i-xxxxxxxx/;s/\$\{RDS_INSTANCE_ID\}/paysync-mysql/;s/\$\{SNS_TOPIC_ARN\}/arn:aws:sns:.../")'"
done
```

Or create alarms individually:

```bash
# EC2 CPU
aws cloudwatch put-metric-alarm \
  --alarm-name "paysync-cpu-high" \
  --metric-name CPUUtilization --namespace AWS/EC2 \
  --statistic Average --period 300 --threshold 80 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=InstanceId,Value=i-xxxxxxxx \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-south-1:xxxx:paysync-alerts

# Status check
aws cloudwatch put-metric-alarm \
  --alarm-name "paysync-status-check" \
  --metric-name StatusCheckFailed --namespace AWS/EC2 \
  --statistic Maximum --period 60 --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=InstanceId,Value=i-xxxxxxxx \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-south-1:xxxx:paysync-alerts

# RDS CPU
aws cloudwatch put-metric-alarm \
  --alarm-name "paysync-rds-cpu-high" \
  --metric-name CPUUtilization --namespace AWS/RDS \
  --statistic Average --period 300 --threshold 80 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=paysync-mysql \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:ap-south-1:xxxx:paysync-alerts
```

### 6.3 CloudWatch Agent (OS-level Metrics)

The CloudWatch Agent collects memory, disk, and process metrics not available
from EC2 defaults. Install and configure on the EC2 instance:

```bash
# SSH into EC2
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Install CloudWatch Agent
sudo apt install -y amazon-cloudwatch-agent

# Copy config
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
sudo cp /home/ubuntu/paysync-cloud/cloudwatch/cloudwatch-agent.json \
  /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-and-run -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

# Verify
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

### 6.4 CloudWatch Dashboard

```bash
# Replace placeholders with actual values
sed "s/\${AWS_REGION}/ap-south-1/g; s/\${EC2_INSTANCE_ID}/i-xxxxxxxx/g" \
  cloudwatch/dashboard.json > /tmp/dashboard-resolved.json

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name paysync-overview \
  --dashboard-body file:///tmp/dashboard-resolved.json
```

---

## 7. Maintenance & Operations

### 7.1 Daily Operations

```bash
# SSH into EC2
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Check running containers
docker compose ps

# View logs
docker compose logs -f --tail=100 backend
docker compose logs -f --tail=100 frontend

# Check disk usage
df -h /

# Check memory
free -h

# Check health script output
/opt/paysync/health-check.sh
```

### 7.2 Backup & Restore

**Automated backup** runs daily via cron (`backup.sh`):
- Dumps MySQL database from RDS
- Compresses with gzip
- Stores locally for 30 days
- (Optional) Uploads to S3

**Manual backup:**

```bash
# SSH into EC2
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Create a manual dump
docker compose exec -T backend mysqldump \
  -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME \
  | gzip > /tmp/paysync-manual-$(date +%F).sql.gz
```

**Restore from backup:**

```bash
# Copy backup file to EC2
scp -i ~/.ssh/id_rsa backup.sql.gz ubuntu@YOUR_EC2_IP:/tmp/

# Restore
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP
gunzip < /tmp/backup.sql.gz | docker compose exec -T backend \
  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME
```

### 7.3 Updating the Application

**With Jenkins (recommended):**
1. Push changes to GitHub
2. Trigger Jenkins pipeline with `build-and-deploy` parameter
3. Pipeline automatically deploys to EC2

**Manual update:**

```bash
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

cd paysync-cloud
git pull origin main
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -af --filter "until=24h"
```

### 7.4 Log Rotation

Logs are rotated every 6 hours by cron (`rotate-logs.sh`):
- Docker container logs are captured to `/var/log/paysync/`
- Logs older than 7 days are gzipped
- Gzipped logs older than 30 days are deleted

```bash
# View log rotation status
ls -la /var/log/paysync/

# Force log rotation
sudo /opt/paysync/scripts/rotate-logs.sh
```

### 7.5 User Management

Linux users and SSH key management via `manage-users.sh`:

```bash
# Add a new user
sudo /opt/paysync/scripts/manage-users.sh add john

# Add SSH key for user
sudo /opt/paysync/scripts/manage-users.sh ssh-key john "ssh-rsa AAAAB3Nza..."

# List all users
sudo /opt/paysync/scripts/manage-users.sh list

# Remove a user
sudo /opt/paysync/scripts/manage-users.sh remove john
```

---

## 8. Troubleshooting

### 8.1 Application Not Reachable

```bash
# 1. Check EC2 is running
aws ec2 describe-instances --instance-ids i-xxxxxxxx

# 2. Check security group rules (port 80 should be open to 0.0.0.0/0)
aws ec2 describe-security-groups --group-ids sg-xxxxxxxx

# 3. SSH into EC2 and check Docker
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP
docker compose ps
docker compose logs --tail=100

# 4. Check Nginx is running
curl -I http://localhost:80

# 5. Check backend health
curl http://localhost/api/health
```

### 8.2 Database Connection Issues

```bash
# 1. Check RDS is in available state
aws rds describe-db-instances --db-instance-identifier paysync-mysql

# 2. Check security group allows MySQL from EC2
# (ec2-sg should allow 3306, rds-sg should reference ec2-sg)

# 3. From EC2, test connectivity
nc -zv paysync-mysql.xxxxxx.ap-south-1.rds.amazonaws.com 3306

# 4. Check .env has correct values
cat /home/ubuntu/paysync-cloud/.env | grep DB_
```

### 8.3 Docker Issues

```bash
# Check Docker daemon
sudo systemctl status docker

# Check available disk (Docker may fail if disk is full)
df -h /

# Prune docker resources
docker system prune -af

# Rebuild containers with no cache
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

---

## 9. Teardown

### 9.1 Destroy Infrastructure

```bash
# ⚠️ WARNING: This destroys ALL infrastructure. Data will be lost.

cd terraform

# Destroy all resources (requires confirmation)
terraform destroy

# Or auto-approve
terraform destroy -auto-approve
```

### 9.2 Manual Cleanup (if terraform fails)

```bash
# Delete RDS (must remove deletion_protection first)
aws rds modify-db-instance \
  --db-instance-identifier paysync-mysql \
  --deletion-protection false
aws rds delete-db-instance \
  --db-instance-identifier paysync-mysql \
  --skip-final-snapshot

# Terminate EC2
aws ec2 terminate-instances --instance-ids i-xxxxxxxxxxxxxxxxx

# Delete VPC
aws ec2 delete-vpc --vpc-id vpc-xxxxxxxx

# Release Elastic IP
aws ec2 release-address --allocation-id eipalloc-xxxxxxxx
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

# Git
git log --oneline -10   # Recent commits
git diff main...HEAD    # Changes since main
```

### Cron Jobs on EC2

```cron
# Managed by setup-cron.sh
*/5 * * * * /opt/paysync/scripts/health-check.sh          # Health check every 5 min
0 2 * * * /opt/paysync/scripts/backup.sh                  # Backup daily at 2 AM
0 */6 * * * /opt/paysync/scripts/rotate-logs.sh           # Log rotation every 6 hours
```

### File Locations on EC2

| Path | Purpose |
|---|---|
| `/home/ubuntu/paysync-cloud/` | Application code |
| `/opt/paysync/scripts/` | Shell scripts |
| `/var/log/paysync/` | Application logs |
| `/etc/cron.d/paysync` | Cron jobs |
| `/home/ubuntu/.env` | Environment variables |
