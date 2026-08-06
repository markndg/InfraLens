import type {
  ArchitectureReview,
  EvidenceGraph,
  ReviewStageId,
  ReviewStageOutcome,
} from '@infralens/graph-model';

export interface ReviewDiffEntry {
  stageId: ReviewStageId;
  title: string;
  previous: ReviewStageOutcome | '—';
  current: ReviewStageOutcome | '—';
  changed: boolean;
  reason: string;
}

export interface ReviewComparison {
  previousId: string;
  currentId: string;
  entries: ReviewDiffEntry[];
  summary: string;
  regressions: string[];
  improvements: string[];
}

export function compareReviews(previous: ArchitectureReview, current: ArchitectureReview): ReviewComparison {
  const stageIds = new Set([
    ...previous.stages.map((s) => s.id),
    ...current.stages.map((s) => s.id),
  ]);
  const rank: Record<ReviewStageOutcome, number> = {
    PASS: 0,
    SKIPPED: 0,
    WARNING: 1,
    UNKNOWN: 2,
    FAIL: 3,
  };
  const entries: ReviewDiffEntry[] = [];
  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const id of stageIds) {
    const prev = previous.stages.find((s) => s.id === id);
    const curr = current.stages.find((s) => s.id === id);
    const previousOutcome = prev?.outcome ?? '—';
    const currentOutcome = curr?.outcome ?? '—';
    const changed = previousOutcome !== currentOutcome;
    let reason = 'No change';
    if (changed) {
      if (prev && curr && rank[curr.outcome] > rank[prev.outcome]) {
        reason = curr.conclusion;
        regressions.push(`${curr.title}: ${prev.outcome} → ${curr.outcome}`);
      } else if (prev && curr) {
        reason = curr.conclusion;
        improvements.push(`${curr.title}: ${prev.outcome} → ${curr.outcome}`);
      } else {
        reason = curr?.conclusion ?? prev?.conclusion ?? 'Stage presence changed';
      }
    }
    entries.push({
      stageId: id,
      title: curr?.title ?? prev?.title ?? id,
      previous: previousOutcome,
      current: currentOutcome,
      changed,
      reason,
    });
  }

  return {
    previousId: previous.id,
    currentId: current.id,
    entries,
    summary: `${improvements.length} improved · ${regressions.length} regressed · ${entries.filter((e) => !e.changed).length} unchanged`,
    regressions,
    improvements,
  };
}

export interface ConcernMemory {
  key: string;
  title: string;
  firstSeen?: string;
  previouslyWaived: boolean;
  improved: boolean;
  regressed: boolean;
  ownershipChanged: boolean;
  appearances: number;
}

export function architecturalMemory(graph: EvidenceGraph): ConcernMemory[] {
  const reviews = graph.reviews ?? [];
  const findings = graph.findings.filter((f) => f.status === 'open' || f.status === 'waived');
  return findings.map((f) => {
    const appearances = reviews.filter((r) => r.stages.some((s) => s.findingIds.includes(f.id))).length;
    const waived = graph.waivers.some((w) => w.findingId === f.id);
    return {
      key: f.id,
      title: f.title,
      firstSeen: f.firstSeen,
      previouslyWaived: waived,
      improved: f.status === 'resolved',
      regressed: f.status === 'open' && appearances > 1,
      ownershipChanged: false,
      appearances: Math.max(appearances, 1),
    };
  });
}

export function reviewPassCount(graph: EvidenceGraph): number {
  return (graph.reviews ?? []).filter(
    (r) => r.outcome === 'Approved' || r.outcome === 'Approved with Waiver',
  ).length;
}
