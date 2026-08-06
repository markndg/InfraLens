# Third-party notices

InfraLens is licensed under the [Apache License 2.0](LICENSE).
This file summarises notable third-party dependencies and project-local assets.
It is **not** a complete inventory of every transitive package.

For the authoritative dependency tree and versions, inspect
[`package-lock.json`](package-lock.json) and each workspace `package.json`.

## Notable direct dependencies

| Package | Typical licence | Role |
|---------|-----------------|------|
| `lucide-react` | **ISC** | UI icons in the web workbench |
| `@xyflow/react` | MIT | Interactive graph canvas |
| `js-yaml` | MIT | YAML parsing for manifests / config |
| `react` / `react-dom` | MIT | Web UI |
| `vite` | MIT | Web bundler / dev server |
| `@vitejs/plugin-react` | MIT | React plugin for Vite |
| `vitest` | MIT | Unit and integration tests |
| `@playwright/test` | Apache-2.0 | End-to-end tests |
| `typescript` | Apache-2.0 | Type checking / compilation |
| `tsx` | MIT | TypeScript execution for CLI scripts |

Licence strings above reflect the packages as resolved in this workspace at the time of writing.
Upstream projects may relicense; always verify against the installed package metadata.

## Project-local icons (`@infralens/icons`)

Icons shipped from `@infralens/icons` are **project-local SVG constants** maintained in this
repository (for example stylised provider/resource glyphs used by the canvas). They are not
fetched from remote CDNs at scan time.

Do not assume these SVGs are official trademarks artwork redistributed under a vendor icon pack
licence. If you contribute replacement artwork, document its provenance and licence in the PR.

## Cloud and provider names

Product, service, and trademark names (AWS, Kubernetes, OpenShift, Terraform, and others) remain
the property of their respective owners. InfraLens uses them only to describe interoperability.

## How to audit licences

```bash
# After npm install
npm ls --all
# Or inspect lockfile packages.*.license where present
node -e "const l=require('./package-lock.json'); /* walk packages */"
```

When adding a dependency:

1. Prefer OSI-approved permissive licences compatible with Apache-2.0 distribution.
2. Avoid copying binary assets with unclear provenance into `fixtures/` or `packages/icons`.
3. Update this notice if you introduce a notable new direct dependency or bundled asset.
