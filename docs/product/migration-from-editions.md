# Migration note: editions removed in 0.1.0

InfraLens **0.1.0** removes the OSS / commercial product split.

## What changed

- There is a single fully open-source product. Every implemented capability is available to every user.
- Edition selectors, upgrade prompts, and “commercial required” messaging are gone.
- `INFRALENS_EDITION` is obsolete and ignored for gating. Legacy values may still appear in old
  bundles or docs; treat them as historical.
- Server and scanner layers no longer deny features based on edition.
- The capability registry now describes **runtime readiness** (credentials, experimental status,
  external tools), not payment or entitlement.

## What to do

| If you previously… | Now… |
|--------------------|------|
| Set `INFRALENS_EDITION=commercial` | Remove it; full capabilities are on by default |
| Set `INFRALENS_EDITION=oss` | Remove it; nothing is withheld for licensing |
| Relied on `INFRALENS_FEATURE_*` as commercial unlocks | Use those flags only as operational kill switches |
| Documented OSS vs commercial matrices | Use [capability-matrix.md](capability-matrix.md) |

## Compatibility

- Existing scan bundles should continue to open. Obsolete edition fields are ignored or deprecated
  rather than rejecting the bundle.
- APIs that once returned `capability_denied` for edition reasons should no longer do so for
  implemented capabilities. Denials remain appropriate for `unavailable-in-build` or explicit
  operational kill switches.

## Retired documents

The following paths were removed or replaced by this note:

- `docs/product/editions.md`
- `docs/architecture/oss-commercial-boundary.md`
- `docs/product/commercial-deployment.md`

For local operation see [local-deployment.md](local-deployment.md).
For honest limits see [limitations.md](limitations.md).
