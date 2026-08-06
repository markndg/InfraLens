import type { ArchitecturalScorecard, EvidenceGraph, ExplainedScore } from '@infralens/graph-model';
import { computeArchitectureHealth } from '../health.js';
import { computeRiskProfile } from '../risk.js';

function explained(
  id: string,
  label: string,
  value: number,
  reasons: string[],
  missing: string[] = [],
  evidenceIds: string[] = [],
): ExplainedScore {
  const score = Math.max(0, Math.min(1, value));
  // For scorecard: higher is better maturity (invert risk scores at call site)
  const band: ExplainedScore['band'] =
    score >= 0.8 ? 'low' : score >= 0.6 ? 'medium' : score >= 0.35 ? 'high' : 'critical';
  return { id, label, score, band, reasons, evidenceIds, missing };
}

export function computeArchitecturalScorecard(graph: EvidenceGraph): ArchitecturalScorecard {
  const health = graph.intelligence?.health ?? computeArchitectureHealth(graph);
  const risk = graph.intelligence?.risk ?? computeRiskProfile(graph);
  const workloads = graph.resources.filter((r) => r.kind === 'workload');
  const withReplicas = workloads.filter((r) => Number(r.metadata.replicas ?? 1) >= 2);
  const expensive = graph.resources.filter(
    (r) => r.metadata.estimatedMonthlyCost != null || ['relational-database', 'load-balancer'].includes(r.kind),
  );

  return {
    availability: explained(
      'sc-availability',
      'Availability',
      health.resilienceMaturity.score,
      health.resilienceMaturity.reasons,
      health.resilienceMaturity.missing,
    ),
    security: explained(
      'sc-security',
      'Security',
      Math.max(0, 1 - risk.security.score),
      risk.security.reasons,
      risk.security.missing,
      risk.security.evidenceIds,
    ),
    evidence: explained(
      'sc-evidence',
      'Evidence',
      health.evidenceMaturity.score,
      health.evidenceMaturity.reasons,
      health.evidenceMaturity.missing,
    ),
    ownership: explained(
      'sc-ownership',
      'Ownership',
      health.ownershipMaturity.score,
      health.ownershipMaturity.reasons,
      health.ownershipMaturity.missing,
    ),
    resilience: explained(
      'sc-resilience',
      'Resilience',
      health.resilienceMaturity.score,
      health.resilienceMaturity.reasons,
      health.resilienceMaturity.missing,
    ),
    scalability: explained(
      'sc-scalability',
      'Scalability',
      workloads.length ? withReplicas.length / workloads.length : 0.5,
      [`${withReplicas.length}/${workloads.length || 0} workloads run with ≥2 replicas`],
      workloads.filter((w) => Number(w.metadata.replicas ?? 1) < 2).map((w) => w.displayName).slice(0, 5),
    ),
    maintainability: explained(
      'sc-maintainability',
      'Maintainability',
      Math.min(1, 0.4 + (graph.intelligence?.capabilityIds.length ?? 0) * 0.05 + health.ownershipMaturity.score * 0.3),
      [
        `${graph.intelligence?.capabilityIds.length ?? 0} capabilities inferred`,
        `Ownership maturity ${Math.round(health.ownershipMaturity.score * 100)}%`,
      ],
    ),
    cost: explained(
      'sc-cost',
      'Cost',
      Math.max(0, 1 - expensive.length * 0.08),
      [`${expensive.length} cost-concentrated resource class(es) in graph`],
      [],
    ),
    operationalRisk: explained(
      'sc-op-risk',
      'Operational Risk',
      Math.max(0, 1 - risk.operational.score),
      risk.operational.reasons,
      risk.operational.missing,
      risk.operational.evidenceIds,
    ),
    businessRisk: explained(
      'sc-biz-risk',
      'Business Risk',
      Math.max(0, 1 - risk.business.score),
      risk.business.reasons,
      risk.business.missing,
      risk.business.evidenceIds,
    ),
  };
}
