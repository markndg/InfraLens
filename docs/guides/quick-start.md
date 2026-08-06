# Quick start

InfraLens **0.1.0** (Architecture Governance public preview) runs locally. Scans stay on your machine unless you explicitly configure a connector.

**Requirements:** Node.js ≥ 20, npm.

## One-command demo

```bash
git clone https://github.com/markndg/InfraLens.git
cd InfraLens
npm install
npm run demo
```

Open [http://localhost:5173](http://localhost:5173). The workbench loads the **Retail SaaS** reference estate (`fixtures/demo-estate`) client-side. The local API is optional for basic exploration.

You should see:

1. Governance readiness with **approval blocked** (production resilience intent not satisfied).
2. Evidence pointing at the database (`multi_az = false` or equivalent).
3. Projections (Application, Security, and others) derived from one evidence graph.
4. A graph-only counterfactual simulation that does not change real infrastructure.

Full script: [demo/walkthrough.md](../demo/walkthrough.md).

## Scan a project

```bash
npm run scan -- path/to/project --output scan.bundle.json
npm run inspect -- scan.bundle.json
npm run report -- scan.bundle.json --format html --output report.html
```

Put Terraform, Kubernetes/OpenShift manifests, application config, and ADRs under the project root. Optional snapshots:

| Path | Purpose |
|------|---------|
| `.infralens/aws-inventory.json` | Observed AWS inventory |
| `.infralens/cluster-inventory.json` | Observed cluster inventory |

See [scanning-a-project.md](scanning-a-project.md).

## Verify the checkout

```bash
npm run verify
```

Runs types, tests, builds, demo scan, and bundle checks (same gate CI uses).

## What this preview is

- Fully open source, **Apache-2.0** — no commercial edition.
- **Deterministic** analysis: reconstruction, projections, reviews, and recommendations do not require an LLM.
- Local-first scanner and workbench; hosted static demos (if you publish one) must use bundled synthetic estates only — see [demo/hosted-demo.md](../demo/hosted-demo.md). Do not invent a live demo URL until Pages is configured.

## Honest limits

Terraform without plan/state is bounded HCL; Helm/Kustomize need rendered YAML; live AWS/cluster connectors need credentials and are off by default. Details: [product/limitations.md](../product/limitations.md).

## Next

| Guide | Topic |
|-------|--------|
| [Scanning a project](scanning-a-project.md) | Inputs, CLI, bundles |
| [Architecture review](architecture-review.md) | Staged review and sign-off |
| [Reference estates](reference-estates.md) | Built-in fixtures |
| [Capability matrix](../product/capability-matrix.md) | Runtime readiness |
