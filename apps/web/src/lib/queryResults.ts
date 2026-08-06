import type { InfraLensEdition } from '@infralens/edition-capabilities';
import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import {
  analyzeReachability,
  blastRadius,
  type ReachabilityResult,
} from '@infralens/reachability';
import { runQuery, type ArchitectureQuery } from '@infralens/reporting';

export type ReachabilityStatus =
  | 'Confirmed reachable'
  | 'Confirmed blocked'
  | 'Partially reachable'
  | 'No path found'
  | 'Unknown due to missing evidence';

export interface QueryConclusion {
  id: string;
  question: string;
  answer: string;
  status?: ReachabilityStatus;
  confidence: string;
  explanation: string;
  pathIds: string[];
  missing: string[];
  evidenceIds: string[];
  impact?: string;
  followUps: string[];
  highlightIds: string[];
}

export function statusFromReachability(result: ReachabilityResult): ReachabilityStatus {
  if (result.reachable === true && !result.missing.length) return 'Confirmed reachable';
  if (result.reachable === false && !result.missing.length) return 'Confirmed blocked';
  if (result.path.length && result.missing.length) return 'Partially reachable';
  if (result.reachable === 'unknown' || result.missing.length) return 'Unknown due to missing evidence';
  if (!result.path.length) return 'No path found';
  return 'Partially reachable';
}

export function concludeReachability(
  graph: EvidenceGraph,
  sourceId: string,
  targetId: string,
  edition: InfraLensEdition,
  question: string,
): QueryConclusion {
  const result = analyzeReachability(graph, sourceId, targetId, edition);
  const status = statusFromReachability(result);
  const source = graph.resources.find((r) => r.id === sourceId);
  const target = graph.resources.find((r) => r.id === targetId);

  let answer: string;
  switch (status) {
    case 'Confirmed reachable':
      answer = `Yes — ${source?.displayName ?? 'source'} can reach ${target?.displayName ?? 'target'}.`;
      break;
    case 'Confirmed blocked':
      answer = `No — the path is blocked between ${source?.displayName} and ${target?.displayName}.`;
      break;
    case 'Partially reachable':
      answer = `Partial path found to ${target?.displayName}; final network controls are not fully confirmed.`;
      break;
    case 'No path found':
      answer = `No discovered path from ${source?.displayName} to ${target?.displayName}. This is not the same as confirmed blocked.`;
      break;
    default:
      answer = `Reachability to ${target?.displayName} is unknown due to missing evidence.`;
  }

  const followUps = [
    'Show the exact path',
    result.missing.length ? 'Show missing network evidence' : 'Show evidence for this path',
    target ? `Show all consumers of ${target.displayName}` : 'Show related components',
  ].slice(0, 3);

  return {
    id: `reach-${sourceId}-${targetId}`,
    question,
    answer,
    status,
    confidence: result.confidence.band,
    explanation: result.explanation,
    pathIds: result.path,
    missing: result.missing,
    evidenceIds: result.evidenceIds,
    followUps,
    highlightIds: result.path,
  };
}

export function concludeTypedQuery(
  graph: EvidenceGraph,
  type: ArchitectureQuery['type'],
  question: string,
): QueryConclusion {
  const result = runQuery(graph, { type } as ArchitectureQuery);
  const items = Array.isArray(result) ? result : result ? [result] : [];
  const nodes = items.filter((x): x is ResourceNode => !!x && typeof x === 'object' && 'displayName' in x);
  const highlightIds = nodes.map((n) => n.id);
  const names = nodes.slice(0, 8).map((n) => n.displayName);

  return {
    id: `query-${type}`,
    question,
    answer:
      nodes.length > 0
        ? `Found ${nodes.length} matching component${nodes.length === 1 ? '' : 's'}${names.length ? `: ${names.join(', ')}` : ''}.`
        : items.length
          ? `Found ${items.length} matching record(s).`
          : 'No matching components for this question.',
    confidence: 'high',
    explanation:
      nodes.length > 0
        ? `Deterministic graph query (${type}) matched ${nodes.length} resources from the evidence graph.`
        : `Deterministic graph query (${type}) returned no resource matches.`,
    pathIds: [],
    missing: [],
    evidenceIds: nodes.flatMap((n) => n.evidence).slice(0, 20),
    followUps: ['Inspect first result', 'Filter to production', 'Show related findings'].slice(0, 3),
    highlightIds,
  };
}

export function concludeBlastRadius(graph: EvidenceGraph, resourceId: string): QueryConclusion {
  const br = blastRadius(graph, resourceId);
  const resource = graph.resources.find((r) => r.id === resourceId);
  return {
    id: `blast-${resourceId}`,
    question: `What depends on ${resource?.displayName ?? 'this component'}?`,
    answer: br.explanation,
    confidence: br.confidence.band,
    explanation: `${br.directDependants.length} direct and ${br.transitiveDependants.length} transitive dependants.`,
    pathIds: [],
    missing: [],
    evidenceIds: resource?.evidence ?? [],
    impact: br.publicRoutesAffected.length
      ? `${br.publicRoutesAffected.length} public route(s) affected.`
      : undefined,
    followUps: ['Show transitive dependants', 'Show public routes affected', 'Show data paths'].slice(0, 3),
    highlightIds: [resourceId, ...br.directDependants, ...br.transitiveDependants].slice(0, 40),
  };
}
