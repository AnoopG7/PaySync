# PaySync Digital Payments Cloud

A centralized cloud platform for digital payments management, deployed on AWS with automated CI/CD, containerized services, and comprehensive monitoring.

## Architecture

```
Internet → EC2 (m7i-flex.large, Ubuntu 24.04)
            ├── Nginx :80           → serves React SPA, proxies /api → backend
            ├── Backend :3001        → Express + knex + RDS MySQL
            ├── Frontend :80         → React 19 + Vite + TypeScript + shadcn/ui
            └── Jenkins :8080        → native apt install, inline pipeline
                    │
                    ▼ RDS MySQL :3306 (db.t4g.micro, private subnet)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Infrastructure** | Terraform (AWS) |
| **Compute** | EC2 m7i-flex.large, Docker Compose |
| **Database** | RDS MySQL 8.0 (db.t4g.micro, Multi-AZ) |
| **Backend** | Node.js 22, Express, knex, JWT |
| **Frontend** | React 19, Vite, TypeScript, shadcn/ui, zustand |
| **CI/CD** | Jenkins LTS (native, port 8080) |
| **Monitoring** | CloudWatch (agent installed, alarms ready) |
| **Automation** | 10 shell scripts + cron jobs |

## Project Structure

```
AWS/
├── terraform/             # IaC: VPC, EC2, RDS, SGs, S3 Endpoint
├── scripts/               # 10 automation scripts
├── backend/               # Express API (routes, middleware, db)
├── frontend/              # React SPA (10 pages)
├── cloudwatch/            # Dashboard, alarms, agent configs
├── docker-compose.yml     # 2 services: backend + frontend
├── Jenkinsfile            # CI/CD pipeline definition
└── docs/
    ├── aws-deployment.md  # Full deployment guide
    └── architecture.md    # Architecture document
```

## Quick Start

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit: ssh_allowed_cidr, rds_master_password, key_pair_name

terraform init
terraform apply   # ~5 min
```

The EC2 bootstrap automatically installs Docker, Node.js, Jenkins, CloudWatch agent, cron jobs, and deploys the app. See `docs/aws-deployment.md` for full instructions.

## Scripts

| Script | Auto? | Purpose |
|--------|-------|---------|
| `server-init.sh` | ✅ First boot | Bootstrap orchestrator |
| `setup-jenkins.sh` | ✅ Bootstrap | Install Jenkins + pipeline |
| `setup-cloudwatch.sh` | ✅ Bootstrap | Install CW agent |
| `setup-cron.sh` | ✅ Bootstrap | Install cron jobs |
| `health-check.sh` | ✅ Every 5 min | API + Docker + disk + memory |
| `backup.sh` | ✅ Daily 2am | mysqldump → gzip → backup dir |
| `rotate-logs.sh` | ✅ Weekly Sun 3am | Docker log rotation + journal clean |
| `deploy-app.sh` | ❌ Manual | Git pull + compose rebuild |
| `manage-users.sh` | ❌ Manual | Linux user/group admin |
| `monitor-system.sh` | ❌ Manual | Full diagnostic report |

## Frontend Pages

| Page | Lines | Purpose |
|------|-------|---------|
| `Dashboard.tsx` | 144 | Operational KPIs |
| `Login.tsx` + `Register.tsx` | 171 | Auth + RBAC |
| `Reports.tsx` | 112 | Reporting & analytics |
| `Workflows.tsx` | 100 | Workflow management |
| `Monitoring.tsx` | 168 | Metrics & alerts dashboard |
| `Executive.tsx` | 166 | Executive reporting portal |
| `Regions.tsx` | 102 | Multi-region management |
| `Admin.tsx` | 123 | Admin settings |
| `Pricing.tsx` | 242 | Cost estimator (6 requirement areas) |

## Credentials

| Service | URL | Login |
|---------|-----|-------|
| Application | `http://<EC2_IP>` | admin@paysync.cloud / admin123 |
| Jenkins | `http://<EC2_IP>:8080` | admin / admin123 |
| SSH | `ssh -i ~/.ssh/ec2-key.pem ubuntu@<EC2_IP>` | — |

## Problem Statement Coverage

- ✅ Cloud Architecture: VPC, subnets, IGW, S3 Gateway Endpoint, Multi-AZ
- ✅ Linux Administration: 10 scripts, cron, user/group mgmt, log rotation
- ✅ Cloud VM Deployment: Nginx, SSH, systemctl, Git
- ✅ Cloud Databases: RDS MySQL, knex migrations, backup/recovery
- ✅ Docker & Containerization: Compose, multi-container, Docker Hub
- ✅ Cloud Networking: VPC, SGs, public/private subnets, routing
- ⚠️ Monitoring: Agent installed, alarms/dashboard need manual deploy
- ✅ Automation: Full bootstrap, Jenkins pipeline, cron automation
- ✅ Product: 10 pages, 7 API routes, RBAC, reporting, workflows
- ✅ Pricing: 6 requirement areas covered in Pricing.tsx
