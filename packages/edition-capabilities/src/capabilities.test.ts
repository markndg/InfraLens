import { describe, expect, it } from 'vitest';
import {
  assertCapability,
  CapabilityDeniedError,
  capabilityMatrix,
  isCapabilityEnabled,
} from './index.js';

describe('edition capabilities', () => {
  it('enables OSS essentials', () => {
    expect(isCapabilityEnabled('repositoryScan', 'oss')).toBe(true);
    expect(isCapabilityEnabled('basicPolicyEngine', 'oss')).toBe(true);
    expect(isCapabilityEnabled('architectSignOff', 'oss')).toBe(false);
  });

  it('enables commercial sign-off', () => {
    expect(isCapabilityEnabled('architectSignOff', 'commercial')).toBe(true);
    expect(isCapabilityEnabled('liveCloudReconciliation', 'commercial')).toBe(true);
  });

  it('enforces server-side denial', () => {
    expect(() => assertCapability('architectSignOff', 'oss', 'api')).toThrow(CapabilityDeniedError);
  });

  it('exposes matrix', () => {
    const matrix = capabilityMatrix();
    expect(matrix.some((c) => c.id === 'repositoryScan' && c.oss && c.commercial)).toBe(true);
  });
});
