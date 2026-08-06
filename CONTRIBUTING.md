# Contributing to InfraLens

Thank you for helping improve InfraLens. This repository is an npm workspaces monorepo for an
**Architecture Governance** product built on a canonical evidence graph.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- Node.js **≥ 20**
- npm (comes with Node)

## Setup

```bash
npm install
npm run demo      # one-command local demo (UI at http://localhost:5173)
npm run verify    # types, tests, builds, demo scan / bundle checks
```

Useful related commands:

```bash
npm run demo:scan     # regenerate fixtures/scans/demo.bundle.json
npm run demo:verify   # validate the demo bundle shape
npm run dev           # Vite UI only
npm run dev:api       # optional local API bridge (not required for basic demo)
npm test              # Vitest unit / integration
npm run test:watch
npm run test:e2e      # Playwright (optional; skip with PLAYWRIGHT_SKIP=1)
npm run lint:types    # TypeScript project references
npm run build
```

## Workspace structure

```text
apps/web              React architecture workbench (Vite)
apps/scanner-cli      infralens scan | inspect | compare | report | capabilities
apps/api              Local versioned API / bridge
packages/*            Graph, evidence, discovery adapters, reconciliation,
                      reachability, policy, reporting, architecture intelligence,
                      capability registry, icons, scanner core
fixtures/             Reference estates and scan bundles
policies/             Declarative architecture policies
docs/                 Product and architecture documentation
scripts/              demo / verify helpers
```

There is **one** evidence graph. Projections, reviews, and governance conclusions are derived from it.

## Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Unit and package integration tests (Vitest) |
| `npm run test:perf` | Synthetic large-estate performance smoke |
| `npm run test:e2e` | UI smoke (Playwright) |
| `npm run verify` | Release-shaped gate used by CI |

When changing discovery or governance behaviour, prefer fixtures under `fixtures/` and assertions that
check evidence lineage, not only node/edge counts.

## Extension contracts

### Discovery adapters

Implement `DiscoveryAdapter` (`supports` / `discover`) and register it with the scanner.
See [docs/architecture/adapters.md](docs/architecture/adapters.md).

Expectations:

- Deterministic resource and edge IDs
- Evidence references and truth states on emitted artefacts
- Secret redaction before persistence
- One adapter failure must not abort the whole scan
- Bounded file size, depth, and parse cost

### Projection contracts

Each architecture view answers **one** architectural question with an explicit containment model and
relationship vocabulary. UI contracts live in `apps/web/src/projection/contracts.ts`; graph projection
logic lives in `@infralens/architecture-intelligence`.

When adding or changing a projection:

- Keep eligible canonical relations explicit
- Do not invent relationships that lack evidence
- Preserve unknowns and conflicts rather than forcing a tidy diagram

### Capability registry

`@infralens/edition-capabilities` describes **operational availability**, not licensing.
Use `INFRALENS_FEATURE_*` only as operational kill switches—not as product edition gates.

## No-secret rules

- Never commit real credentials, private keys, kubeconfigs, or cloud tokens.
- Fixtures may use obviously synthetic values (`example.com`, placeholder ARNs, fake account IDs).
- Scanner output must redact secret-shaped keys/values before writing bundles.
- Prefer **credential references** for live connectors; never embed raw secrets in scan options or UI state.
- Do not add fixtures that require network access to private systems.

If you accidentally commit a secret, rotate it immediately and open a security report
(see [SECURITY.md](SECURITY.md))—do not rely on git history rewrite alone.

## Determinism

Prefer stable ordering, content hashes, and fixture-based golden checks. Avoid wall-clock dependent
assertions in unit tests. Bundle producers may record timestamps; tests should tolerate or normalise them.

## Pull requests

1. Keep PRs focused and reviewable.
2. Run `npm run verify` locally before requesting review (or explain what you could not run).
3. Update docs when behaviour or public commands change.
4. Add or extend tests for scanner, projection, governance, and redaction changes.
5. Do not reintroduce edition/entitlement gating or “upgrade to unlock” messaging.
6. Use the PR template checklist.
7. Link related issues; mark breaking schema changes clearly (product version vs bundle schema version).

## Reporting issues

Use GitHub Issues with the bug or feature templates. For vulnerabilities, use private vulnerability
reporting—see [SECURITY.md](SECURITY.md).
