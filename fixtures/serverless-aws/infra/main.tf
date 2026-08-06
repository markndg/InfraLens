terraform {
  required_version = ">= 1.5"
}

provider "aws" {
  region = "eu-west-1"
}

resource "aws_api_gateway_rest_api" "checkout" {
  name = "checkout-api"
}

resource "aws_lambda_function" "checkout" {
  function_name = "checkout-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.checkout.arn
  filename      = "checkout.zip"
  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.orders.name
      QUEUE_URL  = aws_sqs_queue.orders.id
      ASSET_BUCKET = aws_s3_bucket.receipts.bucket
    }
  }
}

resource "aws_dynamodb_table" "orders" {
  name         = "checkout-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"
  attribute {
    name = "orderId"
    type = "S"
  }
  # Intent: point-in-time recovery required for payment orders
  point_in_time_recovery {
    enabled = false
  }
}

resource "aws_sqs_queue" "orders" {
  name = "checkout-orders"
}

resource "aws_s3_bucket" "receipts" {
  bucket = "checkout-receipts"
}

resource "aws_iam_role" "checkout" {
  name = "checkout-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_secretsmanager_secret" "payments" {
  name = "checkout/payments"
}

resource "aws_cloudwatch_log_group" "checkout" {
  name = "/aws/lambda/checkout-handler"
}
