# Evidence graph

The evidence graph is InfraLens’s canonical model: typed resources and relationships, each backed by **evidence records**, **truth states**, and **confidence**. Projections and governance conclusions are derived views — not parallel databases.

This page ties together [evidence-model.md](evidence-model.md) and [graph-schema.md](graph-schema.md).

## Why a graph

Infrastructure tools list resources. Architecture governance needs:

- lineage (“why do we believe this exists?”);
- multi-layer truth (declared IaC vs observed inventory);
- semantic overlays (capability, trust zone, ownership) on the same nodes;
- decision artefacts (intents, ADRs, contracts) connected to implementation.

## Core elements

### Resources

`ResourceNode` carries identity (`id`, `logicalId`), `kind` / `subtype`, provider/platform, environment, ownership, lifecycle, truth states, instances, metadata, interfaces, evidence IDs, findings, confidence, tags, and semantic **layers**.

Semantic kinds (inferred deterministically) include `business-capability`, `data-asset`, `team`, `trust-zone`, `platform-system`, plus governance kinds (`intent`, `adr`, `assumption`, `architecture-contract`, …).

### Edges

`ResourceEdge` links source → target with a `relation` kind, direction, optional protocol/ports, effective state, truth states, evidence, and confidence. Relation families span declared dependency, ingress/service wiring, network allow/deny, data/event flows, contains/implements/owned-by/protected-by, drift, and governance links (`realizes-intent`, `satisfies-contract`, …).

### Evidence

Every meaningful claim should reference an `EvidenceRecord`: adapter, source type/URI, location, content hash, revision, observed time, extracted value, redaction flag, confidence, rationale, truth state.

Ask of any node: **Why does InfraLens believe this?**

## Truth states

Typical states: **declared · evaluated · rendered · planned · observed · inferred · assumed · historical** (see evidence-model for the authoritative list used in code).

Rules of thumb:

| State | Meaning |
|-------|---------|
| declared | Present in source (Terraform, manifest, ADR) |
| planned / evaluated | From plan/state evaluation |
| observed | From inventory snapshot or live read-only discovery |
| inferred | Derived by intelligence; keep confidence honest |
| assumed | Explicit architectural assumption |
| unknown / conflict | First-class — do not paper over |

## Completeness

`completeness` explains domain coverage (present / missing / conflicting). It is not an unexplained percentage score for dashboards.

## Intelligence attachment

`EvidenceGraph.intelligence` (story, DNA, health, risk, capability/data/team/trust ids) is **derived**. Regenerating intelligence must not require a second persistence model.

## Bundles

Scans serialise the graph into a hashed **scan bundle** for CLI, API, and UI. See [guides/evidence-bundles.md](../guides/evidence-bundles.md).

## Related

- [Projection contracts](projection-contracts.md)
- [System overview](system-overview.md)
- [Adapter contract](../adapters/adapter-contract.md)
