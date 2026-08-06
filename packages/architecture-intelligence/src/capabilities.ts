import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import {
  stableId,
  type EvidenceGraph,
  type ResourceEdge,
  type ResourceNode,
} from '@infralens/graph-model';

interface CapabilityRule {
  id: string;
  name: string;
  match: (resource: ResourceNode, graph: EvidenceGraph) => boolean;
  rationale: string;
}

const RULES: CapabilityRule[] = [
  {
    id: 'customer-ordering',
    name: 'Customer Ordering',
    match: (r) =>
      /storefront|shop|cart|checkout|order/i.test(r.name) ||
      /storefront|shop/i.test(JSON.stringify(r.metadata.images ?? '')),
    rationale: 'Matched storefront/order naming and deployment metadata',
  },
  {
    id: 'catalog',
    name: 'Product Catalogue',
    match: (r) => /catalog|product|inventory/i.test(r.name),
    rationale: 'Matched catalog/product service naming',
  },
  {
    id: 'order-processing',
    name: 'Order Processing',
    match: (r) =>
      /worker|processor|fulfill/i.test(r.name) ||
      (r.kind === 'workload' &&
        Object.keys((r.metadata.env as Record<string, string>) ?? {}).some((k) => /QUEUE|SQS|ORDER/i.test(k))),
    rationale: 'Matched asynchronous order worker patterns',
  },
  {
    id: 'payments',
    name: 'Payments',
    match: (r) =>
      /payment|billing|psp/i.test(r.name) ||
      (r.provider === 'external' && /payment/i.test(r.name + JSON.stringify(r.metadata))),
    rationale: 'Matched payment provider or payment-related naming',
  },
  {
    id: 'asset-delivery',
    name: 'Asset Delivery',
    match: (r) =>
      r.kind === 'bucket' ||
      /asset|image|media|cdn/i.test(r.name) ||
      Object.keys((r.metadata.env as Record<string, string>) ?? {}).some((k) => /BUCKET|ASSET/i.test(k)),
    rationale: 'Matched object storage / asset delivery evidence',
  },
  {
    id: 'authentication',
    name: 'Authentication',
    match: (r) => /auth|login|identity|sso|oauth/i.test(r.name),
    rationale: 'Matched authentication naming',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    match: (r) => /notif|mail|email|sms|push/i.test(r.name),
    rationale: 'Matched notification channel naming',
  },
  {
    id: 'observability',
    name: 'Observability',
    match: (r) =>
      r.kind === 'monitoring' || /otel|telemetry|metrics|logging|trace/i.test(r.name + JSON.stringify(r.metadata.env ?? {})),
    rationale: 'Matched observability endpoints or monitoring resources',
  },
  {
    id: 'reporting',
    name: 'Reporting',
    match: (r) => /report|analytics|bi/i.test(r.name),
    rationale: 'Matched reporting/analytics naming',
  },
];

