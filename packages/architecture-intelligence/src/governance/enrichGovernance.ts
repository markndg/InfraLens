import type { EvidenceGraph, GovernanceSnapshot } from '@infralens/graph-model';
import { clearProjectionCache } from '../projections.js';
import { evaluateAdrSatisfaction, ingestAdrs, type ProjectFileLike } from './adr.js';
import { inferAndEvaluateAssumptions } from './assumptions.js';
import { buildContractsAndObligations } from './contracts.js';
import { inferDecisions } from './decisions.js';
import { ensureIntents, validateIntents } from './intents.js';
import { buildGovernanceDashboard, computeGovernanceMetrics } from './metrics.js';
import { attachReviewRecordNode } from './replay.js';

export interface GovernanceEnrichOptions {
  files?: ProjectFileLike[];
  declaredIntents?: string[];
}

export function enrichGovernance(
  graph: EvidenceGraph,
  options: GovernanceEnrichOptions = {},
): GovernanceSnapshot {
  const adrIds = options.files?.length
    ? ingestAdrs(graph, options.files)
    : graph.resources.filter((r) => r.kind === 'adr').map((r) => r.id);

  const decisionIds = inferDecisions(graph);
  const intentIds = ensureIntents(graph, options.declaredIntents ?? graph.declaredIntents);
  validateIntents(graph);
  evaluateAdrSatisfaction(graph);
  const assumptionIds = inferAndEvaluateAssumptions(graph);

  let contractIds = graph.resources.filter((r) => r.kind === 'architecture-contract').map((r) => r.id);
  let obligationIds = graph.resources.filter((r) => r.kind === 'obligation').map((r) => r.id);
  if (!contractIds.length) {
    const built = buildContractsAndObligations(graph);
    contractIds = built.contractIds;
    obligationIds = built.obligationIds;
  }

  for (const review of graph.reviews ?? []) {
    attachReviewRecordNode(graph, review);
  }
  const reviewRecordIds = graph.resources.filter((r) => r.kind === 'review-record').map((r) => r.id);

  const metrics = computeGovernanceMetrics(graph);
  const dashboard = buildGovernanceDashboard(graph, metrics);

  const governance: GovernanceSnapshot = {
    version: '2.0',
    dashboard,
    metrics,
    decisionIds: [...new Set(decisionIds)],
    intentIds,
    assumptionIds,
    contractIds: [...new Set(contractIds)],
    obligationIds: [...new Set(obligationIds)],
    adrIds,
    reviewRecordIds,
  };

  graph.version = '2.0';
  if (graph.intelligence) {
    graph.intelligence.version = '2.0';
    graph.intelligence.governance = governance;
  }
  clearProjectionCache(graph);
  return governance;
}
