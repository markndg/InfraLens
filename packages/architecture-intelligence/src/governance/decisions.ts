import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import { stableId, type EvidenceGraph, type ResourceNode } from '@infralens/graph-model';

interface DecisionSeed {
  id: string;
  title: string;
  rationale: string;
  match: (g: EvidenceGraph) => ResourceNode[];
  intentIds: string[];
}

const SEEDS: DecisionSeed[] = [
  {
    id: 'use-postgresql',
    title: 'Use PostgreSQL',
    rationale: 'Relational persistence for order/catalogue state',
    match: (g) => g.resources.filter((r) => r.kind === 'relational-database'),
    intentIds: ['highly-available', 'encrypted-storage'],
  },
  {
    id: 'deploy-openshift',
    title: 'Deploy to OpenShift',
    rationale: 'Container platform for storefront and catalog workloads',
    match: (g) =>
      g.resources.filter((r) => r.platform === 'openshift' || r.provider === 'openshift'),
    intentIds: ['portable', 'observable'],
  },
  {
    id: 'use-sqs',
    title: 'Use SQS',
    rationale: 'Asynchronous order event processing',
    match: (g) => g.resources.filter((r) => r.kind === 'queue'),
    intentIds: ['event-driven', 'stateless-service'],
  },
  {
    id: 'external-payments',
    title: 'External payments',
    rationale: 'Payment processing via external provider',
    match: (g) =>
      g.resources.filter((r) => r.provider === 'external' || /payment/i.test(r.name)),
    intentIds: ['low-cost'],
  },
  {
    id: 'event-driven',
    title: 'Event-driven architecture',
    rationale: 'Workers consume queue events for fulfilment',
    match: (g) =>
      g.resources.filter(
        (r) =>
          r.kind === 'queue' ||
          (/worker/i.test(r.name) && r.kind === 'workload'),
      ),
    intentIds: ['event-driven', 'stateless-service'],
  },
  {
    id: 'object-storage',
    title: 'Use S3 for assets',
    rationale: 'Product images and static assets in object storage',
    match: (g) => g.resources.filter((r) => r.kind === 'bucket'),
    intentIds: ['encrypted-storage', 'low-cost'],
  },
];

export function inferDecisions(graph: EvidenceGraph): string[] {
  const ids: string[] = [];
  for (const seed of SEEDS) {
    const impl = seed.match(graph);
    if (!impl.length) continue;
    const id = stableId('decision', seed.id);
    if (graph.resources.some((r) => r.id === id)) {
      ids.push(id);
      linkImplementation(graph, id, impl);
      continue;
    }
    const ev = createEvidence({
      adapter: 'governance-decisions',
      sourceType: 'inference',
      sourceUri: `decision:${seed.id}`,
      confidence: 0.8,
      truthState: 'inferred',
      rationale: seed.rationale,
    });
    graph.evidence.push(ev);
    graph.resources.push({
      id,
      logicalId: id,
      kind: 'architectural-decision',
      subtype: seed.id,
      name: seed.title,
      displayName: seed.title,
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [],
      metadata: {
        status: 'accepted',
        intent: seed.title,
        rationale: seed.rationale,
        owner: 'Architecture',
        relatedIntentIds: seed.intentIds,
      },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({
        score: 0.8,
        reasons: [seed.rationale, `${impl.length} implementing resource(s)`],
        inferenceMethod: 'deterministic-decision-rules',
      }),
      tags: ['decision'],
      layers: ['governance', 'decision'],
    });
    ids.push(id);
    linkImplementation(graph, id, impl, ev.id);

    const caps = graph.resources.filter((r) => r.kind === 'business-capability' && r.subtype !== 'platform');
    for (const cap of caps.slice(0, 3)) {
      if (impl.some((i) => related(graph, cap.id, i.id))) {
        upsertEdge(graph, cap.id, id, 'decides', ev.id, 'decides');
      }
    }
  }
  return ids;
}

function related(graph: EvidenceGraph, a: string, b: string): boolean {
  return graph.edges.some(
    (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a),
  );
}

function linkImplementation(
  graph: EvidenceGraph,
  decisionId: string,
  impl: ResourceNode[],
  evidenceId?: string,
) {
  const ev =
    evidenceId ??
    graph.resources.find((r) => r.id === decisionId)?.evidence[0] ??
    '';
  for (const r of impl) {
    upsertEdge(graph, decisionId, r.id, 'implemented-by', ev, 'implemented by');
  }
}

function upsertEdge(
  graph: EvidenceGraph,
  source: string,
  target: string,
  relation: 'decides' | 'implemented-by',
  evidenceId: string,
  label: string,
) {
  const id = stableId(source, relation, target);
  if (graph.edges.some((e) => e.id === id)) return;
  graph.edges.push({
    id,
    source,
    target,
    relation,
    direction: 'directed',
    truthStates: ['inferred'],
    evidence: evidenceId ? [evidenceId] : [],
    confidence: assessConfidence({ score: 0.75, reasons: [label] }),
    findings: [],
    label,
  });
}
