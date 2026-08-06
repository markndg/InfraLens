import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import { stableId, type EvidenceGraph, type ResourceNode } from '@infralens/graph-model';

interface DataRule {
  id: string;
  name: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  matchStore: (r: ResourceNode) => boolean;
  matchProducer?: (r: ResourceNode, graph: EvidenceGraph) => boolean;
}

const DATA_RULES: DataRule[] = [
  {
    id: 'orders',
    name: 'Customer Orders',
    classification: 'confidential',
    matchStore: (r) =>
      r.kind === 'relational-database' ||
      r.kind === 'queue' ||
      /order/i.test(r.name),
    matchProducer: (r) => /catalog|order|storefront|worker/i.test(r.name),
  },
  {
    id: 'product-catalogue',
    name: 'Product Catalogue',
    classification: 'internal',
    matchStore: (r) => r.kind === 'relational-database' || /catalog/i.test(r.name),
    matchProducer: (r) => /catalog/i.test(r.name),
  },
  {
    id: 'images',
    name: 'Product Images',
    classification: 'internal',
    matchStore: (r) => r.kind === 'bucket' || /asset|image/i.test(r.name),
    matchProducer: (r) => /worker|storefront/i.test(r.name),
  },
  {
    id: 'payments',
    name: 'Payments',
    classification: 'restricted',
    matchStore: (r) => r.provider === 'external' && /payment/i.test(r.name),
    matchProducer: (r) => /storefront|payment/i.test(r.name),
  },
  {
    id: 'telemetry',
    name: 'Telemetry',
    classification: 'internal',
    matchStore: (r) => r.kind === 'monitoring' || /otel|telemetry|log/i.test(r.name),
  },
  {
    id: 'customer-accounts',
    name: 'Customer Accounts',
    classification: 'confidential',
    matchStore: (r) => /account|user|customer|auth/i.test(r.name),
  },
  {
    id: 'audit',
    name: 'Audit Records',
    classification: 'restricted',
    matchStore: (r) => /audit|trail/i.test(r.name),
  },
];

export function inferDataAssets(graph: EvidenceGraph): string[] {
  const ids: string[] = [];
  for (const rule of DATA_RULES) {
    const stores = graph.resources.filter(
      (r) => !['data-asset', 'business-capability', 'team'].includes(r.kind) && rule.matchStore(r),
    );
    if (!stores.length) continue;
    const id = stableId('data', rule.id);
    if (graph.resources.some((r) => r.id === id)) continue;

    const producers = graph.resources.filter((r) => rule.matchProducer?.(r, graph));
    const ev = createEvidence({
      adapter: 'architecture-intelligence',
      sourceType: 'inference',
      sourceUri: `data:${rule.id}`,
      confidence: 0.74,
      truthState: 'inferred',
      rationale: `Inferred data asset ${rule.name} from stores and producers`,
      extractedValue: { stores: stores.map((s) => s.id), producers: producers.map((p) => p.id) },
    });
    graph.evidence.push(ev);

    graph.resources.push({
      id,
      logicalId: id,
      kind: 'data-asset',
      subtype: rule.id,
      name: rule.name,
      displayName: rule.name,
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [],
      metadata: {
        classification: rule.classification,
        storeIds: stores.map((s) => s.id),
        producerIds: producers.map((p) => p.id),
      },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({
        score: 0.74,
        reasons: [`Classification ${rule.classification}`, `${stores.length} storage location(s)`],
        missingEvidence: ['explicit data catalogue tags'],
        inferenceMethod: 'deterministic-data-rules',
      }),
      tags: ['data-asset', rule.classification],
      sensitivity: rule.classification,
      layers: ['data'],
    });
    ids.push(id);

    for (const store of stores) {
      graph.edges.push({
        id: stableId(id, 'stores', store.id),
        source: id,
        target: store.id,
        relation: 'stores',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.8, reasons: [`${rule.name} stored in ${store.displayName}`] }),
        findings: [],
        label: 'stored in',
        dataClassifications: [rule.classification],
      });
    }
    for (const producer of producers) {
      graph.edges.push({
        id: stableId(producer.id, 'creates', id),
        source: producer.id,
        target: id,
        relation: 'creates',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.7, reasons: [`${producer.displayName} produces ${rule.name}`] }),
        findings: [],
        label: 'creates',
        dataClassifications: [rule.classification],
      });
    }
  }
  return ids;
}
