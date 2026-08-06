# Threat model and scanner security

## Threats

Malicious repositories, YAML bombs, path traversal, symlink escape, oversized files, command injection, secret leakage, XSS via labels, credential exposure, unsafe live scopes, corrupted bundles, DoS graphs.

## Controls

- Bounded file size / depth / document count
- Symlink escape prevention and recursion guards
- Adapter isolation (failure does not abort scan)
- Secret redaction before persistence
- No raw secrets in bundles
- Capability enforcement server-side
- Bundle content hashing
- Live connectors disabled by default; credential references only
- Local-first; project contents not transmitted externally by default
