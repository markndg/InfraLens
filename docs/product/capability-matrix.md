# Capability matrix (public preview 0.1.0)

InfraLens is fully open source. Rows below describe **runtime readiness**, not licensing.

| Status | Meaning |
|--------|---------|
| **Available** | Implemented and usable with local inputs in this preview |
| **Experimental** | Present, but API/UX may change; treat results cautiously |
| **Requires credentials** | Needs operator-provided cloud/cluster credentials (read-only) |
| **Snapshot import** | Works from imported inventory / plan / state files without live access |
| **Requires local tool** | Needs an external CLI or render step outside the in-process scanner |
| **Planned** | Desired; not honest to claim as ready in 0.1.0 |

For machine-readable definitions see `@infralens/edition-capabilities` (`CAPABILITY_REGISTRY`).
Operational kill switches use `INFRALENS_FEATURE_*` env vars—not product editions.

## Discovery inputs

| Input | Status | Notes |
|-------|--------|-------|
| Terraform `.tf` (bounded HCL extract) | Available | Prefer plan/state JSON for stronger evaluation |
| Terraform JSON | Available | |
| Terraform plan / state import | Snapshot import | Via scan snapshots |
| Full module / expression resolution | Planned / partial | Incomplete without `terraform show -json` |
| Kubernetes manifests (YAML) | Available | |
| OpenShift resources | Available | Common resource kinds |
| Ingress / Gateway API | Available | Coverage depends on manifests present |
| Helm charts (unrendered) | Requires local tool | Bring **rendered** output into the scan tree |
| Kustomize (unrendered) | Requires local tool | Bring **rendered** output into the scan tree |
| Rendered Helm / Kustomize YAML | Available | |
| AWS inventory snapshots | Snapshot import | Demo estates ship synthetic inventories |
| Live AWS read-only discovery | Requires credentials | Disabled by default; credential references only |
| Kubernetes / OpenShift inventory snapshots | Snapshot import | |
| Live cluster discovery | Requires credentials | Disabled by default |
| Application configuration (env, URLs, deps) | Available | Adapter-driven; completeness varies |
| Source-derived service dependencies | Experimental | Inferred edges may be incomplete |

## Analysis and evidence

| Capability | Status | Notes |
|------------|--------|-------|
| Local evidence graph | Available | Canonical typed graph + evidence records |
| Truth states & confidence | Available | Declared / rendered / planned / observed / inferred / … |
| Secret redaction | Available | Report misses as vulnerabilities |
| Policy engine (declarative YAML) | Available | Bundled policies under `policies/` |
| Effective network analysis | Available / Experimental | Strength depends on SG / NetworkPolicy evidence |
| IAM analysis | Available / Experimental | Snapshot or discovered IAM relationships |
| Historical drift (bundle compare) | Available | |
| Static HTML / JSON reports | Available | CLI `report` |
| Architecture narrative | Available | Deterministic, evidence-backed |
| Blast radius | Available | |
| Counterfactual simulation | Available | Graph-only; does not mutate infrastructure |
| CI enforcement gate | Experimental | Surface may change |

## Projections and intelligence

| Capability | Status | Notes |
|------------|--------|-------|
| Architecture projections | Available | One graph → many views; see projection contracts |
| Capability inference | Available | Deterministic |
| Mission mode | Available | |
| Architecture DNA | Available | |
| Temporal timeline | Available | Needs multiple bundles / history |
| Architect personas | Available | |
| Review playbooks | Available | |

## Governance

| Capability | Status | Notes |
|------------|--------|-------|
| Architecture governance dashboard | Available | Single-project focus is strongest |
| ADR parse & evaluation | Available | Markdown ADRs in-repo |
| Intent validation | Available | |
| Assumption engine | Available | |
| Contract / obligation engine | Available | |
| Decision graph | Available | |
| Architecture review + notebook | Available | Deterministic stages |
| Waiver workflow | Available | |
| Architect sign-off + invalidation | Available | Bound to evidence state |
| Review replay | Available | Historical evidence only |
| Collaborative reviews / comments | Available / Experimental | Local persistence model is preview-grade |
| Multi-project / portfolio governance | Experimental | Early aggregation |
| Organisational graph | Experimental | |
| Governance analytics | Experimental | |

## Explicitly not a licence matrix

There is no OSS vs commercial column. If something is unavailable, the cause is missing evidence,
credentials, external tools, experimental status, or an honest **Planned** gap—not an edition upgrade.
