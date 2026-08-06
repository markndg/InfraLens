import type { ProjectFile } from '@infralens/discovery-core';
import awsInventory from '../../../fixtures/demo-estate/.infralens/aws-inventory.json';
import clusterInventory from '../../../fixtures/demo-estate/.infralens/cluster-inventory.json';

export const demoSnapshots = {
  awsInventory,
  clusterInventory,
};

export const demoFiles: ProjectFile[] = [
  {
    path: 'infra/main.tf',
    content: `provider "aws" {
  region = "eu-west-2"
}

resource "aws_vpc" "retail" {
  cidr_block = "10.20.0.0/16"
  tags = { Name = "retail-prod" }
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
  identifier        = "retail-prod-db"
  engine            = "postgres"
  storage_encrypted = true
  multi_az          = false
  port              = 5432
}

resource "aws_iam_role" "catalog" {
  name = "retail-catalog-role"
}

resource "aws_secretsmanager_secret" "db" {
  name = "retail/prod/db"
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
`,
  },
  {
    path: 'deploy/openshift.yaml',
    content: `apiVersion: apps/v1
kind: Deployment
metadata: { name: storefront, namespace: retail-prod, labels: { app: storefront } }
spec:
  replicas: 3
  selector: { matchLabels: { app: storefront } }
  template:
    metadata: { labels: { app: storefront } }
    spec:
      containers:
        - name: storefront
          image: example/storefront:2.4.0
          ports: [{ containerPort: 8080 }]
          resources: { limits: { cpu: "500m", memory: "512Mi" } }
          readinessProbe: { httpGet: { path: /health, port: 8080 } }
          env:
            - { name: CATALOG_URL, value: "http://catalog:8081" }
            - { name: ASSET_BUCKET, value: "retail-prod-assets" }
            - { name: PAYMENT_URL, value: "https://payments.partner.example/api" }
---
apiVersion: v1
kind: Service
metadata: { name: storefront, namespace: retail-prod }
spec: { selector: { app: storefront }, ports: [{ name: http, port: 80, targetPort: 8080 }] }
---
apiVersion: route.openshift.io/v1
kind: Route
metadata: { name: shop, namespace: retail-prod }
spec: { host: shop.example.com, to: { kind: Service, name: storefront }, port: { targetPort: http }, tls: { termination: edge } }
---
apiVersion: route.openshift.io/v1
kind: Route
metadata: { name: admin, namespace: retail-prod }
spec: { host: admin.example.com, to: { kind: Service, name: storefront }, port: { targetPort: http }, tls: { termination: edge } }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: catalog, namespace: retail-prod, labels: { app: catalog } }
spec:
  replicas: 2
  selector: { matchLabels: { app: catalog } }
  template:
    metadata: { labels: { app: catalog } }
    spec:
      containers:
        - name: catalog
          image: example/catalog:latest
          ports: [{ containerPort: 8081 }]
          env:
            - { name: DB_HOST, value: "retail-prod-db" }
            - { name: DB_PORT, value: "5432" }
            - { name: DB_PASSWORD, valueFrom: { secretKeyRef: { name: catalog-db, key: password } } }
            - { name: ORDER_QUEUE, value: "retail-prod-orders" }
---
apiVersion: v1
kind: Service
metadata: { name: catalog, namespace: retail-prod }
spec: { selector: { app: catalog }, ports: [{ name: http, port: 8081, targetPort: 8081 }] }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: order-worker, namespace: retail-prod, labels: { app: order-worker } }
spec:
  replicas: 1
  selector: { matchLabels: { app: order-worker } }
  template:
    metadata: { labels: { app: order-worker } }
    spec:
      containers:
        - name: worker
          image: example/order-worker:3.1.0
          env:
            - { name: ORDER_QUEUE, value: "retail-prod-orders" }
            - { name: ASSET_BUCKET, value: "retail-prod-assets" }
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: restrict-catalog, namespace: retail-prod }
spec:
  podSelector: { matchLabels: { app: catalog } }
  policyTypes: [Ingress, Egress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: storefront } } }]
      ports: [{ protocol: TCP, port: 8081 }]
  egress:
    - ports: [{ protocol: TCP, port: 5432 }]
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: staging-catalog, namespace: retail-staging }
spec:
  replicas: 1
  selector: { matchLabels: { app: staging-catalog } }
  template:
    metadata: { labels: { app: staging-catalog } }
    spec:
      containers:
        - name: catalog
          image: example/catalog:1.9.0
          env:
            - { name: DB_HOST, value: "retail-prod-db" }
            - { name: ORDER_QUEUE, value: "retail-prod-orders" }
`,
  },
  {
    path: 'docker-compose.yml',
    content: `services:\n  local-mail:\n    image: mailhog/mailhog\n    ports: ["8025:8025"]\n`,
  },
  {
    path: 'apps/storefront/package.json',
    content: `{"name":"storefront","scripts":{"start":"vite --port 8080","build":"vite build"},"dependencies":{"react":"18.3.1","react-dom":"18.3.1","@aws-sdk/client-s3":"3.600.0"},"devDependencies":{"vite":"5.4.0","@vitejs/plugin-react":"4.3.1"}}`,
  },
  {
    path: 'apps/catalog/application.yaml',
    content: `server:\n  port: 8081\nspring:\n  datasource:\n    url: jdbc:postgresql://retail-prod-db:5432/catalog\n    password: super-secret-db-password\n  redis:\n    host: catalog-cache\nmanagement:\n  endpoints:\n    web:\n      exposure:\n        include: health,info\n`,
  },
  {
    path: 'apps/order-worker/package.json',
    content: `{"name":"order-worker","scripts":{"start":"node dist/worker.js"},"dependencies":{"@aws-sdk/client-sqs":"3.600.0","@aws-sdk/client-s3":"3.600.0"}}`,
  },
  {
    path: 'apps/catalog/.env',
    content: `DB_HOST=retail-prod-db\nORDER_QUEUE=retail-prod-orders\nAPI_TOKEN=sk-live-should-be-redacted\n`,
  },
  {
    path: 'docs/adr/0001-use-postgresql.md',
    content: `# ADR-0001: Use PostgreSQL

## Status

Accepted

## Context

The retail platform needs durable transactional storage for orders and catalogue data with high availability.

## Decision

Use managed PostgreSQL (AWS RDS) as the system of record for Customer Ordering and Product Catalogue capabilities.

## Alternatives

- DynamoDB
- Aurora

## Consequences

High availability requires Multi-AZ. Encryption at rest is mandatory.
`,
  },
  {
    path: 'docs/adr/0002-deploy-openshift.md',
    content: `# ADR-0002: Deploy to OpenShift

## Status

Accepted

## Context

Application workloads must run on a portable container platform.

## Decision

Deploy storefront, catalog and order-worker to OpenShift with Routes for public ingress.

## Alternatives

- EKS
- ECS

## Consequences

Public Routes require security review.
`,
  },
  {
    path: 'docs/adr/0003-event-driven-orders.md',
    content: `# ADR-0003: Event-driven order processing

## Status

Accepted

## Context

Order fulfilment must not block the synchronous storefront request path.

## Decision

Publish order events to SQS and process them with an order-worker Deployment.

## Alternatives

- Synchronous fulfilment
- Kafka

## Consequences

Worker replica count must support availability objectives.
`,
  },
];
