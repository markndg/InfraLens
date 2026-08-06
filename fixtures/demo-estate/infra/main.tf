provider "aws" {
  region = "eu-west-2"
}

resource "aws_vpc" "retail" {
  cidr_block = "10.20.0.0/16"
  tags = {
    Name = "retail-prod"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.retail.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = "eu-west-2a"
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.retail.id
  cidr_block        = "10.20.10.0/24"
  availability_zone = "eu-west-2a"
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.retail.id
  cidr_block        = "10.20.11.0/24"
  availability_zone = "eu-west-2b"
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.retail.id
}

resource "aws_nat_gateway" "nat" {
  subnet_id = aws_subnet.public_a.id
}

resource "aws_lb" "public" {
  name               = "retail-prod-alb"
  load_balancer_type = "application"
  subnets            = [aws_subnet.public_a.id]
}

resource "aws_security_group" "catalog" {
  name   = "retail-catalog"
  vpc_id = aws_vpc.retail.id
}

resource "aws_security_group" "db" {
  name   = "retail-db"
  vpc_id = aws_vpc.retail.id
}

resource "aws_s3_bucket" "assets" {
  bucket = "retail-prod-assets"
}

resource "aws_sqs_queue" "orders" {
  name = "retail-prod-orders"
}

resource "aws_db_instance" "postgres" {
  identifier          = "retail-prod-db"
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.medium"
  storage_encrypted   = true
  multi_az            = false
  port                = 5432
  publicly_accessible = false
}

resource "aws_elasticache_cluster" "sessions" {
  cluster_id = "retail-prod-redis"
  engine     = "redis"
}

resource "aws_iam_role" "catalog" {
  name = "retail-catalog-role"
}

resource "aws_iam_role_policy" "catalog_broad" {
  name = "catalog-broad"
  role = aws_iam_role.catalog.id
  policy = "{\"Effect\":\"Allow\",\"Action\":\"*\",\"Resource\":\"*\"}"
}

resource "aws_secretsmanager_secret" "db" {
  name = "retail/prod/db"
}

resource "aws_cloudwatch_log_group" "app" {
  name = "/retail/prod/app"
}

resource "aws_route53_record" "app" {
  name = "shop.example.com"
  type = "A"
}

resource "aws_route53_record" "admin" {
  name = "admin.example.com"
  type = "A"
}

module "shared_network" {
  source = "./modules/network"
}
