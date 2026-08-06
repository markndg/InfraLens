import type { EvidenceGraph, GovernanceDashboard, GovernanceMetric } from '@infralens/graph-model';

function metric(
  id: string,
  label: string,
  score: number,
  reasons: string[],
  missing: string[] = [],
): GovernanceMetric {
  const s = Math.max(0, Math.min(1, score));
  const band: GovernanceMetric['band'] =
    s >= 0.8 ? 'low' : s >= 0.6 ? 'medium' : s >= 0.35 ? 'high' : s > 0 ? 'critical' : 'unknown';
  return { id, label, score: s, band, reasons, evidenceIds: [], missing };
}

export function computeGovernanceMetrics(graph: EvidenceGraph): GovernanceMetric[] {
  const intents = graph.resources.filter((r) => r.kind === 'intent');
  const satisfied = intents.filter((i) => i.metadata.satisfaction === 'satisfied').length;
  const decisions = graph.resources.filter((r) => r.kind === 'architectural-decision');
  const stable = decisions.filter((d) =>
    ['accepted', 'satisfied'].includes(String(d.metadata.status ?? '')),
  ).length;
  const assumptions = graph.resources.filter((r) => r.kind === 'assumption');
  const okAssumptions = assumptions.filter((a) => a.metadata.status === 'supported').length;
  const reviews = graph.reviews ?? [];
  const adrs = graph.resources.filter((r) => r.kind === 'adr');
  const invalidAdrs = adrs.filter((a) => a.metadata.satisfaction === 'invalid').length;
  const owned = graph.resources.filter((r) => (r.ownership?.length ?? 0) > 0).length;

  return [
    metric(
      'intent-satisfaction',
      'Intent Satisfaction',
      intents.length ? satisfied / intents.length : 0,
      [`${satisfied}/${intents.length} intents satisfied`],
      intents.filter((i) => i.metadata.satisfaction !== 'satisfied').map((i) => i.displayName),
    ),
    metric(
      'decision-stability',
      'Decision Stability',
      decisions.length ? stable / decisions.length : 0.5,
      [`${stable}/${decisions.length} decisions accepted/satisfied`],
      decisions.filter((d) => String(d.metadata.status).includes('invalid')).map((d) => d.displayName),
    ),
    metric(
      'evidence-freshness',
      'Evidence Freshness',
      graph.completeness.overall,
      [graph.completeness.summary],
      graph.completeness.dimensions.flatMap((d) => d.missing).slice(0, 6),
    ),
    metric(
      'review-coverage',
      'Review Coverage',
      Math.min(1, reviews.length / 3),
      [`${reviews.length} persisted review(s)`],
    ),
    metric(
      'ownership-maturity',
      'Ownership Maturity',
      owned / Math.max(graph.resources.length, 1),
      [`${owned}/${graph.resources.length} resources owned`],
    ),
    metric(
      'assumption-stability',
      'Assumption Stability',
      assumptions.length ? okAssumptions / assumptions.length : 0.5,
      [`${okAssumptions}/${assumptions.length} assumptions supported`],
      assumptions
        .filter((a) => a.metadata.status === 'failed' || a.metadata.status === 'unsupported')
        .map((a) => a.displayName),
    ),
    metric(
      'architecture-debt',
      'Architecture Debt',
      Math.max(0, 1 - (invalidAdrs * 0.2 + graph.findings.filter((f) => f.blocksSignOff).length * 0.1)),
      [`${invalidAdrs} invalid ADR(s)`, `${graph.findings.filter((f) => f.blocksSignOff).length} blockers`],
    ),
    metric(
      'decision-debt',
      'Decision Debt',
      Math.max(
        0,
        1 -
          decisions.filter((d) => String(d.metadata.status).includes('invalid')).length /
            Math.max(decisions.length, 1),
      ),
      ['Invalid or possibly-invalid decisions reduce stability'],
    ),
    metric(
      'review-debt',
      'Review Debt',
      graph.intelligence?.reviewDashboard
        ? graph.intelligence.reviewDashboard.status === 'READY'
          ? 0.85
          : 0.35
        : 0.4,
      [graph.intelligence?.reviewDashboard?.status ?? 'No review dashboard'],
    ),
  ];
}

