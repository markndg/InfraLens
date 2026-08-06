import type { EvidenceGraph, ExplainedScore, RiskProfile } from '@infralens/graph-model';

function score(
  id: string,
  label: string,
  value: number,
  reasons: string[],
  evidenceIds: string[] = [],
  missing: string[] = [],
): ExplainedScore {
  const score = Math.max(0, Math.min(1, value));
  const band =
    score >= 0.75 ? 'critical' : score >= 0.55 ? 'high' : score >= 0.35 ? 'medium' : score > 0 ? 'low' : 'unknown';
  return { id, label, score, band, reasons, evidenceIds, missing };
}

export function computeRiskProfile(graph: EvidenceGraph): RiskProfile {
  const highFindings = graph.findings.filter((f) => f.severity === 'high' || f.severity === 'critical');
  const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');
  const singleReplica = graph.resources.filter(
    (r) => r.kind === 'workload' && Number(r.metadata.replicas ?? 2) <= 1,
  );
  const singleAz = graph.resources.filter(
    (r) => r.kind === 'relational-database' && (r.metadata.multi_az === false || r.metadata.multiAz === false),
  );
  const publicIngress = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
  const external = graph.resources.filter((r) => r.provider === 'external' || r.kind === 'external-system');
  const orphans = graph.resources.filter((r) => r.tags.includes('orphaned-ownership'));
  const drifts = graph.drifts.filter((d) => d.severity === 'high' || d.severity === 'critical');
  const completeness = graph.completeness.overall;

  return {
    operational: score(
      'risk-operational',
      'Operational Risk',
      Math.min(1, singleReplica.length * 0.15 + drifts.length * 0.2 + highFindings.length * 0.1),
      [
        `${singleReplica.length} single-replica workload(s)`,
        `${drifts.length} high/critical drift record(s)`,
        `${highFindings.length} high/critical finding(s)`,
      ],
      highFindings.flatMap((f) => f.evidence).slice(0, 10),
    ),
    security: score(
      'risk-security',
      'Security Risk',
      Math.min(1, publicIngress.length * 0.12 + external.length * 0.1 + drifts.filter((d) => /network|identity/i.test(d.category)).length * 0.25),
      [
        `${publicIngress.length} public ingress point(s)`,
        `${external.length} external dependenc${external.length === 1 ? 'y' : 'ies'}`,
        'Security-sensitive drift weighted higher',
      ],
      publicIngress.flatMap((r) => r.evidence).slice(0, 10),
    ),
    availability: score(
      'risk-availability',
      'Availability Risk',
      Math.min(1, singleAz.length * 0.45 + singleReplica.length * 0.2),
      [
        `${singleAz.length} non multi-AZ database(s)`,
        `${singleReplica.length} single-replica workload(s)`,
      ],
      singleAz.flatMap((r) => r.evidence),
    ),
    business: score(
      'risk-business',
      'Business Risk',
      Math.min(1, blocking.length * 0.25 + external.filter((e) => /payment/i.test(e.name)).length * 0.3),
      [
        `${blocking.length} sign-off blocking finding(s)`,
        `${external.filter((e) => /payment/i.test(e.name)).length} payment dependency path(s) leave trust boundaries`,
      ],
      blocking.flatMap((f) => f.evidence).slice(0, 10),
    ),
    evidence: score(
      'risk-evidence',
      'Evidence Risk',
      Math.max(0, 1 - completeness),
      [`Evidence completeness ${(completeness * 100).toFixed(0)}%`, graph.completeness.summary],
      [],
      graph.completeness.dimensions.flatMap((d) => d.missing).slice(0, 8),
    ),
    ownership: score(
      'risk-ownership',
      'Ownership Risk',
      Math.min(1, orphans.length / Math.max(graph.resources.length, 1)),
      [`${orphans.length} resource(s) without ownership`],
      orphans.flatMap((r) => r.evidence).slice(0, 10),
      orphans.length ? ['explicit ownership annotations'] : [],
    ),
  };
}
