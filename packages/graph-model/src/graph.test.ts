import { describe, expect, it } from 'vitest';
import { emptyGraph, toBundle, validateBundle } from './graph.js';
import type { ScanBundle } from './types.js';

function minimalBundle(edition?: 'oss' | 'commercial'): ScanBundle {
  const graph = emptyGraph({ project: 'legacy-test', edition });
  return toBundle(graph);
}

describe('legacy edition bundles', () => {
  it('validates and opens legacy oss and commercial bundles', () => {
    const oss = minimalBundle('oss');
    const commercial = minimalBundle('commercial');
    const modern = minimalBundle();

    expect(oss.graph.scan.edition).toBe('oss');
    expect(commercial.graph.scan.edition).toBe('commercial');
    expect(modern.graph.scan.edition).toBeUndefined();

    expect(validateBundle(oss)).toBe(true);
    expect(validateBundle(commercial)).toBe(true);
    expect(validateBundle(modern)).toBe(true);

    // Round-trip JSON as stored on disk
    expect(validateBundle(JSON.parse(JSON.stringify(oss)))).toBe(true);
    expect(validateBundle(JSON.parse(JSON.stringify(commercial)))).toBe(true);
  });
});
