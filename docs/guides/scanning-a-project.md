# Scanning a project

A scan walks a directory tree, runs discovery adapters, builds a canonical **evidence graph**, evaluates policies and governance, and writes a hashed **scan bundle**.

## Basic usage

```bash
npm run scan -- ./my-project --output my-project.bundle.json
```

Summary JSON is printed (resource/edge/finding counts, completeness, content hash). Inspect or report:

```bash
npm run inspect -- my-project.bundle.json
npm run report -- my-project.bundle.json --format html --output report.html
npm run compare -- baseline.bundle.json candidate.bundle.json
```

## What the scanner reads

| Input | How it is discovered |
|-------|----------------------|
| Terraform `.tf` / `.tf.json` | Bounded HCL / JSON extract |
| Terraform plan / state JSON | Via scan options or snapshots (preferred for fidelity) |
| Kubernetes YAML | Manifests in-tree |
| OpenShift Route, DeploymentConfig, etc. | OpenShift-flavoured YAML |
| Rendered Helm / Kustomize | Commit or copy rendered YAML into the tree |
| Application config | `.env`, Spring `application.*`, `package.json`, Compose, common config files |
| ADRs | Markdown under `docs/adr/` or paths matching `ADR-####` |
| AWS / cluster inventory | `.infralens/aws-inventory.json`, `.infralens/cluster-inventory.json` |

Live AWS and cluster discovery are **disabled by default** and require credential references when enabled. Prefer snapshots for CI and reviews in this preview.

## Layout tip

```text
my-project/
  infra/                 # Terraform
  deploy/                # K8s / OpenShift (rendered)
  apps/*/                # package.json, .env, application.yaml
  docs/adr/              # ADR markdown
  .infralens/
    aws-inventory.json   # optional
    cluster-inventory.json
```

Reference shapes: [reference-estates.md](reference-estates.md).

## Completeness and unknowns

Completeness is not a vanity score. Domains can be present, missing, or conflicting. Resources and edges carry **truth states** (`declared`, `rendered`, `planned`, `observed`, `inferred`, …) and confidence. Always open evidence before trusting a visual — especially same-name resources across namespaces or accounts.

## Preview limitations

- Complex Terraform modules/expressions may be incomplete without `terraform show -json` plan/state.
- Unrendered Helm charts and Kustomize overlays are not executed in-process.
- App-config inference misses wiring that never appears in files.
- Large estates: performance is not yet a primary guarantee.

See [product/limitations.md](../product/limitations.md) and [product/capability-matrix.md](../product/capability-matrix.md).

## Security

The scanner processes potentially hostile trees with bounds and redaction. It is not a fully sandboxed multi-tenant executor. Review bundles before sharing. See [architecture/scanner-security.md](../architecture/scanner-security.md).

## Bundle next steps

- [Evidence bundles](evidence-bundles.md)
- [Architecture review](architecture-review.md)
- Load the bundle in the local workbench (demo path or API bridge — [local-deployment.md](../product/local-deployment.md)).
