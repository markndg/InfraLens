# Review and governance

Governance answers: **are we still building the architecture we intended, and is approval still defensible?**

Reviews are a first-class activity over the evidence graph. Outcomes must be reproducible from graph traversal — no LLM required for core analysis, recommendations, or explanations.

## Governance artefacts

| Artefact | Graph role |
|----------|------------|
| Intent | Declared architectural goals (`intent` nodes) |
| ADR / decision | Parsed Markdown decisions linked to intents and implementations |
| Assumption | Premises intents/decisions depend on |
| Architecture contract | Capability-scoped requirements (`architecture-contract`) |
| Obligation | Ongoing duties (encryption, backup, review cadence, …) |
| Finding / drift | Policy and reconciliation outcomes; may block sign-off |
| Review / sign-off | Evidence-state-bound approval records |

User-facing guides: [declaring-intent.md](../guides/declaring-intent.md), [writing-adrs.md](../guides/writing-adrs.md), [architecture-contracts.md](../guides/architecture-contracts.md), [architecture-review.md](../guides/architecture-review.md).

## Decision graph pattern

A typical path:

**Capability → Decision / ADR → Intent → Assumption → Implementing resource → Evidence → Review outcome**

On the Retail SaaS estate this often surfaces as: ordering capability → PostgreSQL ADR → highly-available intent → “DB is resilient” assumption → RDS node with `multi_az = false` → blocked approval.

## Review engine

Architecture intelligence provides staged reviews, personas, playbooks, notebooks, and deterministic recommendations with explicit trade-offs. Simulation (`simulate-assumption` and related) mutates a **graph counterfactual only** — never production infrastructure.

## Approval invalidation

Sign-off binds to a specific evidence state (bundle content hash / contemporaneous graph). When material drift or newly failing assumptions appear, prior approval becomes stale. Review **replay** requires retained historical bundles with sufficient evidence.

## Policies

Declarative YAML under `policies/` emits findings with severity and optional `blocksApproval`. See [policy-format.md](policy-format.md). Policies complement contracts; they do not replace intent modelling.

## Delivery surfaces

- Workbench governance dashboard and projection views
- CLI `inspect` / `report` / `compare`
- Local API routes for intents, contracts, assumptions, simulation (preview bridge)

## Preview limitations

- Persistence durability is local / in-memory oriented — treat on-disk bundles as the audit artefact.
- Portfolio, organisational graph, and governance analytics are experimental.
- Collaborative comments exist but are preview-grade.

See [product/limitations.md](../product/limitations.md) and [capability-matrix.md](../product/capability-matrix.md). Editions were removed in 0.1.0 ([migration-from-editions.md](../product/migration-from-editions.md)).
