# ──────────────────────────────────────────────────────────────────────────────
# PaySync Cloud — RDS MySQL Instance (Database)
# ──────────────────────────────────────────────────────────────────────────────
# Deploys a db.t4g.micro MySQL RDS instance across two private subnets (one
# per AZ). Security group allows MySQL access only from the EC2 security group.
# Automated backups enabled with 7-day retention.
#
# NOTE: deletion_protection is disabled and skip_final_snapshot is on for easy
#       teardown during development. Re-enable both for production.
# ──────────────────────────────────────────────────────────────────────────────

# ── Security Group: RDS ──
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for PaySync RDS MySQL"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project_name}-rds-sg" }
}

# MySQL access from EC2 only (via security group reference, not CIDR)
resource "aws_vpc_security_group_ingress_rule" "mysql" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ec2.id
  from_port                    = 3306
  to_port                      = 3306
  ip_protocol                  = "tcp"
  description                  = "MySQL from EC2"
}

# All outbound
resource "aws_vpc_security_group_egress_rule" "rds_out" {
  security_group_id = aws_security_group.rds.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "All outbound"
}

# ── DB Subnet Group (private subnets across 2 AZs) ──
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${var.project_name}-db-subnet-group" }
}

# ── RDS MySQL Instance ──
resource "aws_db_instance" "mysql" {
  identifier = "${var.project_name}-mysql"

  engine         = "mysql"
  engine_version = "8.0.40"
  instance_class = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  delete_automated_backups = false

  db_name  = var.rds_db_name
  username = var.rds_master_username
  password = var.rds_master_password
  port     = 3306

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot   = true

  skip_final_snapshot = true

  deletion_protection = false

  tags = { Name = "${var.project_name}-mysql" }
}
