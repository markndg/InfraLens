# InfraLens v1.2

Evidence-backed infrastructure architecture platform.

InfraLens shows what an estate **declares**, what it **intends** to build, what is **actually deployed**, how components can communicate, where every conclusion came from, what has **drifted**, what is **uncertain**, which architecture rules are violated, and exactly what an architect is being asked to approve.

The interactive canvas is the lens. The product is the **evidence graph** beneath it.

## Two-minute start

```bash
npm install
npm run demo:scan
npm run dev
```

Open the UI, explore the Retail SaaS reference estate, switch Architecture views, ask whether the internet can reach the database, then open **Drift / Sign-off**.

```bash
# Commercial APIs / sign-off enforcement
INFRALENS_EDITION=commercial npm run dev:api

# Scanner CLI
npm run scan -- fixtures/demo-estate --output fixtures/scans/demo.bundle.json
npm run report -- fixtures/scans/demo.bundle.json --format html --output fixtures/scans/report.html
```

## Editions

| Mode | How |
|------|-----|
| OSS | `INFRALENS_EDITION=oss` (default) |
| Commercial | `INFRALENS_EDITION=commercial` |
| Feature override | `INFRALENS_FEATURE_ARCHITECT_SIGN_OFF=true` |

Capabilities are enforced in the scanner and API, not only hidden in the UI. See `docs/product/editions.md`.

## Workspace

```text
apps/web            React topology + assurance UI
apps/scanner-cli    infralens scan|inspect|compare|report
apps/api            Versioned local API (SQLite-shaped store)
packages/*          Graph, evidence, discovery, reconciliation,
                    reachability, policy, reporting, capabilities
fixtures/demo-estate
docs/
```

## Commands

```bash
npm install
npm run build
npm test
npm run test:e2e
npm run demo:scan
npm run dev
INFRALENS_EDITION=commercial npm run dev
INFRALENS_EDITION=commercial npm run dev:api
```

## Documentation

- [Product overview](docs/product/overview.md)
- [Architecture](docs/architecture/overview.md)
- [Evidence model](docs/architecture/evidence-model.md)
- [Capability matrix](docs/product/editions.md)
- [Demonstration guide](docs/demonstration/walkthrough.md)
- [Threat model](docs/security/threat-model.md)
- [Roadmap](docs/product/roadmap.md)
