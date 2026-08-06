# Adapter contract

Discovery adapters turn repository files and snapshots into graph fragments. They implement a small, explicit interface in `@infralens/discovery-core`.

Also see the short spec in [architecture/adapters.md](../architecture/adapters.md).

## Interface

```ts
interface DiscoveryAdapter {
  id: string;
  supports(input: DiscoveryInput): Promise<SupportAssessment>;
  discover(input: DiscoveryInput, context: DiscoveryContext): Promise<DiscoveryResult>;
}
```

### `supports`

Return whether the adapter should run, a confidence score, a human reason, and matched file paths. Cheap and side-effect free.

### `discover`

Emit:

- `resources` / `relationships` — typed graph fragments
- `evidence` — one or more records per claim
- `findings` / `unsupported` — optional early signals
- `warnings` / `errors` — non-fatal vs adapter-local failures
- `durationMs`, `redactionSummary`, `metadata`

Use `emptyResult(adapterId, started)` as a baseline.

## Inputs

`DiscoveryInput` includes project name, optional `rootPath`, `files[]` (`path` + `content`), optional `repositoryRevision`, and `snapshots` (`terraformPlan`, `terraformState`, `awsInventory`, `clusterInventory`).

Options may include `includeLive` and `credentialRef` (never raw secrets). Legacy `edition` on options is ignored for gating.

## Conformance expectations

1. **Deterministic IDs** — stable resource and edge identifiers for the same inputs.
2. **Evidence references** — every emitted resource/edge should cite evidence with adapter, source URI, truth state, and confidence.
3. **Secret redaction** — redact before returning values that will persist into bundles.
4. **Isolation** — catch per-file errors; push warnings; do not throw away the whole scan.
5. **Bounds** — respect walk limits; avoid unbounded recursion or giant in-memory expansions.
6. **Honesty** — mark unsupported constructs; prefer `unknown` over fabricated topology.

## Registration

Adapters are registered with the scanner orchestration (`packages/scanner`). Built-ins:

| Adapter ID | Package | Guide |
|------------|---------|-------|
| `terraform` | `@infralens/discovery-terraform` | [terraform.md](terraform.md) |
| `kubernetes` | `@infralens/discovery-kubernetes` | [kubernetes-openshift.md](kubernetes-openshift.md) |
| `openshift` | `@infralens/discovery-openshift` | [kubernetes-openshift.md](kubernetes-openshift.md) |
| `app-config` | `@infralens/discovery-app-config` | [application-config.md](application-config.md) |
| `aws-snapshot` | `@infralens/discovery-aws` | [aws.md](aws.md) |

## Testing

Prefer fixtures under `fixtures/` and assert evidence lineage, not only counts. Run `npm test` and `npm run verify`. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
