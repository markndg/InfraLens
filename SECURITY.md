# Security policy

## Local-first posture

InfraLens is designed to run **on your machine** by default.

- Repository scans and evidence-graph analysis execute locally.
- Project contents are not transmitted to InfraLens-operated cloud services by the default demo or
  local workbench path.
- Hosted static demos, if deployed, should use **bundled synthetic estates only**—not user uploads.

Treat any future remote deployment as an explicit operational choice with its own threat model.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x (public preview) | Yes — security fixes and disclosure handling |
| Pre-0.1 internal / unreleased trees | Best effort only |

Preview software may still contain sharp edges. Security reports for 0.1.x are welcome and prioritised
over feature work when impact is clear.

## Scanner threat model (summary)

The scanner reads potentially hostile repositories and manifests. Relevant threats include:

- Path traversal and symlink escape outside the scan root
- Recursive symlink / zip-bomb style denial of service
- Oversized files, deep trees, and YAML alias bombs
- Malicious labels or HTML/SVG content reaching the UI
- Secret leakage into scan bundles or reports
- Unsafe subprocess invocation or plugin execution
- Over-privileged live cloud/cluster access

Controls in the current design include:

- Bounded file size, depth, and document counts
- Symlink escape and recursion guards during tree walk
- Adapter isolation (one adapter failure does not abort the scan)
- Secret redaction before persistence; no raw secrets in bundles by policy
- Bundle structural validation and content hashing
- UI rendering of labels as text; project-local SVG icons (not fetched per scan)
- Live connectors **disabled by default**, credential-reference based, and intended to be **read-only**

Deeper notes: [docs/security/threat-model.md](docs/security/threat-model.md) and
[docs/security/scanner-security.md](docs/security/scanner-security.md).

InfraLens is **not** marketed as a fully sandboxed multi-tenant scanner. Do not point it at untrusted
repositories on shared production hosts without additional isolation.

## Credentials and connectors

- Prefer imported **inventory snapshots** for demos and CI.
- Live AWS / Kubernetes / OpenShift discovery requires an explicit credential **reference** and
  operator-provided credentials outside the bundle.
- Connectors must use least-privilege, **read-only** permissions.
- Never commit credentials into the repository, fixtures, or generated bundles.
- `requires-credentials` in the capability matrix means an operational dependency—not a licence lock.

## Redaction

Discovery adapters and the scanner pipeline should redact secret-shaped keys and values before
writing evidence bundles or reports. If you find a redaction miss (for example a token surviving into
`fixtures/scans/*.json` or HTML reports), treat it as a vulnerability.

## Reporting a vulnerability

Please use **GitHub private vulnerability reporting** for this repository
(Security → Report a vulnerability).

Do **not** open a public issue for active vulnerabilities.
Do **not** email personal maintainer addresses for security reports.

Include:

- Affected version / commit
- Reproduction steps or a minimal fixture
- Impact assessment (secret leak, RCE, path escape, DoS, etc.)
- Any known workarounds

We will acknowledge reports as promptly as a preview-stage volunteer project allows and coordinate
disclosure once a fix or mitigation is available.
