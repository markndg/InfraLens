import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanPath } from '@infralens/scanner';
import {
  architecturalMemory,
  compareReviews,
  completeStage,
  computeReviewConfidence,
  computeReviewImpact,
  createArchitectureReview,
  decisionSupport,
  finalizeReview,
  generateRecommendations,
  listPersonas,
  listPlaybooks,
  persistReview,
  runFullReview,
  smartStageOrder,
} from '../index.js';

const demoRoot = path.resolve('fixtures/demo-estate');

async function scanDemo() {
  return scanPath(demoRoot, {
    project: 'Retail SaaS reference estate',
    edition: 'commercial',
    policyDir: path.resolve('policies/default'),
  });
}

describe('architecture review engine v1.4', () => {
  it('builds a deterministic review with stage outcomes', async () => {
    const { graph } = await scanDemo();
    const review = createArchitectureReview(graph, {
      playbookId: 'architecture-board',
      persona: 'enterprise',
      commercial: true,
    });
    expect(review.version).toBe('1.4');
    expect(review.stages.length).toBeGreaterThan(5);
    expect(review.stages.every((s) => ['PASS', 'WARNING', 'FAIL', 'UNKNOWN', 'SKIPPED'].includes(s.outcome))).toBe(
      true,
    );
    expect(review.dashboard.status).toMatch(/READY|NOT READY/);
    expect(review.estimatedMinutes).toBeGreaterThan(5);
    expect(review.notebook.length).toBe(review.stages.length);
  });

  it('generates multi-option recommendations for significant findings', async () => {
    const { graph } = await scanDemo();
    const recs = generateRecommendations(graph);
    expect(recs.length).toBeGreaterThan(0);
    const withOptions = recs.find((r) => r.options.length >= 2);
    expect(withOptions).toBeTruthy();
    expect(withOptions!.why).toMatch(/Why this matters/i);
    expect(withOptions!.options.every((o) => o.pros.length && o.confidence)).toBe(true);
  });

  it('persists review history and compares reviews', async () => {
    const { graph } = await scanDemo();
    const first = runFullReview(graph, { playbookId: 'architecture-board', commercial: true });
    expect(graph.reviews?.some((r) => r.id === first.id)).toBe(true);
    const second = createArchitectureReview(graph, { playbookId: 'architecture-board', commercial: true });
    const completed = finalizeReview(completeStage(second, second.stages[0]!.id));
    persistReview(graph, completed);
    const diff = compareReviews(first, completed);
    expect(diff.summary).toMatch(/improved|regressed|unchanged/i);
    expect(architecturalMemory(graph).length).toBeGreaterThan(0);
  });

  it('computes human-readable review confidence', async () => {
    const { graph } = await scanDemo();
    const confidence = computeReviewConfidence(graph);
    expect(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']).toContain(confidence.overall);
    expect(confidence.summary.length).toBeGreaterThan(10);
    expect(confidence.dimensions.some((d) => d.label === 'Ownership')).toBe(true);
  });

  it('supports architect personas and OSS playbook boundary', async () => {
    const ossPersonas = listPersonas({ commercial: false });
    expect(ossPersonas.every((p) => !p.commercialPack || p.id === 'enterprise')).toBe(true);
    expect(listPlaybooks({ commercial: false }).every((p) => !p.commercial)).toBe(true);
    const { graph } = await scanDemo();
    const review = createArchitectureReview(graph, {
      playbookId: 'pci',
      persona: 'security',
      commercial: false,
    });
    // OSS falls back from commercial playbook
    expect(review.playbookId).toBe('architecture-board');
  });

  it('orders stages smartly and provides decision support', async () => {
    const { graph } = await scanDemo();
    const ordered = smartStageOrder(graph, [
      'scope',
      'architecture',
      'availability',
      'security',
      'recommendations',
      'approval',
    ]);
    expect(ordered.at(-1)).toBe('approval');
    expect(ordered.at(-2)).toBe('recommendations');
    const review = createArchitectureReview(graph, { commercial: true });
    const support = decisionSupport(review);
    expect(support.questions.length).toBeGreaterThan(2);
    expect(typeof support.canApprove).toBe('boolean');
  });

  it('reports review impact between scan bundles', async () => {
    const current = await scanDemo();
    const baseline = structuredClone(current);
    const admin = baseline.graph.resources.find((r) => r.name === 'admin' && r.kind === 'route');
    if (admin) {
      baseline.graph.resources = baseline.graph.resources.filter((r) => r.id !== admin.id);
      baseline.graph.edges = baseline.graph.edges.filter((e) => e.source !== admin.id && e.target !== admin.id);
    }
    const prior = runFullReview(baseline.graph, { commercial: true });
    const impact = computeReviewImpact(baseline, current, prior);
    expect(impact.invalidated.length).toBeGreaterThan(0);
    expect(impact.summary).toMatch(/invalidates/i);
  });
});
