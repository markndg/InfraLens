# Evidence bundles

A **scan bundle** is the portable unit of InfraLens truth: a validated JSON document containing the evidence graph, findings, drift records, completeness, narrative, and scan metadata (including a content hash).

## Produce a bundle

```bash
npm run scan -- ./fixtures/demo-estate --output fixtures/scans/demo.bundle.json
```

Default output name when omitted: `scan.bundle.json`.

## What’s inside (conceptually)

| Area | Role |
|------|------|
| `graph.resources` / `graph.edges` | Canonical architecture model |
| `graph.evidence` | Source-backed records (adapter, URI, truth state, confidence) |
| `graph.findings` / `graph.drifts` | Policy and reconciliation outcomes |
| `graph.completeness` | Which domains are present, missing, or conflicting |
| `graph.scan` | Project name, adapters, timestamps, content hash, warnings |
| Governance artefacts | Intents, ADRs, assumptions, contracts (as graph nodes/edges) |

Exact schema evolves with the graph model; CLI `inspect` and `validateBundle` are the supported checks. See [architecture/evidence-graph.md](../architecture/evidence-graph.md).

## Inspect and report

```bash
npm run inspect -- scan.bundle.json
npm run report -- scan.bundle.json --format html --output report.html
npm run report -- scan.bundle.json --format json --output scan.copy.json
```

`inspect` summarises findings (including `blocksSignOff`), drifts, unsupported constructs, and narrative without dumping the full graph.

## Compare two evidence states

```bash
npm run compare -- baseline.bundle.json candidate.bundle.json
```

Emits a markdown diff of material graph changes. Use this for review replay and “what changed since last approval?” questions. Historical conclusions need retained contemporaneous bundles.

## Integrity and sharing

- Bundles are **structurally validated** before inspect/report/compare.
- Secret-shaped values should already be redacted; verify before sharing externally.
- Content hash ties conclusions to a specific evidence state — sign-off and invalidation depend on that binding.
- Do not commit real inventories, kubeconfigs, or credentials. Fixtures use synthetic data only.

## Preview caveats

Persistence in the local API / browser path is preview-grade (in-memory / lightweight). Treat the on-disk bundle as the durable artefact for audits and CI. Portfolio and multi-project aggregation are early.

## Related

- [Evidence model](../architecture/evidence-model.md)
- [Graph schema](../architecture/graph-schema.md)
- [Review and governance](../architecture/review-and-governance.md)
