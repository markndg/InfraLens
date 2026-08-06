import { describe, expect, it } from 'vitest';
import {
  assertCapability,
  capabilityMatrix,
  isCapabilityEnabled,
} from './index.js';

describe('operational capabilities', () => {
  it('enables product capabilities by operational availability', () => {
    expect(isCapabilityEnabled('repositoryScan')).toBe(true);
    expect(isCapabilityEnabled('basicPolicyEngine')).toBe(true);
    expect(isCapabilityEnabled('architectSignOff')).toBe(true);
    expect(isCapabilityEnabled('liveCloudReconciliation')).toBe(true);
    expect(isCapabilityEnabled('effectiveNetworkAnalysis')).toBe(true);
    expect(isCapabilityEnabled('reviewPlaybooks')).toBe(true);
    // Legacy edition args are ignored and do not gate
    expect(isCapabilityEnabled('architectSignOff', 'oss')).toBe(true);
    expect(isCapabilityEnabled('reviewPlaybooks', 'commercial')).toBe(true);
  });

  it('does not deny capabilities at enforcement layers', () => {
    expect(() => assertCapability('architectSignOff')).not.toThrow();
    expect(() => assertCapability('reviewReplay')).not.toThrow();
    expect(() => assertCapability('repositoryScan')).not.toThrow();
    expect(() => assertCapability('architectSignOff', 'oss', 'api')).not.toThrow();
  });

  it('exposes matrix with capabilities enabled', () => {
    const matrix = capabilityMatrix();
    expect(matrix.some((c) => c.id === 'repositoryScan' && c.enabled)).toBe(true);
    expect(matrix.every((c) => c.enabled)).toBe(true);
  });
});
