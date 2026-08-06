# GitHub repository settings (manual)

These settings must be applied by a repository **owner** or admin in the GitHub UI. They are not enforced by files in the tree alone. Repository: [markndg/InfraLens](https://github.com/markndg/InfraLens).

## About

| Field | Suggested value |
|-------|-----------------|
| Description | Evidence-backed architecture governance for Terraform, Kubernetes, OpenShift, AWS and application configuration |
| Website | Leave empty until a real Pages/demo URL exists — do **not** invent a hosted demo link |
| Topics | `architecture-governance`, `architecture-review`, `infrastructure-as-code`, `terraform`, `kubernetes`, `openshift`, `aws`, `cloud-architecture`, `platform-engineering`, `devsecops`, `adr`, `infrastructure-visualization` (align with `package.json` keywords) |

## Social preview

Settings → General → Social preview: upload a static image that represents InfraLens (for example derived from `docs/assets/infralens-hero.svg` exported to PNG). Avoid implying a live multi-tenant SaaS product.

## Features

Enable as appropriate:

- **Issues** — yes
- **Preserve this repository** / sponsorship — optional
- **Discussions** — optional for preview feedback
- **Projects** — optional
- **Wiki** — prefer in-repo `docs/` over Wiki to avoid drift
- **Packages** — only if you publish packages

## Security

| Setting | Action |
|---------|--------|
| **Private vulnerability reporting** | Enable (Settings → Code security) — matches [SECURITY.md](../../SECURITY.md) |
| Dependency graph / Dependabot alerts | Enable |
| Dependabot security updates | Enable when ready to consume PRs |
| Secret scanning | Enable (public repos: GitHub default scanning) |
| Push protection | Enable if available |
| Code scanning | Optional; wire when a CodeQL/workflow is ready |

Do not rely on public issues for active vulnerabilities.

## Actions and Pages

- Confirm Actions are allowed for the workflows under `.github/workflows/` (CI).
- **GitHub Pages**: enable only after `build:demo` (or equivalent) is stable. Document the real URL only once published. Requirements and banner rules: [demo/hosted-demo.md](../demo/hosted-demo.md).
- Pages deploys must not inject cloud credentials or real inventories.

## Branch protection (`main`)

Recommended for the default branch:

- Require pull request before merging
- Require status checks (`CI` / `verify` workflow)
- Restrict force pushes
- Optional: require linear history

## Releases

When cutting `v0.1.0`:

1. Tag matches [CHANGELOG.md](../../CHANGELOG.md) / [release/0.1.0.md](../release/0.1.0.md)
2. Release notes summarise Architecture Governance public preview
3. Attach no credential-bearing artefacts

## Permissions

- Avoid long-lived PATs in Actions; prefer `GITHUB_TOKEN` with least privilege.
- Collaborators: write for maintainers; triage for issue helpers.

## Checklist

- [ ] Description and topics set
- [ ] Social preview image uploaded
- [ ] Private vulnerability reporting on
- [ ] Dependabot / secret scanning configured
- [ ] Branch protection on `main`
- [ ] Pages URL documented only if live
- [ ] SECURITY / SUPPORT / CODE_OF_CONDUCT linked from About if desired
