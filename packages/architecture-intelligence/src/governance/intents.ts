import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import {
  stableId,
  type EvidenceGraph,
  type IntentSatisfaction,
  type ResourceNode,
} from '@infralens/graph-model';

export interface IntentDef {
  id: string;
  name: string;
  description: string;
}

export const DEFAULT_INTENTS: IntentDef[] = [
  { id: 'highly-available', name: 'Highly Available', description: 'Survive AZ and replica failures' },
  { id: 'private-api', name: 'Private API', description: 'APIs not unnecessarily public' },
  { id: 'stateless-service', name: 'Stateless Service', description: 'Compute without sticky local state' },
  { id: 'zero-trust', name: 'Zero Trust', description: 'Explicit trust boundaries and least privilege' },
  { id: 'encrypted-storage', name: 'Encrypted Storage', description: 'Data encrypted at rest' },
  { id: 'internal-only', name: 'Internal Only', description: 'No public internet exposure' },
  { id: 'event-driven', name: 'Event Driven', description: 'Async decoupling via events/queues' },
  { id: 'low-cost', name: 'Low Cost', description: 'Cost-conscious resource choices' },
  { id: 'portable', name: 'Portable', description: 'Platform-portable workloads' },
  { id: 'observable', name: 'Observable', description: 'Monitoring and telemetry present' },
  { id: 'least-privilege', name: 'Least Privilege', description: 'Minimal identity permissions' },
];

export function ensureIntents(graph: EvidenceGraph, declared?: string[]): string[] {
  const wanted = new Set(
    declared?.length
      ? declared
      : graph.declaredIntents?.length
        ? graph.declaredIntents
        : ['highly-available', 'encrypted-storage', 'event-driven', 'observable', 'least-privilege', 'portable'],
  );
  graph.declaredIntents = [...wanted];
  const ids: string[] = [];
  for (const def of DEFAULT_INTENTS.filter((i) => wanted.has(i.id))) {
    const id = stableId('intent', def.id);
    ids.push(id);
    if (graph.resources.some((r) => r.id === id)) continue;
    const ev = createEvidence({
      adapter: 'governance-intent',
      sourceType: 'inference',
      sourceUri: `intent:${def.id}`,
      confidence: 0.7,
      truthState: 'declared',
      rationale: `Declared architectural intent: ${def.name}`,
    });
    graph.evidence.push(ev);
    graph.resources.push({
      id,
      logicalId: id,
      kind: 'intent',
      subtype: def.id,
      name: def.name,
      displayName: def.name,
      lifecycle: 'active',
      truthStates: ['declared'],
      instances: [],
      metadata: { description: def.description, satisfaction: 'unknown' },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({ score: 0.7, reasons: [def.description] }),
      tags: ['intent'],
      layers: ['governance', 'intent'],
    });
  }

  // Link decisions → intents
  for (const decision of graph.resources.filter((r) => r.kind === 'architectural-decision')) {
    const related = (decision.metadata.relatedIntentIds as string[] | undefined) ?? [];
    for (const intentKey of related) {
      const intentId = stableId('intent', intentKey);
      if (!graph.resources.some((r) => r.id === intentId)) continue;
      const edgeId = stableId(decision.id, 'realizes-intent', intentId);
      if (graph.edges.some((e) => e.id === edgeId)) continue;
      graph.edges.push({
        id: edgeId,
        source: decision.id,
        target: intentId,
        relation: 'realizes-intent',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: decision.evidence,
        confidence: assessConfidence({ score: 0.7, reasons: [`${decision.displayName} realizes ${intentKey}`] }),
        findings: [],
        label: 'realizes',
      });
    }
  }
  return ids;
}

export function validateIntents(graph: EvidenceGraph): Array<{
  intentId: string;
  satisfaction: IntentSatisfaction;
  reasons: string[];
}> {
  const results = [];
  for (const intent of graph.resources.filter((r) => r.kind === 'intent')) {
    const key = intent.subtype ?? '';
    const { satisfaction, reasons } = evaluateIntent(graph, key, intent);
    intent.metadata.satisfaction = satisfaction;
    intent.metadata.satisfactionReasons = reasons;
    if (satisfaction === 'drifted' || satisfaction === 'violated') {
      intent.tags = [...new Set([...(intent.tags ?? []), 'intent-drift'])];
    }
    results.push({ intentId: intent.id, satisfaction, reasons });
  }
  return results;
}

