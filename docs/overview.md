# InfraLens — Architecture Governance

> InfraLens proves whether the architecture you are running still matches the architecture you intended.

InfraLens scans infrastructure-as-code, deployment manifests, and application configuration;
reconstructs a typed **evidence graph**; projects architecture views from that single graph; and
runs deterministic governance—intents, ADRs, assumptions, contracts, reviews, and evidence-bound
approvals that invalidate when material change occurs.

## Why this positioning

Infrastructure tools tell you what exists. InfraLens tells you:

- **why** it exists (evidence lineage);
- whether it still satisfies **intent**;
- what **changed** and which assumptions failed;
- which decisions or ADRs are **invalid**;
- whether **approval** remains defensible.

The interactive canvas is the lens. The product is the evidence graph and the governance conclusions
derived from it.

## Differentiators

1. **Intent versus reality** — Validate architectural intent, ADRs, assumptions, and contracts against
   declared, rendered, planned, and observed implementation.
2. **Evidence behind every conclusion** — Trace nodes, relationships, findings, recommendations, and
   approvals to source evidence.
3. **Approval that changes when the architecture changes** — Bind sign-off to an evidence state and
   invalidate it on material drift.
4. **One graph, many projections** — Physical, application, capability, data, ownership, security,
   and decision views share one canonical model.
5. **Deterministic review** — Reconstruction, projections, reviews, and recommendations do not
   require an LLM. Absence of an LLM is a trust property, not the entire value proposition.

## Quick start

```bash
npm install
npm run demo
```

Open `http://localhost:5173`. Details: [demo/walkthrough.md](demo/walkthrough.md).

## Documentation map

| Topic | Document |
|-------|----------|
| Capability readiness | [product/capability-matrix.md](product/capability-matrix.md) |
| Preview limits | [product/limitations.md](product/limitations.md) |
| Roadmap | [product/roadmap.md](product/roadmap.md) |
| Editions removed | [product/migration-from-editions.md](product/migration-from-editions.md) |
| System architecture | [architecture/overview.md](architecture/overview.md) |
| Evidence model | [architecture/evidence-model.md](architecture/evidence-model.md) |
| Adapters | [architecture/adapters.md](architecture/adapters.md) |
| Hosted static demo | [demo/hosted-demo.md](demo/hosted-demo.md) |
| Security | [../SECURITY.md](../SECURITY.md), [security/threat-model.md](security/threat-model.md) |

## Status

Public preview **0.1.0** — fully open source, Apache-2.0. See [CHANGELOG.md](../CHANGELOG.md) and
[SUPPORT.md](../SUPPORT.md).
