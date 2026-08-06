import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';

export interface BusinessBlastRadius {
  originId: string;
  infrastructure: string[];
  applications: string[];
  capabilities: string[];
  dataAssets: string[];
  teams: string[];
  publicUsersAffected: boolean;
  signoffsInvalidated: string[];
  confidence: number;
  reasons: string[];
  evidenceIds: string[];
}

function neighbors(graph: EvidenceGraph, id: string): string[] {
  return graph.edges
    .filter((e) => e.source === id || e.target === id)
    .map((e) => (e.source === id ? e.target : e.source));
}

function walk(graph: EvidenceGraph, start: string, maxDepth = 4): Set<string> {
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of neighbors(graph, id)) {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return seen;
}

function byKind(nodes: ResourceNode[], kinds: string[]): ResourceNode[] {
  return nodes.filter((n) => kinds.includes(n.kind));
}

export function computeBusinessBlastRadius(graph: EvidenceGraph, originId: string): BusinessBlastRadius {
  const origin = graph.resources.find((r) => r.id === originId);
  const reached = walk(graph, originId);
  const nodes = graph.resources.filter((r) => reached.has(r.id));
  const apps = byKind(nodes, ['application', 'service', 'workload']);
  const caps = byKind(nodes, ['business-capability']);
  const data = byKind(nodes, ['data-asset', 'relational-database', 'bucket', 'queue', 'cache']);
  const teams = byKind(nodes, ['team']);
  const publicUsersAffected = nodes.some((n) =>
    ['route', 'ingress', 'internet', 'dns', 'load-balancer'].includes(n.kind),
  );
  const relatedFindings = graph.findings.filter((f) => f.affectedResources.some((id) => reached.has(id)));
  const signoffs = graph.signOffs.filter(
    (s) =>
      s.decision === 'Approved' ||
      s.decision === 'Approved with Waivers' ||
      relatedFindings.some((f) => f.blocksSignOff),
  );
  const infra = byKind(nodes, [
    'workload',
    'service',
    'route',
    'ingress',
    'vpc',
    'subnet',
    'network',
    'security-group',
    'cluster',
    'namespace',
  ]);

  const evidenceIds = [
    ...nodes.flatMap((n) => n.evidence),
    ...graph.edges
      .filter((e) => reached.has(e.source) && reached.has(e.target))
      .flatMap((e) => e.evidence),
  ].slice(0, 40);
  const conf =
    nodes.reduce((acc, n) => acc + (n.confidence?.score ?? 0.5), 0) / Math.max(nodes.length, 1);

  return {
    originId,
    infrastructure: infra.map((n) => n.id),
    applications: apps.map((n) => n.id),
    capabilities: caps.map((n) => n.id),
    dataAssets: data.map((n) => n.id),
    teams: teams.map((n) => n.id),
    publicUsersAffected,
    signoffsInvalidated: signoffs.map((s) => s.id),
    confidence: conf,
    reasons: [
      origin ? `Origin: ${origin.displayName}` : `Origin ${originId}`,
      `${apps.length} application/service node(s) affected`,
      `${caps.length} capability(ies) affected`,
      `${data.length} data asset/store(s) affected`,
      `${teams.length} team(s) in blast radius`,
      publicUsersAffected ? 'Public users may be affected via edge exposure' : 'No public edge in blast radius',
      `${signoffs.length} related sign-off decision(s)`,
    ],
    evidenceIds,
  };
}
