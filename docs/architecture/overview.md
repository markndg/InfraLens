# Architecture

```mermaid
flowchart TB
  subgraph inputs
    Repo[Repository files]
    Snap[Plan/state/cloud/cluster snapshots]
    Live[Optional read-only connectors]
  end
  Repo --> Scanner
  Snap --> Scanner
  Live --> Scanner
  Scanner[Scanner + discovery adapters]
  Scanner --> Graph[Canonical evidence knowledge graph]
  Graph --> Rec[Reconciliation]
  Graph --> Pol[Policy engine]
  Graph --> Reach[Reachability]
  Graph --> Intel[Architecture intelligence]
  Rec --> Bundle[Scan bundle]
  Pol --> Bundle
  Reach --> Bundle
  Intel --> Bundle
  Bundle --> API[API / local bridge]
  Bundle --> CLI[Scanner CLI]
  API --> UI[Architecture workbench UI]
  CLI --> UI
  Intel --> Proj[Projections: physical application capability data ownership security risk cost time DNA]
```

## Layers

1. **Discovery adapters** — Terraform, Kubernetes, OpenShift, app-config, AWS snapshot
2. **Canonical evidence graph** — resources, edges, evidence, findings, drift, completeness, semantic layers
3. **Architecture intelligence** — capability/data/ownership/trust inference, risk, health, DNA, story, missions, timeline, simulation
4. **Analysis** — reconciliation, policy, reachability, business blast radius
5. **Review engine** — staged reviews, personas, playbooks, recommendations, notebook, approval
6. **Delivery** — hashed scan bundle, CLI, API, review console UI

There is **one** evidence graph. Projections and reviews are derived. The primary UX is the review, not the graph.

The browser never becomes an unrestricted cloud client. Live connectors are credential-reference based, read-only, disabled by default, and snapshot-backed in this release.
