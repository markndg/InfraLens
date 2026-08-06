import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import { stableId, type AssumptionStatus, type EvidenceGraph } from '@infralens/graph-model';

interface AssumptionSeed {
  id: string;
  title: string;
  evaluate: (graph: EvidenceGraph) => { status: AssumptionStatus; reasons: string[]; resourceIds: string[] };
}

const SEEDS: AssumptionSeed[] = [
  {
    id: 'db-resilient',
    title: 'Database resilient',
    evaluate: (graph) => {
      const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
      const bad = dbs.filter((d) => d.metadata.multi_az === false || d.metadata.multiAz === false);
      if (!dbs.length) return { status: 'unknown', reasons: ['No database'], resourceIds: [] };
      if (bad.length)
        return {
          status: 'failed',
          reasons: [`${bad.map((b) => b.displayName).join(', ')} is single-AZ`],
          resourceIds: bad.map((b) => b.id),
        };
      return { status: 'supported', reasons: ['Multi-AZ evidence present'], resourceIds: dbs.map((d) => d.id) };
    },
  },
  {
    id: 'public-api-protected',
    title: 'Public API is protected',
    evaluate: (graph) => {
      const routes = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
      if (!routes.length) return { status: 'supported', reasons: ['No public API'], resourceIds: [] };
      const waf = graph.resources.some((r) => /waf|shield/i.test(r.name));
      if (!waf)
        return {
          status: 'unsupported',
          reasons: ['Public ingress present; no WAF/shield evidence'],
          resourceIds: routes.map((r) => r.id),
        };
      return { status: 'supported', reasons: ['Edge protection evidence found'], resourceIds: routes.map((r) => r.id) };
    },
  },
  {
    id: 'single-provider-ok',
    title: 'Single provider acceptable',
    evaluate: (graph) => {
      const providers = new Set(graph.resources.map((r) => r.provider).filter(Boolean));
      return {
        status: providers.size <= 2 ? 'supported' : 'unknown',
        reasons: [`Providers: ${[...providers].join(', ') || 'unknown'}`],
        resourceIds: [],
      };
    },
  },
  {
    id: 'payments-reliable',
    title: 'Third-party payments reliable',
    evaluate: (graph) => {
      const pay = graph.resources.filter(
        (r) => r.provider === 'external' || /payment/i.test(r.name),
      );
      if (!pay.length) return { status: 'unknown', reasons: ['No payment dependency'], resourceIds: [] };
      return {
        status: 'unsupported',
        reasons: ['External payment dependency leaves trust boundary — reliability not evidenced'],
        resourceIds: pay.map((p) => p.id),
      };
    },
  },
  {
    id: 'aws-region-available',
    title: 'AWS region available',
    evaluate: (graph) => {
      const aws = graph.resources.filter((r) => r.provider === 'aws');
      if (!aws.length) return { status: 'unknown', reasons: ['No AWS resources'], resourceIds: [] };
      return {
        status: 'supported',
        reasons: [`AWS resources observed in ${aws[0]?.region ?? 'region'}`],
        resourceIds: aws.slice(0, 5).map((a) => a.id),
      };
    },
  },
];

export function inferAndEvaluateAssumptions(graph: EvidenceGraph): string[] {
  const ids: string[] = [];
  for (const seed of SEEDS) {
    const result = seed.evaluate(graph);
    const id = stableId('assumption', seed.id);
    ids.push(id);
    let node = graph.resources.find((r) => r.id === id);
    if (!node) {
      const ev = createEvidence({
        adapter: 'governance-assumptions',
        sourceType: 'inference',
        sourceUri: `assumption:${seed.id}`,
        confidence: 0.72,
        truthState: 'assumed',
        rationale: `Architectural assumption: ${seed.title}`,
      });
      graph.evidence.push(ev);
      node = {
        id,
        logicalId: id,
        kind: 'assumption',
        subtype: seed.id,
        name: seed.title,
        displayName: seed.title,
        lifecycle: 'active',
        truthStates: ['assumed'],
        instances: [],
        metadata: {},
        interfaces: [],
        evidence: [ev.id],
        findings: [],
        confidence: assessConfidence({ score: 0.72, reasons: result.reasons }),
        tags: ['assumption'],
        layers: ['governance', 'assumption'],
      };
      graph.resources.push(node);
    }
    node.metadata.status = result.status;
    node.metadata.reasons = result.reasons;
    node.metadata.relatedResourceIds = result.resourceIds;
    if (result.status === 'failed' || result.status === 'unsupported') {
      node.tags = [...new Set([...(node.tags ?? []), `assumption-${result.status}`])];
    }
    for (const rid of result.resourceIds) {
      const edgeId = stableId(id, 'depends-on-assumption', rid);
      // assumption depends on evidence from resource — reverse: resource depends-on-assumption? Spec: assumption nodes; link decision/impl → assumption
      if (!graph.edges.some((e) => e.id === edgeId)) {
        graph.edges.push({
          id: edgeId,
          source: rid,
          target: id,
          relation: 'depends-on-assumption',
          direction: 'directed',
          truthStates: ['inferred'],
          evidence: node.evidence,
          confidence: assessConfidence({ score: 0.7, reasons: result.reasons.slice(0, 1) }),
          findings: [],
          label: 'assumes',
        });
      }
    }
    // Link HA intent to db-resilient assumption
    if (seed.id === 'db-resilient') {
      const intent = graph.resources.find((r) => r.kind === 'intent' && r.subtype === 'highly-available');
      if (intent) {
        const eid = stableId(intent.id, 'depends-on-assumption', id);
        if (!graph.edges.some((e) => e.id === eid)) {
          graph.edges.push({
            id: eid,
            source: intent.id,
            target: id,
            relation: 'depends-on-assumption',
            direction: 'directed',
            truthStates: ['inferred'],
            evidence: node.evidence,
            confidence: assessConfidence({ score: 0.8, reasons: ['HA intent depends on DB resilience'] }),
            findings: [],
            label: 'depends on',
          });
        }
      }
    }
  }
  return ids;
}