export function inferCapabilities(graph: EvidenceGraph): string[] {
  const now = graph.scan.generatedAt;
  const capabilityIds: string[] = [];

  for (const rule of RULES) {
    const members = graph.resources.filter(
      (r) =>
        !['business-capability', 'data-asset', 'team', 'trust-zone', 'internet'].includes(r.kind) &&
        rule.match(r, graph),
    );
    if (!members.length) continue;

    // Also pull strongly related data/infra for order-processing etc.
    const expanded = expandMembers(graph, members, rule.id);
    const id = stableId('capability', rule.id);
    if (graph.resources.some((r) => r.id === id)) continue;

    const evidence = createEvidence({
      adapter: 'architecture-intelligence',
      sourceType: 'inference',
      sourceUri: `capability:${rule.id}`,
      confidence: 0.78,
      truthState: 'inferred',
      rationale: rule.rationale,
      extractedValue: { capability: rule.name, members: expanded.map((m) => m.id) },
    });
    graph.evidence.push(evidence);

    const node: ResourceNode = {
      id,
      logicalId: id,
      kind: 'business-capability',
      subtype: rule.id,
      name: rule.name,
      displayName: rule.name,
      environment: majority(expanded.map((m) => m.environment)),
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [
        {
          id: `${id}:inferred`,
          truthState: 'inferred',
          attributes: { memberCount: expanded.length },
          evidenceIds: [evidence.id],
        },
      ],
      metadata: {
        inferred: true,
        memberIds: expanded.map((m) => m.id),
        rationale: rule.rationale,
      },
      interfaces: [],
      evidence: [evidence.id],
      findings: [],
      confidence: assessConfidence({
        score: 0.78,
        reasons: [rule.rationale, `${expanded.length} implementing components`],
        missingEvidence: ['explicit capability catalogue annotation'],
        inferenceMethod: 'deterministic-capability-rules',
        wouldIncreaseConfidence: ['Attach capability labels in source metadata'],
      }),
      tags: ['capability', 'inferred'],
      layers: ['business-capability'],
    };
    graph.resources.push(node);
    capabilityIds.push(id);

    for (const member of expanded) {
      const edge: ResourceEdge = {
        id: stableId(id, 'contains', member.id),
        source: id,
        target: member.id,
        relation: 'contains',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [evidence.id],
        confidence: assessConfidence({
          score: 0.75,
          reasons: [`${member.displayName} supports ${rule.name}`],
          inferenceMethod: 'capability-membership',
        }),
        findings: [],
        label: 'implements',
      };
      const impl: ResourceEdge = {
        ...edge,
        id: stableId(member.id, 'implements', id),
        source: member.id,
        target: id,
        relation: 'implements',
        label: 'supports capability',
      };
      if (!graph.edges.some((e) => e.id === edge.id)) graph.edges.push(edge);
      if (!graph.edges.some((e) => e.id === impl.id)) graph.edges.push(impl);
      member.tags = [...new Set([...(member.tags ?? []), `capability:${rule.id}`])];
    }

    void now;
  }

  // Platform umbrella capability
  const platformId = stableId('capability', 'retail-platform');
  if (!graph.resources.some((r) => r.id === platformId) && capabilityIds.length) {
    const ev = createEvidence({
      adapter: 'architecture-intelligence',
      sourceType: 'inference',
      sourceUri: 'capability:retail-platform',
      confidence: 0.7,
      truthState: 'inferred',
      rationale: 'Umbrella platform capability containing inferred domain capabilities',
    });
    graph.evidence.push(ev);
    graph.resources.push({
      id: platformId,
      logicalId: platformId,
      kind: 'business-capability',
      subtype: 'platform',
      name: 'Retail Platform',
      displayName: 'Retail Platform',
      environment: 'production',
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [],
      metadata: { memberCapabilityIds: capabilityIds },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({
        score: 0.7,
        reasons: ['Aggregated from inferred domain capabilities'],
        inferenceMethod: 'platform-rollup',
      }),
      tags: ['capability', 'platform'],
      layers: ['business-capability'],
    });
    for (const capId of capabilityIds) {
      graph.edges.push({
        id: stableId(platformId, 'contains', capId),
        source: platformId,
        target: capId,
        relation: 'contains',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.7, reasons: ['Platform contains capability'] }),
        findings: [],
        label: 'contains',
      });
    }
    capabilityIds.unshift(platformId);
  }

  return capabilityIds;
}

function expandMembers(graph: EvidenceGraph, seeds: ResourceNode[], ruleId: string): ResourceNode[] {
  const ids = new Set(seeds.map((s) => s.id));
  if (ruleId === 'order-processing' || ruleId === 'catalog' || ruleId === 'customer-ordering') {
    for (const seed of seeds) {
      for (const e of graph.edges) {
        if (e.source !== seed.id && e.target !== seed.id) continue;
        const otherId = e.source === seed.id ? e.target : e.source;
        const other = graph.resources.find((r) => r.id === otherId);
        if (!other) continue;
        if (
          ['relational-database', 'queue', 'bucket', 'service', 'workload', 'route'].includes(other.kind) ||
          ['data-read', 'data-write', 'event-publish', 'event-consume', 'connects', 'routes-to', 'service-to-workload'].includes(
            e.relation,
          )
        ) {
          ids.add(other.id);
        }
      }
    }
  }
  return graph.resources.filter((r) => ids.has(r.id));
}

function majority(values: Array<string | undefined>): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
