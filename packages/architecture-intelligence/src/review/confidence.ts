import type { EvidenceGraph, ReviewConfidence } from '@infralens/graph-model';

export function computeReviewConfidence(graph: EvidenceGraph): ReviewConfidence {
  const ownershipScore = graph.intelligence?.health.ownershipMaturity.score ?? 0;
  const evidenceScore = graph.completeness.overall;
  const inferredHeavy =
    graph.resources.filter((r) => r.truthStates.includes('inferred')).length /
    Math.max(graph.resources.length, 1);
  const conflicting = graph.resources.filter(
    (r) =>
      r.confidence.band === 'unknown' ||
      (r.truthStates.includes('declared') &&
        r.truthStates.includes('observed') &&
        graph.drifts.some((d) => d.resourceId === r.id)),
  ).length;

  const dimensions: ReviewConfidence['dimensions'] = [
    {
      label: 'Evidence',
      level: band(evidenceScore),
      reason:
        evidenceScore >= 0.7
          ? `Evidence completeness ${Math.round(evidenceScore * 100)}%`
          : `Evidence completeness ${Math.round(evidenceScore * 100)}% — gaps remain`,
    },
    {
      label: 'Ownership',
      level: ownershipScore < 0.35 ? 'UNKNOWN' : band(ownershipScore),
      reason:
        ownershipScore < 0.35
          ? 'ownership metadata absent or largely inferred'
          : `${Math.round(ownershipScore * 100)}% resources have ownership`,
    },
    {
      label: 'Observation',
      level: inferredHeavy > 0.45 ? 'LOW' : inferredHeavy > 0.25 ? 'MEDIUM' : 'HIGH',
      reason: `${Math.round(inferredHeavy * 100)}% of nodes are inferred`,
    },
    {
      label: 'Consistency',
      level: conflicting ? 'LOW' : 'HIGH',
      reason: conflicting ? `${conflicting} conflicting truth state(s)` : 'No conflicting truth states',
    },
  ];

  const unknownDims = dimensions.filter((d) => d.level === 'UNKNOWN');
  const lowDims = dimensions.filter((d) => d.level === 'LOW');
  let overall: ReviewConfidence['overall'] = 'HIGH';
  if (unknownDims.length || lowDims.length >= 2) overall = unknownDims.length ? 'UNKNOWN' : 'LOW';
  else if (lowDims.length === 1 || dimensions.some((d) => d.level === 'MEDIUM')) overall = 'MEDIUM';

  const exceptions = dimensions
    .filter((d) => d.level === 'UNKNOWN' || d.level === 'LOW')
    .map((d) => `${d.label} ${d.level} because ${d.reason}`);

  return {
    overall,
    summary: exceptions.length
      ? `Confidence ${overall} except ${exceptions.join('; ')}.`
      : `Confidence ${overall} across evidence dimensions.`,
    dimensions,
  };
}

function band(score: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
  if (score <= 0) return 'UNKNOWN';
  if (score >= 0.75) return 'HIGH';
  if (score >= 0.45) return 'MEDIUM';
  return 'LOW';
}