function evaluateIntent(
  graph: EvidenceGraph,
  key: string,
  intent: ResourceNode,
): { satisfaction: IntentSatisfaction; reasons: string[] } {
  const reasons: string[] = [];
  switch (key) {
    case 'highly-available': {
      const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
      const bad = dbs.filter((d) => d.metadata.multi_az === false || d.metadata.multiAz === false);
      if (!dbs.length) return { satisfaction: 'unknown', reasons: ['No databases to evaluate HA'] };
      if (bad.length) {
        reasons.push(`${bad.map((b) => b.displayName).join(', ')} single-AZ`);
        return { satisfaction: 'violated', reasons };
      }
      return { satisfaction: 'satisfied', reasons: ['Databases meet multi-AZ expectation'] };
    }
    case 'private-api':
    case 'internal-only': {
      const routes = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
      if (!routes.length) return { satisfaction: 'satisfied', reasons: ['No public ingress'] };
      reasons.push(`${routes.length} public path(s): ${routes.map((r) => r.displayName).join(', ')}`);
      return { satisfaction: key === 'internal-only' ? 'violated' : 'drifted', reasons };
    }
    case 'event-driven': {
      const ok = graph.resources.some((r) => r.kind === 'queue');
      return ok
        ? { satisfaction: 'satisfied', reasons: ['Queue/event resources present'] }
        : { satisfaction: 'drifted', reasons: ['No queue resources for event-driven intent'] };
    }
    case 'observable': {
      const ok =
        graph.resources.some((r) => r.kind === 'monitoring') ||
        graph.resources.some((r) => /otel|telemetry|metrics/i.test(r.name));
      return ok
        ? { satisfaction: 'satisfied', reasons: ['Observability endpoints/resources found'] }
        : { satisfaction: 'partial', reasons: ['Limited observability evidence'] };
    }
    case 'encrypted-storage': {
      const stores = graph.resources.filter((r) =>
        ['relational-database', 'bucket'].includes(r.kind),
      );
      if (!stores.length) return { satisfaction: 'unknown', reasons: ['No storage resources'] };
      const unknown = stores.filter((s) => s.metadata.encrypted == null && s.metadata.encryption == null);
      if (unknown.length === stores.length) {
        return { satisfaction: 'unknown', reasons: ['Encryption not evidenced in graph metadata'] };
      }
      return { satisfaction: 'partial', reasons: ['Some storage encryption metadata present'] };
    }
    case 'portable': {
      const oc = graph.resources.some((r) => r.platform === 'openshift' || r.platform === 'kubernetes');
      return oc
        ? { satisfaction: 'satisfied', reasons: ['Workloads on portable container platform'] }
        : { satisfaction: 'unknown', reasons: ['Portability evidence incomplete'] };
    }
    case 'least-privilege': {
      const iam = graph.resources.filter((r) => r.kind === 'iam-role' || r.kind === 'iam-policy');
      return iam.length
        ? { satisfaction: 'partial', reasons: [`${iam.length} IAM objects — effective privilege not proven`] }
        : { satisfaction: 'unknown', reasons: ['No IAM evidence'] };
    }
    case 'stateless-service': {
      const workers = graph.resources.filter((r) => r.kind === 'workload');
      return workers.length
        ? { satisfaction: 'partial', reasons: ['Workloads present; local state not disproven'] }
        : { satisfaction: 'unknown', reasons: ['No workloads'] };
    }
    case 'zero-trust': {
      const zones = graph.resources.filter((r) => r.kind === 'trust-zone');
      return zones.length
        ? { satisfaction: 'partial', reasons: [`${zones.length} trust zones inferred`] }
        : { satisfaction: 'unknown', reasons: ['Trust zones not established'] };
    }
    case 'low-cost':
      return { satisfaction: 'unknown', reasons: ['Cost snapshots not fully evaluated'] };
    default:
      return { satisfaction: 'unknown', reasons: [`No dedicated validator for ${intent.displayName}`] };
  }
}
