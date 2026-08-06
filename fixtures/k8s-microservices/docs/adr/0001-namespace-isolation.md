# ADR-0001: Namespace isolation for payments and billing

## Status

Accepted

## Context

Payments and billing share a cluster but must not freely communicate.

## Decision

Deploy services in separate namespaces with NetworkPolicy controlling ingress to billing.

## Assumptions

- Same-name resources in different namespaces remain distinct.
- Cross-namespace calls from payments to billing-api are explicitly allowed; reverse traffic is denied.

## Consequences

An ownership gap or missing NetworkPolicy invalidates the isolation decision.