export function buildGovernanceDashboard(
  graph: EvidenceGraph,
  metrics: GovernanceMetric[],
): GovernanceDashboard {
  const invalidAdrs = graph.resources.filter(
    (r) => r.kind === 'adr' && r.metadata.satisfaction === 'invalid',
  ).length;
  const brokenAssumptions = graph.resources.filter(
    (r) =>
      r.kind === 'assumption' &&
      (r.metadata.status === 'failed' || r.metadata.status === 'unsupported'),
  ).length;
  const intentDrift = graph.resources.filter(
    (r) =>
      r.kind === 'intent' &&
      (r.metadata.satisfaction === 'drifted' || r.metadata.satisfaction === 'violated'),
  ).length;
  const obligations = graph.resources.filter(
    (r) => r.kind === 'obligation' && r.tags.includes('outstanding'),
  ).length;
  const unknownOwnership = graph.resources.filter((r) => r.tags.includes('orphaned-ownership')).length;
  const expiringApprovals = graph.signOffs.filter((s) => {
    if (!s.expiry) return false;
    const days = (new Date(s.expiry).getTime() - Date.now()) / (24 * 3600 * 1000);
    return days >= 0 && days < 45;
  }).length;
  const intentMetric = metrics.find((m) => m.id === 'intent-satisfaction');
  const health = Math.max(
    0,
    Math.min(
      1,
      ((intentMetric?.score ?? 0.5) +
        (metrics.find((m) => m.id === 'assumption-stability')?.score ?? 0.5) +
        graph.completeness.overall) /
        3 -
        invalidAdrs * 0.05 -
        brokenAssumptions * 0.04,
    ),
  );

  const reasons: string[] = [];
  if (invalidAdrs) reasons.push(`${invalidAdrs} invalid ADR(s)`);
  if (brokenAssumptions) reasons.push(`${brokenAssumptions} broken assumption(s)`);
  if (intentDrift) reasons.push(`${intentDrift} intent drift signal(s)`);
  if (obligations) reasons.push(`${obligations} outstanding obligation(s)`);
  if (!reasons.length) reasons.push('No critical governance breaches detected');

  const status: GovernanceDashboard['status'] =
    invalidAdrs || brokenAssumptions >= 3 || intentDrift >= 3
      ? 'NON-COMPLIANT'
      : brokenAssumptions || intentDrift
        ? 'AT RISK'
        : 'GOVERNED';

  const coachNotes = buildCoachNotes(graph, {
    invalidAdrs,
    brokenAssumptions,
    intentDrift,
  });

  return {
    architectureHealth: health,
    currentReviews: (graph.reviews ?? []).filter((r) => r.status === 'in-progress').length ||
      (graph.intelligence?.reviewDashboard ? 1 : 0),
    expiringApprovals,
    invalidAdrs,
    brokenAssumptions,
    intentDrift,
    outstandingObligations: obligations,
    unknownOwnership,
    status,
    reasons,
    coachNotes,
  };
}

function buildCoachNotes(
  graph: EvidenceGraph,
  counts: { invalidAdrs: number; brokenAssumptions: number; intentDrift: number },
): string[] {
  const notes: string[] = [];
  const failed = graph.resources.filter(
    (r) => r.kind === 'assumption' && r.metadata.status === 'failed',
  );
  if (failed.length) {
    notes.push(
      `${failed.length} unresolved assumption(s) now invalidate HA / resilience objectives: ${failed.map((f) => f.displayName).join(', ')}.`,
    );
  }
  const invalid = graph.resources.filter((r) => r.kind === 'adr' && r.metadata.satisfaction === 'invalid');
  for (const adr of invalid.slice(0, 2)) {
    notes.push(`Current architecture violates ${adr.displayName}.`);
  }
  if (counts.intentDrift) {
    notes.push(`Architecture intent has drifted for ${counts.intentDrift} declared objective(s).`);
  }
  if (graph.intelligence?.reviewDashboard?.status === 'NOT READY') {
    notes.push('This review should revisit Security and Availability before Approval.');
  }
  if (!notes.length) notes.push('Governance posture is stable — continue scheduled review cadence.');
  return notes;
}
