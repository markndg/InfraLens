# ADR-0001: Use PostgreSQL

## Status

Accepted

## Context

The retail platform needs durable transactional storage for orders and catalogue data with organisational ownership of the data plane.

## Decision

Use managed PostgreSQL (AWS RDS) as the system of record for Customer Ordering and Product Catalogue capabilities.

## Alternatives

- DynamoDB
- Aurora MySQL
- Self-managed Postgres on OpenShift

## Consequences

High availability requires Multi-AZ. Encryption at rest is mandatory. Schema ownership sits with the Retail Team.
