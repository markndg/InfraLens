import type { InfraLensEdition } from '@infralens/edition-capabilities';
import { assessConfidence } from '@infralens/evidence-model';
import {
  buildIndices,
  type EvidenceGraph,
  type ResourceEdge,
  type ResourceNode,
} from '@infralens/graph-model';

export interface ReachabilityStep {
  from: string;
  to: string;
  via: string;
  evidenceIds: string[];
  state: 'allowed' | 'blocked' | 'partial' | 'unknown';
}

export interface ReachabilityResult {
  sourceId: string;
  targetId: string;
  reachable: boolean | 'unknown';
  confidence: ReturnType<typeof assessConfidence>;
  path: string[];
  steps: ReachabilityStep[];
  explanation: string;
  missing: string[];
  evidenceIds: string[];
}

export interface ExposureReport {
  publicEndpoints: ResourceNode[];
  publiclyRoutable: ResourceNode[];
  internetEgress: ResourceEdge[];
  crossNamespace: ResourceEdge[];
  externalDependencies: ResourceNode[];
  unownedExternal: ResourceNode[];
}

function hasEffectiveNetworkEvidence(graph: EvidenceGraph): boolean {
  return graph.resources.some(
    (r) => r.kind === 'security-group' || r.kind === 'network-policy',
  );
}

export function analyzeReachability(
  graph: EvidenceGraph,
  sourceId: string,
  targetId: string,
  _edition: InfraLensEdition = 'commercial',
): ReachabilityResult {
  // Enable effective analysis when security-group / NetworkPolicy evidence is present.
  const effective = hasEffectiveNetworkEvidence(graph);

  const indices = graph.indices ?? buildIndices(graph);
  const source = graph.resources.find((r) => r.id === sourceId);
  const target = graph.resources.find((r) => r.id === targetId);
  if (!source || !target) {
    return {
      sourceId,
      targetId,
      reachable: 'unknown',
      confidence: assessConfidence({ score: 0, reasons: ['Unknown source or target'] }),
      path: [],
      steps: [],
      explanation: 'Source or target resource was not found in the graph.',
      missing: ['valid source/target ids'],
      evidenceIds: [],
    };
  }

  // BFS over semantic edges
  const queue: Array<{ id: string; path: string[]; steps: ReachabilityStep[] }> = [
    { id: sourceId, path: [sourceId], steps: [] },
  ];
  const seen = new Set<string>([sourceId]);
  let best: ReachabilityResult | null = null;

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id === targetId) {
      best = buildResult(graph, source, target, cur.path, cur.steps, effective);
      break;
    }
    const outs = graph.edges.filter((e) => e.source === cur.id);
    // also follow inbound for bidirectional service discovery? keep directed
    for (const edge of outs) {
      if (seen.has(edge.target)) continue;
      if (edge.relation === 'network-blocked') continue;
      seen.add(edge.target);
      queue.push({
        id: edge.target,
        path: [...cur.path, edge.target],
        steps: [
          ...cur.steps,
          {
            from: edge.source,
            to: edge.target,
            via: edge.label ?? edge.relation,
            evidenceIds: edge.evidence,
            state: edge.effectiveState ?? 'unknown',
          },
        ],
      });
    }

    // Special-case: internet / route reachability via reverse ingress edges when asking internet -> X
    if (source.kind === 'internet' || source.kind === 'dns' || source.name === 'internet') {
      void indices;
    }
  }

  // If source is synthetic internet, find routes/ingress that eventually reach target
  if (!best && (source.kind === 'internet' || source.id === 'internet' || source.name === 'internet')) {
    const ingress = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
    for (const ing of ingress) {
      const sub = analyzeReachability(graph, ing.id, targetId, _edition);
      if (sub.reachable === true || sub.path.length) {
        return {
          ...sub,
          sourceId,
          path: [sourceId, ...sub.path],
          explanation: `Internet traffic can enter via ${ing.displayName}. ${sub.explanation}`,
          evidenceIds: [...ing.evidence, ...sub.evidenceIds],
        };
      }
    }
  }

  if (best) return best;

  const missing = collectMissingNetworkEvidence(graph, source, target);
  return {
    sourceId,
    targetId,
    reachable: missing.length ? 'unknown' : false,
    confidence: assessConfidence({
      score: missing.length ? 0.35 : 0.7,
      reasons: ['No connecting path found in current evidence graph'],
      missingEvidence: missing,
      wouldIncreaseConfidence: missing.map((m) => `Provide ${m}`),
    }),
    path: [],
    steps: [],
    explanation: missing.length
      ? `Reachability unknown.\n\nMissing:\n${missing.map((m) => `- ${m}`).join('\n')}`
      : `${source.displayName} cannot reach ${target.displayName} based on discovered relationships.`,
    missing,
    evidenceIds: [...source.evidence, ...target.evidence],
  };
}

