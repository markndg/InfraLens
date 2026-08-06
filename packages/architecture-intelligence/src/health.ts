import type { ArchitectureHealth, EvidenceGraph, ExplainedScore } from '@infralens/graph-model';

function explained(
  id: string,
  label: string,
  value: number,
  reasons: string[],
  missing: string[] = [],
): ExplainedScore {
  const score = Math.max(0, Math.min(1, value));
  const band =
    score >= 0.8 ? 'low' : score >= 0.6 ? 'medium' : score >= 0.4 ? 'high' : 'critical';
  // For health, high score = good, so invert band naming for display: use low/medium/high as maturity bands
  const maturityBand = score >= 0.8 ? 'low' : score >= 0.6 ? 'medium' : score >= 0.35 ? 'high' : 'critical';
  void band;
  return {
    id,
    label,
    score,
    band: maturityBand,
    reasons,
    evidenceIds: [],
    missing,
  };
}

export function computeArchitectureHealth(graph: EvidenceGraph): ArchitectureHealth {
  const caps = graph.resources.filter((r) => r.kind === 'business-capability');
  const owned = graph.resources.filter((r) => (r.ownership?.length ?? 0) > 0);
  const observed = graph.resources.filter((r) => r.truthStates.includes('observed'));
  const multiAzOk = graph.resources.filter(
    (r) => r.kind === 'relational-database' && r.metadata.multi_az !== false && r.metadata.multiAz !== false,
  );
  const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
  const withLimits = graph.resources.filter(
    (r) => r.kind === 'workload' && r.metadata.resources != null,
  );
  const workloads = graph.resources.filter((r) => r.kind === 'workload');
  const publicRoutes = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
  const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');

  return {
    architectureCompleteness: explained(
      'health-architecture',
      'Architecture completeness',
      Math.min(1, 0.35 + caps.length * 0.08 + graph.completeness.overall * 0.5),
      [`${caps.length} inferred capabilities`, graph.completeness.summary],
      graph.unsupported.map((u) => u.construct).slice(0, 5),
    ),
    ownershipMaturity: explained(
      'health-ownership',
      'Ownership maturity',
      owned.length / Math.max(graph.resources.length, 1),
      [`${owned.length}/${graph.resources.length} resources have ownership`],
      graph.resources.filter((r) => !r.ownership?.length).map((r) => r.displayName).slice(0, 5),
    ),
    evidenceMaturity: explained(
      'health-evidence',
      'Evidence maturity',
      graph.completeness.overall,
      graph.completeness.dimensions.map((d) => `${d.label}: ${Math.round(d.score * 100)}%`),
      graph.completeness.dimensions.flatMap((d) => d.missing).slice(0, 6),
    ),
    resilienceMaturity: explained(
      'health-resilience',
      'Resilience maturity',
      dbs.length ? multiAzOk.length / dbs.length : 0.5,
      [`${multiAzOk.length}/${dbs.length || 0} databases meet multi-AZ expectations`],
      dbs.filter((d) => d.metadata.multi_az === false).map((d) => d.displayName),
    ),
    deploymentMaturity: explained(
      'health-deployment',
      'Deployment maturity',
      workloads.length ? withLimits.length / workloads.length : 0.5,
      [`${withLimits.length}/${workloads.length || 0} workloads declare resource metadata`],
    ),
    securityMaturity: explained(
      'health-security',
      'Security maturity',
      Math.max(0, 1 - publicRoutes.length * 0.08 - graph.drifts.filter((d) => /network|identity/i.test(d.category)).length * 0.15),
      [`${publicRoutes.length} public ingress points`, `${graph.resources.filter((r) => r.kind === 'network-policy').length} network policies`],
    ),
    approvalReadiness: explained(
      'health-approval',
      'Approval readiness',
      blocking.length ? Math.max(0, 0.2 - blocking.length * 0.05) : 0.85,
      blocking.length
        ? blocking.map((b) => `Blocking: ${b.title}`)
        : ['No open blocking findings'],
      blocking.map((b) => b.title),
    ),
  };
}
