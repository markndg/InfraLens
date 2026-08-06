import type { ArchitectureReview, ReviewStageId, ReviewStageResult } from '@infralens/graph-model';

export function coachAfterStage(
  review: ArchitectureReview,
  completedStageId: ReviewStageId,
): string {
  const completed = review.stages.find((s) => s.id === completedStageId);
  const remaining = review.stages.filter(
    (s) => !review.completedStageIds.includes(s.id) && s.id !== 'approval',
  );
  const blockers = review.stages.filter(
    (s) => review.completedStageIds.includes(s.id) && (s.outcome === 'FAIL' || s.outcome === 'WARNING'),
  );

  if (completedStageId === 'approval') {
    return `Review complete. Outcome: ${review.outcome}.`;
  }

  if (!remaining.length) {
    return `You have now reviewed ${completed?.title ?? 'this stage'}. Proceed to Approval?`;
  }

  const next = remaining[0]!;
  if (blockers.some((b) => b.outcome === 'FAIL')) {
    const fail = blockers.find((b) => b.outcome === 'FAIL')!;
    return `You have now reviewed ${completed?.title ?? 'this stage'}. The remaining blocker is ${fail.title} (${fail.outcome}). Proceed to ${next.title}?`;
  }

  return `You have now reviewed ${completed?.title ?? 'this stage'}. Next: ${next.title}. Proceed?`;
}

export function decisionSupport(review: ArchitectureReview): {
  canApprove: boolean;
  productionReady: boolean;
  blockers: string[];
  questions: Array<{ question: string; answer: string }>;
} {
  const failStages = review.stages.filter((s) => s.outcome === 'FAIL');
  const approval = review.stages.find((s) => s.id === 'approval');
  const canApprove = failStages.length === 0 && approval?.continueApproval !== false;
  return {
    canApprove,
    productionReady: canApprove && review.dashboard.status !== 'NOT READY',
    blockers: failStages.map((s) => `${s.title}: ${s.conclusion}`),
    questions: [
      {
        question: 'Can this architecture be approved?',
        answer: canApprove
          ? 'Yes — no FAIL stages remain (waivers may still apply).'
          : `No — ${failStages.length} stage(s) failed.`,
      },
      {
        question: 'Is this production-ready?',
        answer: canApprove
          ? 'Conditionally — confirm availability and security recommendations.'
          : 'Not yet — resolve blockers first.',
      },
      {
        question: 'Which risks block release?',
        answer: failStages.length ? failStages.map((s) => s.risk).join(' · ') : 'None blocking',
      },
      {
        question: 'Should public services remain public?',
        answer:
          review.stages.find((s) => s.id === 'security')?.recommendation ??
          'Review security stage for exposure decision',
      },
    ],
  };
}

export function stageHighlightIds(stage: ReviewStageResult): string[] {
  return stage.resourceIds;
}
