# ──────────────────────────────────────────────────────────────────────────────
# PaySync Cloud — EC2 Instance (Application Server)
# ──────────────────────────────────────────────────────────────────────────────
# Deploys a single m7i-flex.large EC2 running Ubuntu 24.04 LTS in the public
# subnet. Security group opens ports 22 (SSH), 80 (HTTP), 443 (HTTPS), and
# 8080 (Jenkins) to the internet. The Express backend at port 3001 is NOT
# exposed directly — Nginx proxies /api/* requests internally via Docker.
#
# The server-init.sh script is passed as user_data for automated bootstrap.
# The AMI is dynamically resolved to the latest Ubuntu 24.04 LTS image for
# the target region using Canonical's official AWS account (099720109477).
# ──────────────────────────────────────────────────────────────────────────────

# ── Ubuntu 24.04 LTS AMI (dynamically resolved per region) ──
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── Security Group: EC2 ──
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "Security group for PaySync EC2 instance"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project_name}-ec2-sg" }
}

# SSH — restricted to your IP (set via ssh_allowed_cidr)
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = var.ssh_allowed_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH"
}

# HTTP — frontend served by Nginx
resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  description       = "HTTP — Frontend"
}

# HTTPS — for TLS termination (future: ACM)
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS"
}

# Jenkins web UI — restricted to your IP
resource "aws_vpc_security_group_ingress_rule" "jenkins" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = var.ssh_allowed_cidr
  from_port         = 8080
  to_port           = 8080
  ip_protocol       = "tcp"
  description       = "Jenkins UI"
}

# All outbound (for Docker pulls, apt, API calls, etc.)
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "All outbound"
}

# ── EC2 Instance ──
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  key_name               = aws_key_pair.deploy.key_name

  user_data = base64encode(templatefile("${path.module}/../backend/scripts/server-init.sh", {
    GIT_REPO_URL = "https://github.com/YOUR_ORG/paysync-cloud.git"
    DEPLOY_BRANCH = "main"
  }))

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
    tags        = { Name = "${var.project_name}-root-volume" }
  }

  metadata_options {
    http_tokens = "required"
  }

  tags = { Name = "${var.project_name}-app-server" }
}

# ── SSH Key Pair ──
resource "aws_key_pair" "deploy" {
  key_name   = "${var.project_name}-deploy-key"
  public_key = file(var.public_key_path)
}

# ── Elastic IP (static public IP for the app) ──
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = "${var.project_name}-eip" }
}
