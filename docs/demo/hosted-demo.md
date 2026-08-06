# Hosted / static demo

Goal: ship a **read-only** demonstration that uses only bundled synthetic evidence—no credentials,
no repository upload, no server-side scanner, and no persistent user data.

## Build

```bash
npm install
npm run build:demo
```

`npm run build:demo` writes a static tree to `apps/web/dist-demo/` with `VITE_INFRALENS_DEMO=1`
(in-product hosted banner) and copies the Vite production build. Serve with any static file host:

```bash
npx --yes serve apps/web/dist-demo
```

Optional base path for project Pages sites:

```bash
INFRALENS_DEMO_BASE=/InfraLens/ npm run build:demo
```

## Runtime requirements

| Requirement | Hosted demo |
|-------------|-------------|
| Bundled reference estates / scan bundles | Required |
| User repository upload | Not supported |
| Live AWS / cluster connectors | Disabled |
| Local API / SQLite / Postgres | Not required |
| Secrets or cloud credentials | Forbidden |

All governance and projection interactions should run in the browser against bundled graphs.

## Banner requirements

Any hosted or static demo **must** show a persistent, unmistakable banner, for example:

> Demo estate — this hosted version uses bundled synthetic evidence. Local InfraLens scans remain
> on your machine unless you explicitly configure a connector.

Rules:

- Visible on first paint without dismissing into a forgotten toast
- Not styled as a temporary “success” snackbar
- Wording must not imply the hosted page is scanning the visitor’s private repositories
- Local `npm run demo` may use a lighter indicator, but public hosts should keep the full banner

## GitHub Pages notes

1. **Base path** — If publishing to `https://<user>.github.io/<repo>/`, configure Vite `base` to
   `'/<repo>/'` (or the equivalent `build:demo` flag). Root user/org Pages sites can use `'/'`.
2. **SPA routing** — InfraLens preview UI is primarily a single-page app. If you add path-based
   routes, provide a `404.html` copy of `index.html` or equivalent Pages fallback so deep links work.
3. **No Actions secrets required** — A Pages deploy from `build:demo` artifacts should not need cloud
   credentials. Do not inject scanner credentials into the workflow for the public demo.
4. **Artifact hygiene** — Deploy only static assets and bundled synthetic JSON. Never publish
   `.env`, kubeconfigs, or real inventories.
5. **Do not invent a live URL** — Document the Pages URL only after the workflow or manual publish
   exists. Repository Settings → Pages is owned by maintainers.

Example workflow sketch (illustrative):

```yaml
# .github/workflows/pages.yml — enable only when build:demo is stable
# on: push: branches: [main]
# jobs:
#   build:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - uses: actions/setup-node@v4
#         with: { node-version: '20', cache: npm }
#       - run: npm ci
#       - run: npm run build:demo
#       - uses: actions/upload-pages-artifact@v3
#         with: { path: apps/web/dist }
```

## Verification checklist

- [ ] Banner present and accurate
- [ ] Demo loads without network calls to cloud APIs
- [ ] No credential prompts in the hosted path
- [ ] Projections / governance interactions work offline after first load
- [ ] `npm run verify` still passes for the library/CLI path independently of Pages

## Local alternative

For the richest experience on a workstation:

```bash
npm run demo
```

See [walkthrough.md](walkthrough.md).
