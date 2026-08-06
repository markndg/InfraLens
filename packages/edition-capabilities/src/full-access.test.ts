import { describe, expect, it } from 'vitest';
import { listPersonas, listPlaybooks } from '@infralens/architecture-intelligence';
import { assertCapability, isCapabilityEnabled } from './index.js';

describe('full product access (no edition gating)', () => {
  it('exposes all personas and playbooks by default', () => {
    const personas = listPersonas();
    const playbooks = listPlaybooks();
    expect(personas.length).toBeGreaterThan(0);
    expect(playbooks.length).toBeGreaterThan(0);
    expect(listPersonas({ commercial: false }).length).toBe(personas.length);
    expect(listPlaybooks({ commercial: false }).length).toBe(playbooks.length);
  });

  it('allows mission, timeline, dna, simulation, replay, and sign-off', () => {
    const gated = [
      'missionMode',
      'temporalTimeline',
      'architectureDNA',
      'counterfactualSimulation',
      'reviewReplay',
      'architectSignOff',
    ] as const;

    for (const capability of gated) {
      expect(isCapabilityEnabled(capability)).toBe(true);
      expect(() => assertCapability(capability)).not.toThrow();
    }
  });

  it('does not require an edition label to enable capabilities', () => {
    expect(isCapabilityEnabled('missionMode', undefined)).toBe(true);
    expect(isCapabilityEnabled('architectSignOff', 'oss')).toBe(true);
    expect(isCapabilityEnabled('architectSignOff', 'commercial')).toBe(true);
  });
});