function buildResult(
  graph: EvidenceGraph,
  source: ResourceNode,
  target: ResourceNode,
  path: string[],
  steps: ReachabilityStep[],
  effective: boolean,
): ReachabilityResult {
  const evidenceIds = [...new Set(steps.flatMap((s) => s.evidenceIds))];
  const missing = collectMissingNetworkEvidence(graph, source, target);
  const blocked = steps.some((s) => s.state === 'blocked');
  const unknown = steps.some((s) => s.state === 'unknown') || (!effective && missing.length > 0);

  const explanations = steps.map((s, i) => {
    const from = graph.resources.find((r) => r.id === s.from)?.displayName ?? s.from;
    const to = graph.resources.find((r) => r.id === s.to)?.displayName ?? s.to;
    return `${i + 1}. ${from} → ${to} via ${s.via}`;
  });

  // Network policy / SG hints
  const np = graph.resources.filter((r) => r.kind === 'network-policy');
  const sgs = graph.resources.filter((r) => r.kind === 'security-group');
  if (np.length) {
    explanations.push(`${explanations.length + 1}. NetworkPolicy resources present (${np.length}); evaluate selectors for final allow/deny.`);
  }
  if (sgs.length && effective) {
    explanations.push(`${explanations.length + 1}. Security group inventory present (${sgs.length}).`);
  } else if (target.kind === 'relational-database') {
    missing.push('Security-group inventory for database ingress');
  }

  const score = blocked ? 0.9 : unknown ? 0.55 : 0.9;
  return {
    sourceId: source.id,
    targetId: target.id,
    reachable: blocked ? false : unknown ? 'unknown' : true,
    confidence: assessConfidence({
      score,
      reasons: explanations,
      missingEvidence: missing,
      wouldIncreaseConfidence: missing.map((m) => `Provide ${m}`),
    }),
    path,
    steps,
    explanation: blocked
      ? `${source.displayName} is blocked from reaching ${target.displayName}.\n\nEvidence:\n${explanations.join('\n')}`
      : unknown
        ? `Reachability partially inferred for ${source.displayName} → ${target.displayName}.\n\nEvidence:\n${explanations.join('\n')}\n\nMissing:\n${missing.map((m) => `- ${m}`).join('\n')}`
        : `${source.displayName} can reach ${target.displayName}.\n\nEvidence:\n${explanations.join('\n')}\n\nConfidence: High`,
    missing,
    evidenceIds,
  };
}

function collectMissingNetworkEvidence(
  graph: EvidenceGraph,
  source: ResourceNode,
  target: ResourceNode,
): string[] {
  const missing: string[] = [];
  const hasSg = graph.resources.some((r) => r.kind === 'security-group' && r.truthStates.includes('observed'));
  const hasNp = graph.resources.some((r) => r.kind === 'network-policy');
  if (!hasSg && (target.kind === 'relational-database' || source.provider === 'aws')) {
    missing.push('Security-group inventory unavailable');
  }
  if (!hasNp && (source.platform === 'kubernetes' || source.platform === 'openshift')) {
    missing.push('Complete NetworkPolicy egress evaluation');
  }
  return missing;
}

