terraform {
  required_version = ">= 1.5"
}

# Sparse legacy naming — no clean cloud-native labels
resource "aws_db_instance" "ORDDB" {
  identifier          = "orddb"
  engine              = "oracle-ee"
  instance_class      = "db.m5.large"
  allocated_storage   = 100
  multi_az            = false
  publicly_accessible = false
  skip_final_snapshot = true
}

resource "aws_s3_bucket" "archive" {
  bucket = "corp-archive-bucket"
}

resource "aws_instance" "batch" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "m5.xlarge"
  tags = {
    Name = "batch01"
    Role = "nightly_orders"
  }
}
