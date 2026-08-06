# Writing ADRs for InfraLens

InfraLens parses Architecture Decision Records from Markdown and binds them into the evidence graph as `adr` / `architectural-decision` nodes with evidence lineage.

## Where to put them

Place files so the scanner recognises them:

- `docs/adr/0001-short-title.md` (preferred)
- Paths matching `ADR-####` / `ADR_####` with a `.md` extension

Reference examples:

- `fixtures/demo-estate/docs/adr/`
- `fixtures/serverless-aws/docs/adr/`
- `fixtures/legacy-hybrid/docs/adr/`

## Recommended shape

```markdown
# ADR-0001: Use PostgreSQL

## Status

Accepted

## Context

Why the decision is needed.

## Decision

What you chose.

## Alternatives

- Option A
- Option B

## Consequences

What must remain true for this decision to stay valid.
```

The parser reads `#` title, and `## Status`, `## Context`, `## Decision`, `## Consequences`, `## Alternatives` sections. Missing sections degrade metadata quality but do not abort the scan.

## How InfraLens uses ADRs

- Creates graph nodes with status, decision text, and source URI evidence (`truthState: declared`).
- Links decisions to **intents**, **assumptions**, and implementing resources when governance enrichment can resolve them.
- Surfaces invalid or at-risk ADRs when consequences/assumptions fail against evidence (for example “Multi-AZ required” vs `multi_az = false`).

Write consequences as **testable constraints**, not slogans. “Encryption at rest is mandatory” and “Multi-AZ is required for HA” give the review engine something to evaluate.

## Status values

Common values: `Accepted`, `Proposed`, `Deprecated`, `Superseded`. Lifecycle treats “super*” statuses as deprecated. Keep status accurate when replacing decisions.

## Preview honesty

- Linking quality depends on estate shape and enrichment heuristics; not every prose mention becomes an edge.
- ADR evaluation is deterministic graph logic, not natural-language understanding of arbitrary prose.
- Collaborative ADR workflows beyond repo Markdown are out of scope for 0.1.0.

## Related

- [Declaring intent](declaring-intent.md)
- [Architecture review](architecture-review.md)
- Demo ADRs under `fixtures/demo-estate/docs/adr/`