export function exposureAnalysis(graph: EvidenceGraph): ExposureReport {
  const publicEndpoints = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress' || r.kind === 'dns');
  const externalDependencies = graph.resources.filter((r) => r.provider === 'external' || r.kind === 'external-system');
  const internetEgress = graph.edges.filter((e) => {
    const t = graph.resources.find((r) => r.id === e.target);
    return t?.provider === 'external' || e.relation === 'connects' && t?.boundary === 'Internet';
  });
  const crossNamespace = graph.edges.filter((e) => {
    const s = graph.resources.find((r) => r.id === e.source);
    const t = graph.resources.find((r) => r.id === e.target);
    return s?.namespace && t?.namespace && s.namespace !== t.namespace;
  });
  const publiclyRoutable: ResourceNode[] = [];
  for (const ep of publicEndpoints) {
    const seen = new Set<string>([ep.id]);
    const q = [ep.id];
    while (q.length) {
      const id = q.shift()!;
      for (const edge of graph.edges.filter((e) => e.source === id)) {
        if (seen.has(edge.target)) continue;
        seen.add(edge.target);
        q.push(edge.target);
        const node = graph.resources.find((r) => r.id === edge.target);
        if (node && (node.kind === 'workload' || node.kind === 'service')) publiclyRoutable.push(node);
      }
    }
  }
  return {
    publicEndpoints,
    publiclyRoutable: dedupe(publiclyRoutable),
    internetEgress,
    crossNamespace,
    externalDependencies,
    unownedExternal: externalDependencies.filter((e) => !e.ownership?.length),
  };
}

function dedupe(nodes: ResourceNode[]): ResourceNode[] {
  const m = new Map(nodes.map((n) => [n.id, n]));
  return [...m.values()];
}

export function blastRadius(graph: EvidenceGraph, resourceId: string) {
  const indices = graph.indices ?? buildIndices(graph);
  const direct = indices.adjacencyIn[resourceId] ?? [];
  const transitive = new Set<string>();
  const q = [...direct];
  while (q.length) {
    const id = q.shift()!;
    if (transitive.has(id)) continue;
    transitive.add(id);
    for (const up of indices.adjacencyIn[id] ?? []) q.push(up);
  }
  const affected = [...transitive].map((id) => graph.resources.find((r) => r.id === id)!).filter(Boolean);
  const publicRoutes = affected.filter((r) => r.kind === 'route' || r.kind === 'ingress');
  const dataPaths = graph.edges.filter(
    (e) =>
      (e.source === resourceId || e.target === resourceId || transitive.has(e.source) || transitive.has(e.target)) &&
      ['data-read', 'data-write', 'connects', 'event-publish', 'event-consume'].includes(e.relation),
  );
  const policies = graph.findings.filter((f) => f.affectedResources.includes(resourceId));
  const environments = [...new Set(affected.map((r) => r.environment).filter(Boolean))];
  return {
    resourceId,
    directDependants: direct,
    transitiveDependants: [...transitive],
    publicRoutesAffected: publicRoutes.map((r) => r.id),
    dataPathsAffected: dataPaths.map((e) => e.id),
    policiesAffected: policies.map((f) => f.id),
    environmentsAffected: environments,
    explanation: `Failure of this component directly affects ${direct.length} dependants and transitively ${transitive.size} components across ${environments.join(', ') || 'unknown environments'}.`,
    confidence: assessConfidence({
      score: 0.85,
      reasons: ['Computed from directed dependency edges in the evidence graph'],
    }),
  };
}

/** Ensure a synthetic internet node exists for path queries. */
export function ensureInternetNode(graph: EvidenceGraph): ResourceNode {
  let node = graph.resources.find((r) => r.id === 'internet' || r.kind === 'internet');
  if (node) return node;
  node = {
    id: 'internet',
    logicalId: 'internet',
    kind: 'internet',
    name: 'internet',
    displayName: 'Internet',
    environment: 'external',
    boundary: 'Internet',
    truthStates: ['assumed'],
    instances: [],
    metadata: {},
    interfaces: [],
    evidence: [],
    findings: [],
    confidence: assessConfidence({
      score: 1,
      reasons: ['Synthetic internet boundary for exposure analysis'],
    }),
    tags: ['synthetic'],
  };
  graph.resources.push(node);
  for (const ep of graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress' || r.kind === 'dns')) {
    graph.edges.push({
      id: `internet:${ep.id}`,
      source: 'internet',
      target: ep.id,
      relation: 'exposes',
      direction: 'directed',
      truthStates: ['inferred'],
      evidence: ep.evidence,
      confidence: assessConfidence({
        score: 0.9,
        reasons: ['Public ingress assumed reachable from internet'],
      }),
      findings: [],
      label: 'public',
      effectiveState: 'allowed',
    });
  }
  return node;
}
