import { describe, expect, it } from 'vitest';
import { scanFiles } from '@infralens/scanner';
import type { ProjectFile } from '@infralens/discovery-core';

function syntheticEstate(n: number): ProjectFile[] {
  const docs = Array.from({ length: n }, (_, i) => {
    return `---
apiVersion: apps/v1
kind: Deployment
metadata: { name: svc-${i}, namespace: perf }
spec:
  replicas: 2
  selector: { matchLabels: { app: svc-${i} } }
  template:
    metadata: { labels: { app: svc-${i} } }
    spec:
      containers: [{ name: c, image: "x:${i}" }]
`;
  }).join('\n');
  return [{ path: 'deploy/all.yaml', content: docs }];
}

describe('performance envelopes', () => {
  it('scans 500 synthetic workloads in under 15s', async () => {
    const started = Date.now();
    const bundle = await scanFiles(syntheticEstate(500), { project: 'perf-500', edition: 'oss' });
    const ms = Date.now() - started;
    expect(bundle.graph.resources.length).toBeGreaterThanOrEqual(400);
    expect(ms).toBeLessThan(15_000);
  }, 20_000);
});
