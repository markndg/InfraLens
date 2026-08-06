# ADR-0001: Serverless checkout

## Status

Accepted

## Context

Checkout must scale elastically without long-running services.

## Decision

Use API Gateway + Lambda + DynamoDB + SQS.

## Consequences

Point-in-time recovery must remain enabled on the orders table.
