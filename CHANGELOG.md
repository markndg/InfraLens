# Changelog

All notable changes to InfraLens are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- GitHub Pages workflow once `build:demo` deploy path is confirmed for the org
- Parser robustness and large-graph performance

## [0.1.0] - 2026-08-06

### Architecture Governance Public Preview

First public open-source preview of InfraLens as an **Architecture Governance** product:
InfraLens proves whether the architecture you are running still matches the architecture you intended.

### Added

- Full open-source product surface: every implemented capability is available to every user.
  OSS/commercial edition gates, entitlement checks, upgrade prompts, and edition selectors are removed.
  The capability registry now describes **runtime readiness** (`available`, `experimental`,
  `requires-credentials`, `requires-external-tool`, `unavailable-in-build`), not licensing.
- Canonical **evidence graph** with truth states (declared, rendered, planned, observed, inferred,
  assumed, historical), confidence, and source-backed evidence on resources, edges, and findings.
- **Architecture projections** derived from one graph (physical, application, capability, data,
  ownership, security, risk, decision, and related views) with explicit projection contracts.
- **Architecture governance**: intents, ADRs, assumptions, contracts/obligations, decision graph,
  review engine, sign-off with evidence binding, and approval invalidation on material change.
- Deterministic architecture intelligence (narrative, blast radius, simulation, timeline, DNA)
  without requiring an LLM for analysis, review, or recommendations.
- Local scanner CLI (`scan`, `inspect`, `compare`, `report`, `capabilities`), local API bridge,
  and React workbench UI.
- One-command local demo: `npm run demo` (Node ≥ 20, optional `demo:scan`, Vite UI at
  `http://localhost:5173`; client-side demo load does not require the API).
- Four reference estates (Retail SaaS, Serverless AWS, Kubernetes Microservices, Legacy Hybrid)
  with golden expected stats, generality campaign tests, and pre-generated scan bundles.
- Hosted-demo static build: `npm run build:demo` → `apps/web/dist-demo` (bundled evidence only).
- Demo storyboard / capture scripts: `npm run demo:record`, `npm run demo:capture`.
- Verification pipeline: `npm run verify` (types, tests, builds, demo scan / bundle checks).
- Repository hygiene: Apache-2.0 license, security/support/conduct docs, issue and PR templates,
  CI workflow, and product documentation for capability matrix, limitations, and roadmap.

### Changed

- Public product version is **0.1.0** (first public preview). Internal schema / model version
  numbers remain independent of the product release number.
- Documentation repositioned around Architecture Governance; commercial edition docs removed
  in favour of a short migration note.

### Known preview limitations

- Live cloud and cluster connectors require credentials or imported inventory snapshots; they are
  disabled by default and remain read-only when enabled.
- Terraform evaluation is bounded HCL/JSON parsing unless a plan/state snapshot (or external
  `terraform show -json`) is provided; full module/expression resolution is incomplete.
- Helm/Kustomize are supported as **rendered** manifests, not as live render pipelines in-process.
- Portfolio / multi-project and organisational graph features are early; persistence is local /
  in-memory oriented rather than a hardened multi-tenant server.
- CI enforcement and some connectors are marked experimental.
- Preview quality bar: expect sharp edges in UX polish, large estates, and incomplete evidence domains.
  See [docs/product/limitations.md](docs/product/limitations.md).

[Unreleased]: https://github.com/markndg/InfraLens/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/markndg/InfraLens/releases/tag/v0.1.0
