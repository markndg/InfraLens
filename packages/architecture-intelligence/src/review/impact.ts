import type { ArchitectureReview, ReviewStageId, ScanBundle } from '@infralens/graph-model';
import { compareBundles } from '@infralens/reconciliation';
import { evaluateStage } from './stages.js';

export interface ReviewImpact {
  invalidated: ReviewStageId[];
  unaffected: ReviewStageId[];
  reasons: Record<string, string>;
  summary: string;
}

const STAGE_HINTS: Record<ReviewStageId, RegExp> = {
  scope: /resource|capability|environment/i,
  architecture: /service|workload|capability|topology/i,
  security: /route|ingress|public|security|iam|network/i,
  data: /database|bucket|queue|data|s3|rds/i,
  availability: /replica|multi-az|database|workload|availability/i,
  ownership: /owner|team|ownership/i,
  evidence: /evidence|unsupported|completeness/i,
  compliance: /finding|policy|waiver|sign-?off/i,
  recommendations: /./,
  approval: /finding|waiver|sign-?off|ingress|multi-az/i,
};

export function computeReviewImpact(
  previousBundle: ScanBundle,
  currentBundle: ScanBundle,
  baselineReview?: ArchitectureReview,
): ReviewImpact {
  const comparison = compareBundles(previousBundle, currentBundle);
  const changedText = [
    ...comparison.newlyExposed.map((r) => r.displayName),
    `added:${comparison.summary.added}`,
    `removed:${comparison.summary.removed}`,
    `modified:${comparison.summary.modified}`,
  ].join(' ');

  const stageIds = (baselineReview?.stages.map((s) => s.id) ??
    ([
      'scope',
      'architecture',
      'security',
      'data',
      'availability',
      'ownership',
      'evidence',
      'compliance',
      'approval',
    ] as ReviewStageId[]));

  const invalidated: ReviewStageId[] = [];
  const unaffected: ReviewStageId[] = [];
  const reasons: Record<string, string> = {};

  for (const id of stageIds) {
    if (id === 'recommendations') continue;
    const prev = baselineReview ? baselineReview.stages.find((s) => s.id === id) : undefined;
    const next = evaluateStage(currentBundle.graph, id);
    const hint = STAGE_HINTS[id];
    const touched = hint.test(changedText) || comparison.materialChange;
    if (prev && prev.outcome !== next.outcome) {
      invalidated.push(id);
      reasons[id] = `${prev.outcome} → ${next.outcome}: ${next.conclusion}`;
    } else if (touched && (id === 'security' || id === 'availability' || id === 'approval')) {
      invalidated.push(id);
      reasons[id] = next.conclusion;
    } else {
      unaffected.push(id);
    }
  }

  // Public admin route specifically invalidates security + approval
  if (comparison.newlyExposed.length) {
    for (const id of ['security', 'approval'] as ReviewStageId[]) {
      if (!invalidated.includes(id)) invalidated.push(id);
      reasons[id] = `New public exposure: ${comparison.newlyExposed.map((r) => r.displayName).join(', ')}`;
    }
  }

  return {
    invalidated: [...new Set(invalidated)],
    unaffected: unaffected.filter((u) => !invalidated.includes(u)),
    reasons,
    summary: `This change invalidates ${invalidated.length} review stage(s); no effect on ${unaffected.filter((u) => !invalidated.includes(u)).length}.`,
  };
}

export function riskEvolution(
  previous: ArchitectureReview | undefined,
  current: ArchitectureReview,
): Array<{ label: string; state: 'new' | 'resolved' | 'persistent' | 'regressed' | 'improved' }> {
  if (!previous) {
    return current.stages
      .filter((s) => s.outcome === 'FAIL' || s.outcome === 'WARNING')
      .map((s) => ({ label: s.title, state: 'new' as const }));
  }
  return current.stages.map((s) => {
    const p = previous.stages.find((x) => x.id === s.id);
    if (!p) return { label: s.title, state: 'new' as const };
    if (p.outcome === 'FAIL' && s.outcome === 'PASS') return { label: s.title, state: 'improved' as const };
    if (p.outcome === 'PASS' && s.outcome === 'FAIL') return { label: s.title, state: 'regressed' as const };
    if (s.outcome === 'FAIL' || s.outcome === 'WARNING') return { label: s.title, state: 'persistent' as const };
    if (p.outcome !== 'PASS' && s.outcome === 'PASS') return { label: s.title, state: 'resolved' as const };
    return { label: s.title, state: 'persistent' as const };
  });
}
