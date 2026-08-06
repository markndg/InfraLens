import { describe, expect, it } from 'vitest';
import { assessConfidence, createEvidence, redactValue } from './index.js';

describe('evidence model', () => {
  it('creates immutable evidence records', () => {
    const ev = createEvidence({
      adapter: 'terraform',
      sourceType: 'source-file',
      sourceUri: 'main.tf',
      confidence: 0.9,
      truthState: 'declared',
    });
    expect(ev.id).toContain('terraform');
    expect(ev.redacted).toBe(false);
  });

  it('redacts secrets', () => {
    expect(redactValue('DB_PASSWORD', 'hunter2').value).toBe('[REDACTED]');
    expect(redactValue('URL', 'postgres://x?password=secret').redacted).toBe(true);
  });

  it('bands confidence', () => {
    expect(assessConfidence({ score: 0.9 }).band).toBe('high');
    expect(assessConfidence({ score: 0.5 }).band).toBe('low');
  });
});
