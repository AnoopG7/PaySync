# PaySync Cloud — Architecture Document

> **Version:** 1.0  
> **Last Updated:** June 2026  
> **Author:** PaySync DevOps Team  
> **Audience:** System Architects, Developers, Operations Engineers

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Compute Layer](#3-compute-layer)
4. [Storage Layer](#4-storage-layer)
5. [Networking Layer](#5-networking-layer)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Monitoring & Observability](#7-monitoring--observability)
8. [Security](#8-security)
9. [High Availability & Disaster Recovery](#9-high-availability--disaster-recovery)
10. [Scalability](#10-scalability)
11. [Cost Analysis](#11-cost-analysis)

---

## 1. Overview

PaySync Cloud is a digital payments management platform deployed on AWS. It
provides real-time dashboards, transaction monitoring, multi-region analytics,
role-based access control (RBAC), and automated reporting workflows.

### 1.1 Design Goals

| Goal | Approach |
|---|---|
| **Cost efficiency** | Student credits cover m7i-flex.large + RDS free tier |
| **Security** | IMDSv2, security group least-privilege, encrypted storage |
| **Maintainability** | Docker Compose, Terraform IaC, declarative Jenkins pipeline |
| **Observability** | CloudWatch metrics + alarms, cron health checks |
| **Portability** | SQLite-local / MySQL-RDS dual dialect via knex |

---

## 2. System Architecture

```
                    ┌────────────────────────┐
                    │     End Users          │
                    └──────────┬─────────────┘
                               │
                               ▼
                    ┌────────────────────────┐
                    │   Internet Gateway      │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴────────────┐
                    │   VPC — 10.0.0.0/16    │
                    │  ┌──────────────────┐  │
                    │  │  Public Subnet   │  │
                    │  │  10.0.1.0/24     │  │
 │  │ ap-south-1a     │  │
                    │  │  ┌──────────┐   │  │
                    │  │  │ EC2      │   │  │
                    │  │  │ m7i-flex │   │  │
                    │  │  │ .large   │   │  │
                    │  │  └──────────┘   │  │
                    │  └──────────────────┘  │
                    │                         │
                     │  ┌──────────────────┐  │
                     │  │ Private Subnet 1 │  │
                     │  │ 10.0.10.0/24     │  │
                     │  │ ap-south-1a      │  │
                     │  │  ┌──────────┐   │  │
                     │  │  │ RDS      │   │  │
                     │  │  │ db.t4g.  │   │  │
                     │  │  │ micro    │   │  │
                     │  │  │ MySQL    │   │  │
                     │  │  └──────────┘   │  │
                     │  └──────────────────┘  │
                     │                         │
                     │  ┌──────────────────┐  │
                     │  │ Private Subnet 2 │  │
                     │  │ 10.0.11.0/24     │  │
                     │  │ ap-south-1b      │  │
                     │  └──────────────────┘  │
                    │                         │
                    │  ┌──────────────────┐  │
                    │  │ S3 Gateway       │  │
                    │  │ Endpoint (free)  │  │
                    │  └──────────────────┘  │
                    └────────────────────────┘

    ┌──────────────────────────────────────────────┐
    │   Docker Containers                           │
    │   ┌─────────────────┐  ┌──────────────────┐  │
    │   │  Nginx (port 80)│  │  Jenkins (8080)  │  │
    │   │  Reverse proxy  │  │  CI/CD pipeline  │  │
    │   ├─────────────────┤  └──────────────────┘  │
    │   │  Express API    │  Port 3001, JWT auth   │
    │   ├─────────────────┤                        │
    │   │  React SPA      │  Vite build, shadcn    │
    │   └─────────────────┘                        │
    └──────────────────────────────────────────────┘

```

### 2.1 Component Responsibilities

| Component | Role |
|---|---|
| **Internet Gateway** | Public internet connectivity for VPC |
| **EC2 (m7i-flex.large)** | Runs Docker Engine; hosts Nginx + API + Frontend + Jenkins containers |
| **RDS (db.t4g.micro)** | Managed MySQL 8.0; automated backups |
| **CloudWatch** | 7 alarm configs (manual deployment); agent installed but needs IAM role |
| **S3** | (Optional) Backup archival; static asset storage |

---

## 3. Compute Layer

### 3.1 EC2 Instance

| Attribute | Value |
|---|---|
| **Type** | m7i-flex.large (2 vCPU, 8 GiB RAM) |
| **AMI** | Ubuntu 24.04 LTS (Noble Numbat) |
| **Storage** | 20 GB gp3 (encrypted) |
| **Tenancy** | Shared (default) |
| **Metadata** | IMDSv2 required (`http_tokens = "required"`) |

**Bootstrap sequence** (`server-init.sh`):
1. Update system packages
2. Install Docker Engine & docker compose plugin, Node.js 22.x
3. Enable & start Docker daemon
4. Clone application repository from GitHub
5. Create `.env` with real RDS endpoint (injected by Terraform `replace()`)
6. Run `docker compose up --build -d`
7. Install CloudWatch agent (`setup-cloudwatch.sh`), Jenkins + pipeline (`setup-jenkins.sh`), cron jobs (`setup-cron.sh`)

### 3.2 Container Architecture

```
┌──────────────────────────────────────────────┐
│              docker-compose.yml               │
│  ┌──────────┐     ┌──────────────┐           │
│  │  Nginx   │────▶│  Frontend    │           │
│  │  :80     │     │  (nginx:alp) │           │
│  │          │────▶│  Backend     │           │
│  └──────────┘     │  :3001       │           │
│                   └──────┬───────┘           │
│                          │                   │
│                   ┌──────▼───────┐           │
│                   │    RDS       │           │
│                   │    MySQL     │           │
│                   └──────────────┘           │
│  ┌──────────────────────────────────────┐    │
│  │  Jenkins :8080                       │    │
│  │  CI/CD pipeline, Docker socket      │    │
│  │  -Xmx256m memory limit              │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

Nginx serves the React SPA's static build for `/` and proxies `/api/*` requests
to the Express backend (port 3001). The backend is **never exposed directly**
to the internet — only ports 22, 80, and 443 are open on the EC2 security group.

---

## 4. Storage Layer

### 4.1 RDS MySQL

| Attribute | Value |
|---|---|
| **Engine** | MySQL 8.0.40 |
| **Class** | db.t4g.micro (2 vCPU, 1 GiB RAM) |
| **Storage** | 20 GB gp3 (encrypted) |
| **Backup** | 7-day retention, daily 03:00-04:00 UTC |
| **Maintenance** | Sunday 04:00-05:00 UTC |
| **Multi-AZ** | Yes (standby in ap-south-1b) |
| **Deletion protection** | Disabled |

### 4.2 Local SQLite (Dev)

For local development, the application uses SQLite via the same knex query
builder (configurable via `DB_TYPE=sqlite`). This eliminates the need for a
local MySQL daemon. The database file is stored at `backend/data/paysync.db`
in a named Docker volume.

### 4.3 EBS Volume

The EC2 root volume is 20 GB gp3 encrypted volume. Docker images, logs, and
application code reside here. Log rotation (handled by `rotate-logs.sh`)
prevents disk exhaustion.

---

## 5. Networking Layer

### 5.1 VPC Design

| Resource | CIDR / Config |
|---|---|
| **VPC** | 10.0.0.0/16 |
| **Public subnet** (EC2) | 10.0.1.0/24 (ap-south-1a) |
| **Private subnet 1** (RDS primary) | 10.0.10.0/24 (ap-south-1a) |
| **Private subnet 2** (RDS standby) | 10.0.11.0/24 (ap-south-1b) |
| **Internet Gateway** | Attached to VPC |
| **Public route table** | 0.0.0.0/0 → IGW |
| **Private route table** | Local only (no NAT — free tier) |
| **S3 Gateway Endpoint** | Private subnet → S3 for RDS backups |

### 5.2 Security Groups

| Group | Inbound | Outbound | Purpose |
|---|---|---|---|
| **ec2-sg** | SSH (your IP), HTTP (0.0.0.0/0), HTTPS (0.0.0.0/0) | All | App server — port 3001 NOT exposed |
| **rds-sg** | MySQL 3306 (from ec2-sg only) | All | Database isolated in private subnets |

**Security best practices applied:**
- EC2 metadata requires IMDSv2 (`http_tokens = "required"`)
- RDS is **not** publicly accessible
- SSH is restricted to a configurable CIDR
- EBS and RDS storage are encrypted at rest
- RDS has deletion protection disabled for easy dev teardown

---

## 6. CI/CD Pipeline

### 6.1 Jenkins Pipeline Stages

Jenkins runs **natively on the EC2 host** (apt install, systemd, port 8080).
The `jenkins` user is added to the `docker` group so the pipeline can run
`docker compose` commands directly — no Docker-in-Docker needed.

```
 ┌─────────┐  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐
 │Checkout │→ │Install Deps│→ │Lint + TypeCheck│→ │Build Images│→ │Deploy    │
 │(GitHub) │  │(npm ci)    │  │(tsc --noEmit)  │  │(compose)   │  │(compose  │
 └─────────┘  └────────────┘  └──────────────┘  └────────────┘  │up -d)    │
                                                                 └──────────┘
```

### 6.2 Artifact Flow

1. Developer pushes to `main` branch on GitHub
2. Jenkins webhook triggers the pipeline (or manual build)
3. Pipeline checks out code, installs deps, runs lint + type check
4. Docker images are built locally
5. `docker compose up -d` restarts services with new images

No Docker Hub push or SSH deploy needed — everything runs on the same host.



---

## 7. Monitoring & Observability

### 7.1 CloudWatch Alarms (Manual Setup)

7 alarm configs are defined in `cloudwatch/alarms.json` but not automatically deployed.
The EC2 has no IAM role, so CloudWatch agent metrics don't flow. Alarms can be created
from your local machine via AWS CLI (see `docs/aws-deployment.md` §6).

| Alarm | Metric | Threshold |
|---|---|---|
| **CPU High** | AWS/EC2 CPUUtilization | ≥80% for 5 min |
| **Status Check Failed** | AWS/EC2 StatusCheckFailed | ≥1 for 1 min |
| **Disk High** | CWAgent disk_used_percent | ≥90% for 5 min |
| **Memory High** | CWAgent mem_used_percent | ≥90% for 5 min |
| **RDS CPU High** | AWS/RDS CPUUtilization | ≥80% for 5 min |
| **RDS Connections High** | AWS/RDS DatabaseConnections | ≥20 for 5 min |
| **RDS Storage Low** | AWS/RDS FreeStorageSpace | <5 GB for 5 min |

### 7.2 Health Check Script (`health-check.sh`)

Runs every 5 minutes via cron and checks:
- API endpoint returns 200
- Docker containers are running
- Disk usage < 90%
- Memory usage < 90%

### 7.3 Log Rotation (`rotate-logs.sh`)

- Docker logs are rotated every 6 hours
- Logs older than 7 days are gzipped
- Gzipped logs older than 30 days are deleted

---

## 8. Security

| Layer | Measure |
|---|---|
| **IAM / Access** | No root user access; IAM roles for EC2 (if needed) |
| **Network** | Security group least-privilege; RDS not public |
| **Encryption at rest** | EBS (AES-256), RDS (AES-256) |
| **Encryption in transit** | HTTPS via Nginx (TLS termination) |
| **Instance metadata** | IMDSv2 enforced |
| **Database** | Automated backups; no public endpoint |
| **Authentication** | JWT with bcrypt password hashing; 6 demo users across 3 roles |
| **Secrets** | `.env` never committed; Jenkins credentials managed via plugin |
| **OS** | Regular updates via `server-init.sh` and cron |

---

## 9. High Availability & Disaster Recovery

### 9.1 High Availability (HA)

| Component | HA Strategy |
|---|---|
| **EC2** | Single instance; restart on failure via CloudWatch |
| **RDS** | Single-AZ with automated backups; point-in-time restore |

### 9.2 Disaster Recovery (DR)

| Scenario | RTO | RPO | Recovery Method |
|---|---|---|---|
| **EC2 failure** | ~15 min | N/A | Launch new instance via Terraform; restore from latest backup |
| **RDS failure** | ~30 min | ~5 min | Restore from latest automated snapshot |
| **Data corruption** | ~1 hour | 24 hours | Restore from latest automated snapshot |
| **Region failure** | ~4 hours | 24 hours | Deploy Terraform in secondary region; restore DB snapshot |
| **Accidental deletion** | ~15 min | N/A | Terraform plan/apply to recreate |

---

## 10. Scalability

### 10.1 Current Architecture (Free Tier)

- **Single EC2** m7i-flex.large (2 vCPU, 8 GiB RAM)
- **Single RDS** db.t4g.micro (2 vCPU, 1 GiB RAM, 20 GB)
- **No load balancer** — direct IP access

### 10.2 Future Growth Path

| Scale Level | Changes Required |
|---|---|
| **Small** (100s users) | Increase EC2 → t3.medium; RDS → db.t3.small |
| **Medium** (1000s users) | Add ALB + auto-scaling group (min 2); RDS → db.r6g.large; ElastiCache for sessions |
| **Large** (10,000s users) | Multi-region active-active; Aurora Global DB; CloudFront CDN; ECS Fargate |
| **Enterprise** (100k+ users) | Microservices decomposition; event-driven (SQS/SNS); read replicas; DynamoDB |

---

## 11. Cost Analysis

### 11.1 Monthly Estimate (Student Credits)

| Service | Config | Estimated Cost |
|---|---|---|
| **EC2** | m7i-flex.large (1 instance) | ~$73.58/mo |
| **RDS** | db.t4g.micro | $0.00 (free tier: 750 hrs/mo, 20 GB) |
| **EBS** | 20 GB gp3 | ~$2.00/mo |
| **Data transfer** | ~50 GB out | ~$4.50/mo |
| **CloudWatch** | Agent + 7 alarms (manual setup) | ~$1.00/mo |
| **S3** (backups) | 5 GB | ~$0.10/mo |
| **Total** | | **~$81.18/mo** |

### 11.2 Production Estimate (Medium Scale)

| Service | Config | Estimated Cost |
|---|---|---|
| **EC2** | t3.medium (2 instances behind ALB) | ~$80.00/mo |
| **ALB** | 1 ALB + data processing | ~$25.00/mo |
| **RDS** | db.r6g.large (Multi-AZ) | ~$350.00/mo |
| **EBS** | 2 × 50 GB gp3 | ~$10.00/mo |
| **Data transfer** | ~500 GB out | ~$45.00/mo |
| **CloudWatch** | Detailed monitoring + Container Insights | ~$15.00/mo |
| **ElastiCache** | cache.t3.small | ~$15.00/mo |
| **Total** | | **~$540.00/mo** |

> **Note:** Prices are estimates based on ap-south-1 (Mumbai, June 2026 pricing).
> Actual costs vary by usage. Use the AWS Pricing Calculator for precise estimates.

---

## A. Appendix: Key Decisions

### Why SQLite locally + RDS in production?

- No local MySQL daemon needed — simpler dev setup
- Knex query builder abstracts dialect differences
- Same migration files run against both databases
- Eliminates MySQL version conflicts across dev machines

### Why Nginx over Apache?

- Smaller container image (nginx:alpine = 23 MB vs httpd = 145 MB)
- Simpler reverse proxy config for SPA + API routing
- Better performance for static file serving

### Why not use ECS Fargate?

- Free tier EC2 is sufficient for the project
- ECS adds complexity (task definitions, service discovery, IAM)
- Project requirement explicitly mentions EC2 deployment

### Why not multi-region?

- Multi-region DR requires NAT Gateway, cross-region replication, Route 53
  routing policies — none are free tier eligible
- Architecture document describes the conceptual design for future growth
