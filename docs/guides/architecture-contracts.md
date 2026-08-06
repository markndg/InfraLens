# Architecture contracts

**Architecture contracts** bind capability-level requirements to the evidence graph. InfraLens evaluates whether implementation **satisfies** or **violates** those requirements and links the outcome into governance and sign-off.

## What a contract is

In the graph, contracts appear as `architecture-contract` resources with evaluations such as satisfied / violated / unknown. They sit alongside **obligations** (for example encryption, backup, review cadence) inferred from capability context.

Contracts are first-class governance artefacts — not a second parallel data store. Edges such as `satisfies-contract` and `violates-contract` connect contracts to implementing resources and findings.

## Requirements evaluated in 0.1.0

Built-in requirement checks include (non-exhaustive):

| Requirement | Typical evidence |
|-------------|------------------|
| HA database | Relational DB nodes with Multi-AZ / equivalent metadata |
| Encrypted data | Encryption fields on databases and buckets |
| Approved ownership | Orphaned-ownership tags below a threshold |
| Monitoring | Monitoring resources or telemetry naming signals |
| Internal communication | External systems flagged for egress review |

Targets default to business capabilities such as customer ordering / catalogue (or a platform capability fallback). See enrichment in `@infralens/architecture-intelligence`.

## How they show up in the product

- Governance dashboard and **Governance / Decision** projections
- Review stages and recommendation trade-offs
- Blocking findings when requirements fail and policies mark `blocksApproval`
- Simulation can show a contract moving toward satisfaction without mutating infrastructure

Demo narrative: resilience contract / HA requirement fails while `multi_az = false` on the production database.

## Contracts vs policies vs ADRs

| Mechanism | Authoring | Effect |
|-----------|-----------|--------|
| Architecture contract | Capability-scoped engine (preview built-ins) | Graph evaluation nodes/edges |
| Policy YAML (`policies/`) | Declarative rules | Findings with severity / sign-off |
| ADR consequences | Markdown in-repo | Decision validity when assumptions break |

Use policies for organisation-wide controls; use contracts for capability readiness; use ADRs for recorded decisions.

## Preview honesty

- Contract authoring as a rich user-facing DSL is early; 0.1.0 emphasises built-in evaluation on known estate shapes.
- Portfolio-wide contract libraries and multi-project roll-up are experimental.
- Always inspect evidence URIs before treating a violation as definitive.

## Related

- [Declaring intent](declaring-intent.md)
- [Policy format](../architecture/policy-format.md)
- [Projection contracts](../architecture/projection-contracts.md) (UI view contracts — different meaning)
- [Capability matrix](../product/capability-matrix.md)
