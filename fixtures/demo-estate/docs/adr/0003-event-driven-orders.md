# ADR-0003: Event-driven order processing

## Status

Accepted

## Context

Order fulfilment must not block the synchronous storefront request path.

## Decision

Publish order events to SQS and process them with an order-worker Deployment.

## Alternatives

- Synchronous fulfilment in catalog
- Kafka

## Consequences

Worker replica count must be ≥2 for availability. Queue depth requires observability. External payment calls remain outside the critical write path.
