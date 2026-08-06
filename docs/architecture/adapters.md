# Adapter specification

```ts
interface DiscoveryAdapter {
  id: string;
  supports(input: DiscoveryInput): Promise<SupportAssessment>;
  discover(input: DiscoveryInput, context: DiscoveryContext): Promise<DiscoveryResult>;
}
```

Results include resources, relationships, evidence, unsupported constructs, warnings, errors, timing and redaction summary.

One adapter failing must not invalidate the scan. Conformance expectations: deterministic IDs, evidence references, secret redaction, malformed input isolation, bounded resource use.
