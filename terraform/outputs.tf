# ──────────────────────────────────────────────────────────────────────────────
# PaySync Cloud — Terraform Outputs
# ──────────────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the PaySync VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet ID (EC2)"
  value       = aws_subnet.public.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (RDS, one per AZ)"
  value       = aws_subnet.private[*].id
}

output "ec2_public_ip" {
  description = "Public IP of the EC2 application server"
  value       = aws_instance.app.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS of the EC2 application server"
  value       = aws_instance.app.public_dns
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "ec2_security_group_id" {
  description = "EC2 security group ID"
  value       = aws_security_group.ec2.id
}

output "rds_endpoint" {
  description = "RDS MySQL connection endpoint"
  value       = aws_db_instance.mysql.endpoint
}

output "rds_port" {
  description = "RDS MySQL port"
  value       = aws_db_instance.mysql.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.mysql.db_name
}

output "rds_master_username" {
  description = "RDS master username"
  value       = aws_db_instance.mysql.username
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "ssh_command" {
  description = "SSH command to connect to the EC2 instance"
  value       = "ssh -i ~/.ssh/ec2-key.pem ubuntu@${aws_instance.app.public_ip}"
}

output "jenkins_url" {
  description = "Jenkins web UI URL"
  value       = "http://${aws_instance.app.public_ip}:8080"
}

output "application_url" {
  description = "URL to access the PaySync application"
  value       = "http://${aws_instance.app.public_ip}"
}

output "rds_connection_params" {
  description = "RDS connection parameters for backend .env (DB_TYPE=mysql)"
  value = {
    DB_HOST = aws_db_instance.mysql.endpoint
    DB_PORT = aws_db_instance.mysql.port
    DB_NAME = aws_db_instance.mysql.db_name
    DB_USER = aws_db_instance.mysql.username
  }
  sensitive = true
}
