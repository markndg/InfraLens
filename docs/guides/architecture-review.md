# Architecture review

InfraLens reviews are **deterministic** and run against the evidence graph. The canvas is a lens; the product answer is whether implementation still matches intent and whether approval remains defensible.

## When to review

- After a material infrastructure or application change
- Before production sign-off or release gates
- When an ADR, assumption, or contract may be invalidated
- Periodically against a retained baseline bundle

## Start from a known estate

```bash
npm run demo
# or
npm run scan -- ./my-project --output review.bundle.json
```

Open the workbench governance / review surfaces. On the Retail SaaS demo you will typically see blocked approval driven by resilience evidence (for example Multi-AZ disabled).

## Staged review (preview UX)

Walk stages in order — the exact labels may evolve, but the flow is stable:

1. **Readiness / landing** — Invalid or at-risk ADRs, broken assumptions, intent drift, blocking findings.
2. **Decision graph** — Capability → decision/ADR → intent → implementing resources → review outcome.
3. **Evidence** — Select a node or finding; confirm adapter, source URI, truth state, and extracted values.
4. **Assumptions & contracts** — Failed assumptions cascade to capability readiness and ADR validity.
5. **Availability / security / recommendations** — Recommendations cite evidence; they are not free-form LLM text.
6. **Simulation (optional)** — Graph-only counterfactuals (for example enable Multi-AZ). No production mutation.
7. **Approval** — Sign-off is bound to the current evidence state; material drift invalidates prior approval.

Guided board script: [demo/walkthrough.md](../demo/walkthrough.md).

## Projections during review

Switch views without changing the underlying graph. Each view answers **one** architectural question (Application, Security, Data, Ownership, Governance, …). See [projection-contracts.md](../architecture/projection-contracts.md).

## Sign-off and waivers

- Findings can **block sign-off**.
- Waivers exist in the product model; durability depends on how you run the API / session in this preview.
- Prefer exporting or retaining the bundle that was approved.

## What review is not

- Not a substitute for human architectural judgment
- Not a board-ready audit certificate without review of evidence
- Not an LLM summariser — absence of an LLM is a trust property

## Related

- [Declaring intent](declaring-intent.md)
- [Writing ADRs](writing-adrs.md)
- [Architecture contracts](architecture-contracts.md)
- [Review and governance (architecture)](../architecture/review-and-governance.md)
