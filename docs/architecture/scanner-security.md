# Scanner security (architecture summary)

InfraLens scans potentially hostile repositories. This page summarises controls for architects and operators. Authoritative detail: [docs/security/scanner-security.md](../security/scanner-security.md) and [docs/security/threat-model.md](../security/threat-model.md). Product policy: [SECURITY.md](../../SECURITY.md).

## Posture

- **Local-first** by default — project contents are not sent to InfraLens-operated clouds in the standard demo / workbench path.
- **Not** a fully sandboxed multi-tenant execution environment. Do not point shared production hosts at untrusted trees without extra isolation.
- Live connectors are **off by default**, credential-reference based, and intended to be **read-only**.

## Threats considered

Path traversal and symlink escape; recursive / zip-bomb style DoS; oversized files and YAML alias bombs; secret leakage into bundles; malicious labels reaching the UI; unsafe subprocess or plugin execution; over-privileged live cloud access; corrupted bundles.

## Controls in 0.1.0

| Control | Behaviour |
|---------|-----------|
| Bounds | File size, depth, and document counts capped during walk |
| Symlinks | Escape and recursion guards |
| Adapter isolation | One adapter failure does not abort the scan |
| Parsing | Terraform uses a bounded HCL extractor; prefer plan/state JSON for evaluation |
| Snapshots | JSON parsed with structural validation |
| Redaction | Secret-shaped keys/values redacted before persistence |
| Bundles | Structural validation and content hashing |
| UI | Labels as text; SVG icons are local constants, not fetched per scan |
| Plugins | No arbitrary provider plugin execution in the current scanner generation |
| Live mode | Requires explicit `includeLive` + `credentialRef`; snapshot import remains the supported path |

## Operational guidance

1. Prefer `.infralens/*-inventory.json` snapshots for CI and demos.
2. Verify bundles before sharing externally — redaction is best-effort; report misses as vulnerabilities.
3. Never embed raw cloud tokens in scan options, fixtures, or UI state.
4. Use GitHub **private vulnerability reporting** for security issues (see [github-settings.md](../product/github-settings.md)).

## Related

- [System overview](system-overview.md)
- [Adapter contract](../adapters/adapter-contract.md)
- [Scanning a project](../guides/scanning-a-project.md)
