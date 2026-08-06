# Extension guide

1. Implement `DiscoveryAdapter` and register it in `@infralens/scanner`.
2. Emit resources/edges with evidence and truth states.
3. Add policies as YAML under `policies/`.
4. Gate commercial behaviour with `assertCapability`.
5. Add conformance tests under `packages/*/src/*.test.ts`.
