import { assessConfidence } from '@infralens/evidence-model';
import type { ArchitectureReview, EvidenceGraph, ScanBundle } from '@infralens/graph-model';
import { createArchitectureReview, finalizeReview, completeStage } from '../review/engine.js';

export interface ReviewReplayResult {
  review: ArchitectureReview;
  evidenceHash: string;
  generatedAt: string;
  note: string;
  usedOnlyHistoricalEvidence: boolean;
}

/**
 * Replay a review using only the evidence available in a historical scan bundle —
 * never the current live graph.
 */
export function replayHistoricalReview(
  historicalBundle: ScanBundle,
  options?: { playbookId?: string; reviewer?: string },
): ReviewReplayResult {
  const graph = structuredClone(historicalBundle.graph);
  // Strip any reviews that post-date this evidence; keep contemporaneous graph only
  const review = createArchitectureReview(graph, {
    playbookId: options?.playbookId ?? 'architecture-board',
    commercial: graph.scan.edition === 'commercial',
    reviewer: options?.reviewer ?? 'auditor@local',
  });
  let completed = review;
  for (const stage of review.stages) {
    completed = completeStage(completed, stage.id);
  }
  completed = finalizeReview(completed);

  return {
    review: completed,
    evidenceHash: graph.scan.contentHash,
    generatedAt: graph.scan.generatedAt,
    note: `Replayed against evidence from ${graph.scan.generatedAt} (hash ${graph.scan.contentHash}). Current estate evidence was not used.`,
    usedOnlyHistoricalEvidence: true,
  };
}

export function listReplayableBundles(bundles: ScanBundle[]): Array<{
  scanId: string;
  generatedAt: string;
  contentHash: string;
}> {
  return bundles.map((b) => ({
    scanId: b.graph.scan.id,
    generatedAt: b.graph.scan.generatedAt,
    contentHash: b.graph.scan.contentHash,
  }));
}

export function attachReviewRecordNode(graph: EvidenceGraph, review: ArchitectureReview): string {
  const id = `review-record:${review.id}`;
  if (graph.resources.some((r) => r.id === id)) return id;
  graph.resources.push({
    id,
    logicalId: id,
    kind: 'review-record',
    subtype: review.outcome,
    name: review.id,
    displayName: `Review ${review.date.slice(0, 10)} · ${review.outcome}`,
    lifecycle: 'active',
    truthStates: ['historical'],
    instances: [],
    metadata: {
      reviewId: review.id,
      outcome: review.outcome,
      playbookId: review.playbookId,
      persona: review.persona,
      evidenceHash: review.evidenceHash,
    },
    interfaces: [],
    evidence: [],
    findings: [],
    confidence: assessConfidence({
      score: 0.9,
      reasons: ['Persisted architecture review'],
      inferenceMethod: 'review-record',
    }),
    tags: ['review', 'governance'],
    layers: ['governance', 'time', 'evidence'],
  });
  return id;
}
