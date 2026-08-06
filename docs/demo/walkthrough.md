# Demonstration walkthrough — InfraLens 0.1.0

Estate: `fixtures/demo-estate` (Retail SaaS reference) with ADRs under `docs/adr/`.

InfraLens is an **Architecture Governance** product. The canvas and evidence graph are infrastructure;
governance answers whether implementation still matches intent.

## One-command start

```bash
npm install
npm run demo
```

Open **http://localhost:5173**. The web app loads the demo estate client-side; the API is optional
for this walkthrough.

To regenerate the on-disk bundle used by CLI/report flows:

```bash
npm run demo:scan
npm run demo:verify
```

## Guided board script (~5 minutes)

1. **Landing / Governance** — Note architecture health: invalid or at-risk ADRs, broken assumptions,
   intent drift, and whether approval is blocked.
2. **Open the decision graph** — Follow Capability → Decision (for example PostgreSQL) → Intent
   (high availability) → Implementation (RDS / database resource) → Review outcome.
3. **Inspect evidence** — Select the database. Confirm Multi-AZ (or equivalent) evidence shows the
   resilience intent is not satisfied. Expand source evidence (Terraform / inventory).
4. **Assumptions** — Locate the failed assumption (for example “database is resilient”) and see
   cascading impact on capability readiness and ADR validity.
5. **Start architecture review** — Walk Availability / Security / Recommendations / Approval stages.
   Recommendations should cite evidence, not free-form speculation.
6. **Simulate** — Run a graph-only counterfactual (enable Multi-AZ / restore the assumption). Confirm
   findings and readiness change **without** mutating real infrastructure.
7. **Sign-off** — Observe that approval remains blocked until evidence supports the intent, and that
   sign-off is bound to the current evidence state.
8. **Projections** — Switch Application, Security, Data, and Ownership views. Each view should answer
   one architectural question from the same graph.
9. **Evidence explorer** — Trace a finding or edge back to adapter, source URI, and truth state.

## What this demo proves

| Claim | Where you see it |
|-------|------------------|
| Intent vs reality | Failed HA intent vs database evidence |
| Evidence lineage | Node inspector / evidence records |
| Approval invalidation | Sign-off blocked or revoked on material gap |
| Deterministic governance | Review stages reproduce from the graph |
| Full open-source surface | No edition selector; simulation, timeline, sign-off available |

## Optional API path

```bash
npm run dev:api   # local bridge if you need persistence APIs
```

Basic demo exploration does not require it.

## Hosted / static demo

See [hosted-demo.md](hosted-demo.md) for `build:demo`, banner requirements, and GitHub Pages notes.

## Related

- [docs/overview.md](../overview.md)
- [docs/product/limitations.md](../product/limitations.md)
- [docs/product/capability-matrix.md](../product/capability-matrix.md)
