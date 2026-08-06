import { describe, expect, it } from 'vitest';
import { matchSelector } from './index.js';

describe('kubernetes selectors', () => {
  it('matches labels', () => {
    expect(matchSelector({ app: 'catalog' }, { app: 'catalog', tier: 'api' })).toBe(true);
    expect(matchSelector({ app: 'catalog' }, { app: 'storefront' })).toBe(false);
    expect(matchSelector({}, { app: 'x' })).toBe(false);
  });
});
