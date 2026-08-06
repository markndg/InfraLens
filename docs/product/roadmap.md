# Roadmap

InfraLens is fully open source. This roadmap is organised by **product confidence**, not by a
future paid edition. Dates are intentionally omitted; order reflects preview priorities.

## Public preview priorities

Improve trust in what 0.1.0 already claims:

1. **Parser robustness** — safer YAML/HCL bounds, clearer unknowns, fewer false certainties
2. **Fixture diversity** — structurally distinct reference estates and generality tests
3. **Evidence integrity** — redaction coverage, deterministic bundles, lineage UX
4. **Installation & demo** — one-command demo reliability, verify pipeline, CI signal
5. **Performance** — large-graph layout and projection costs
6. **Security** — scanner threat-model regressions and honest disclosure process
7. **Documentation** — capability matrix accuracy, walkthroughs, adapter guides

## Near-term adapters and inputs

Only where the evidence model is clear:

- Stronger Terraform evaluation via sandboxed / pinned `terraform show -json` workflows
- Better rendered Helm/Kustomize ingestion conventions (still external render)
- Deeper Kubernetes Gateway API / NetworkPolicy evidence
- Read-only AWS / cluster connectors behind credential references (optional, off by default)
- Richer application-config and service dependency extraction with explicit confidence bands

## Scale and deployment

- Large estate performance budgets and progressive projection
- Persistent local projects (beyond ephemeral demo sessions)
- Optional self-hosted API deployment with explicit operator security guidance
- Multi-project views that remain evidence-honest (no fake cross-repo edges)

## Explicitly not promised yet

Tempting, but **not** committed for a near release:

- Managed SaaS multi-tenant InfraLens operated by the project
- LLM-authored architecture reviews or explanations as a core path
- Perfect IAM / network simulation of every cloud feature
- Automatic remediation that mutates production infrastructure
- Guaranteed compliance certifications out of the box

If you need one of these, open a feature issue describing the **architectural question** and the
evidence you can supply—not a licence tier request.

## How to influence the roadmap

- File issues with fixtures
- Improve adapters and projection contracts with tests
- Harden security and redaction coverage

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and [capability-matrix.md](capability-matrix.md).
