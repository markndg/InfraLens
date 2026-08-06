import type { ArchitectureDNA, ArchitectureHealth, EvidenceGraph, ExplainedScore, RiskProfile } from '@infralens/graph-model';

function bar(score: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, score)) * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

function dim(id: string, label: string, score: number, reasons: string[], evidenceIds: string[] = []): ExplainedScore {
  const s = Math.max(0, Math.min(1, score));
  const band: ExplainedScore['band'] =
    s >= 0.8 ? 'low' : s >= 0.6 ? 'medium' : s >= 0.35 ? 'high' : s > 0 ? 'critical' : 'unknown';
  return { id, label, score: s, band, reasons, evidenceIds, missing: [] };
}

export function computeArchitectureDNA(
  graph: EvidenceGraph,
  health: ArchitectureHealth,
  risk: RiskProfile,
): ArchitectureDNA {
  const caps = graph.resources.filter((r) => r.kind === 'business-capability' && r.subtype !== 'platform');
  const edges = graph.edges.filter((e) => !['contains', 'protected-by', 'owned-by'].includes(e.relation));
  const coupling = Math.min(1, edges.length / Math.max(graph.resources.length, 1) / 2.5);
  const complexity = Math.min(
    1,
    (graph.resources.filter((r) => ['workload', 'service', 'queue', 'external-system'].includes(r.kind)).length +
      graph.resources.filter((r) => r.provider === 'aws' || r.provider === 'openshift').length * 0.05) /
      20,
  );

  const capabilities = dim('dna-capabilities', 'Capabilities', Math.min(1, caps.length / 8), [
    `${caps.length} logical capabilities inferred`,
    ...caps.slice(0, 5).map((c) => c.displayName),
  ]);
  const couplingDim = dim('dna-coupling', 'Coupling', coupling, [
    `${edges.length} non-ownership edges across ${graph.resources.length} nodes`,
    'Higher bars mean denser dependency coupling',
  ]);
  const resilience = dim(
    'dna-resilience',
    'Resilience',
    health.resilienceMaturity.score,
    health.resilienceMaturity.reasons,
  );
  const evidence = dim('dna-evidence', 'Evidence', health.evidenceMaturity.score, health.evidenceMaturity.reasons);
  const ownership = dim('dna-ownership', 'Ownership', health.ownershipMaturity.score, health.ownershipMaturity.reasons);
  const security = dim(
    'dna-security',
    'Security',
    Math.max(0, 1 - risk.security.score),
    [`Security risk ${(risk.security.score * 100).toFixed(0)}%`, ...risk.security.reasons],
  );
  const operationalComplexity = dim('dna-complexity', 'Operational Complexity', complexity, [
    `${graph.resources.filter((r) => r.kind === 'workload').length} workloads`,
    `${graph.resources.filter((r) => r.kind === 'queue').length} queues`,
    `${graph.resources.filter((r) => r.provider === 'external').length} external systems`,
  ]);

  const dims = [capabilities, couplingDim, resilience, evidence, ownership, security, operationalComplexity];

  return {
    capabilities,
    coupling: couplingDim,
    resilience,
    evidence,
    ownership,
    security,
    operationalComplexity,
    fingerprint: dims.map((d) => `${d.label}:${bar(d.score)}`).join('|'),
  };
}

export function dnaBars(dna: ArchitectureDNA): Array<{ id: string; label: string; bar: string; score: number }> {
  return [
    dna.capabilities,
    dna.coupling,
    dna.resilience,
    dna.evidence,
    dna.ownership,
    dna.security,
    dna.operationalComplexity,
  ].map((d) => ({ id: d.id, label: d.label, bar: bar(d.score), score: d.score }));
}

export function compareDNA(
  a: ArchitectureDNA,
  b: ArchitectureDNA,
): Array<{ id: string; label: string; delta: number; a: number; b: number }> {
  const pairs: Array<[ExplainedScore, ExplainedScore]> = [
    [a.capabilities, b.capabilities],
    [a.coupling, b.coupling],
    [a.resilience, b.resilience],
    [a.evidence, b.evidence],
    [a.ownership, b.ownership],
    [a.security, b.security],
    [a.operationalComplexity, b.operationalComplexity],
  ];
  return pairs.map(([dimA, dimB]) => ({
    id: dimA.id,
    label: dimA.label,
    a: dimA.score,
    b: dimB.score,
    delta: dimB.score - dimA.score,
  }));
}
