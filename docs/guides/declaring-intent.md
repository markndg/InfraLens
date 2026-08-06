# Declaring intent

**Intent** is what the architecture is supposed to achieve. InfraLens validates intents against declared, rendered, planned, and observed implementation in the evidence graph.

## Built-in intent catalogue (0.1.0)

Governance enrichment materialises intents from a fixed catalogue, for example:

| ID | Meaning |
|----|---------|
| `highly-available` | Survive AZ / replica failures |
| `private-api` | APIs not unnecessarily public |
| `stateless-service` | Compute without sticky local state |
| `zero-trust` | Explicit trust boundaries / least privilege |
| `encrypted-storage` | Data encrypted at rest |
| `internal-only` | No public internet exposure |
| `event-driven` | Async decoupling via events/queues |
| `low-cost` | Cost-conscious choices |
| `portable` | Platform-portable workloads |
| `observable` | Monitoring / telemetry present |
| `least-privilege` | Minimal identity permissions |

If no intents are declared on the graph, a default subset is applied (including `highly-available`, `encrypted-storage`, `event-driven`, `observable`, `least-privilege`, `portable`).

## How intents appear in a review

1. Intent nodes sit in the governance layer of the graph.
2. Decisions / ADRs may **realize** intents.
3. Intents **depend on assumptions** (for example “database is resilient”).
4. Validation marks satisfaction from evidence (Multi-AZ, encryption metadata, ingress exposure, monitoring presence, …).
5. Failed intents contribute to readiness, findings, and blocked sign-off.

On the Retail SaaS demo, the highly-available intent typically fails because production database evidence shows Multi-AZ disabled.

## Declaring which intents apply

In this preview, selection is primarily via the graph’s `declaredIntents` list (set during governance enrichment / scan pipeline options). There is no separate public YAML product format yet — treat the catalogue IDs above as the stable vocabulary.

Practical ways to “declare” intent for a team today:

- Keep ADRs whose **consequences** encode the same constraints (parsed and linked into the decision graph).
- Rely on default intents for greenfield demos, then narrow `declaredIntents` as the estate matures.
- Use architecture **contracts** and policies for enforceable requirements (see [architecture-contracts.md](architecture-contracts.md) and [policy-format.md](../architecture/policy-format.md)).

## Intent vs policy vs contract

| Artefact | Role |
|----------|------|
| Intent | Architectural goal (“be highly available”) |
| Assumption | Premise the intent rests on (“DB is multi-AZ”) |
| Contract / obligation | Capability-scoped requirements evaluated on the graph |
| Policy YAML | Declarative finding rules (severity, sign-off blocks) |

## Preview limits

- Satisfaction checks are rule-based over evidence metadata and structure — not open-ended NLP.
- Custom intent IDs outside the catalogue need code changes in this preview.
- Cross-repo portfolio intent roll-ups are experimental.

## Related

- [Architecture contracts](architecture-contracts.md)
- [Writing ADRs](writing-adrs.md)
- [Review and governance](../architecture/review-and-governance.md)
