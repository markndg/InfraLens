# ADR-0002: Deploy to OpenShift

## Status

Accepted

## Context

Application workloads must run on a portable container platform with organisation-operated networking and routes.

## Decision

Deploy storefront, catalog and order-worker to OpenShift with Routes for public ingress.

## Alternatives

- EKS
- ECS
- Cloud Run

## Consequences

Platform Team owns cluster lifecycle. Public Routes require security review. Workloads should remain portable across Kubernetes-compatible platforms.
