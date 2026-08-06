# Preview limitations (0.1.0)

InfraLens 0.1.0 is a **public preview**. The architecture governance core is real and usable locally;
the following boundaries are intentional honesty, not fine print.

## Product maturity

- Expect UX polish gaps, dense first-run graphs, and evolving copy.
- Persistence is oriented around local demos and an in-memory / lightweight API bridge—not a
  hardened multi-tenant control plane.
- Performance on very large estates is not yet a primary guarantee; use `npm run test:perf` as a smoke signal only.

## Discovery completeness

- Terraform without plan/state snapshots uses a **bounded** HCL extractor. Complex modules,
  dynamic blocks, and expression evaluation may be incomplete or marked unknown.
- Helm and Kustomize are not executed inside the scanner; supply **rendered** manifests.
- Application-config inference can miss implicit runtime wiring that never appears in files.
- Same-name resources across namespaces/accounts need careful evidence; always check truth state
  and source URIs before trusting a visual.

## Live connectors

- Live AWS and cluster discovery are **off by default**.
- When enabled they require credential references and must remain **read-only**.
- Snapshot import is the supported path for CI, demos, and most reviews in this preview.

## Governance caveats

- Sign-off and waivers are evidence-bound in the product model; storage durability depends on how
  you run the API / browser session in this preview.
- Portfolio, organisational graph, and cross-repo analytics exist early—treat conclusions as
  directional unless fixtures prove them for your estate shape.
- Review replay requires retained historical bundles with sufficient contemporaneous evidence.

## Security posture

- The scanner processes potentially hostile trees with bounds and redaction, but it is **not** a
  fully sandboxed multi-tenant execution environment.
- Do not assume every secret pattern is redacted; verify bundles before sharing.
- See [SECURITY.md](../../SECURITY.md) and [docs/security/threat-model.md](../security/threat-model.md).

## What we will not claim yet

- Full cloud inventory parity with vendor consoles
- Perfect reachability across every mesh / shared-VPC pattern
- Guaranteed board-ready reports without human review
- Production SLA or hosted multi-tenant security certification

## Related docs

- [Capability matrix](capability-matrix.md)
- [Roadmap](roadmap.md)
- [Migration from editions](migration-from-editions.md)
