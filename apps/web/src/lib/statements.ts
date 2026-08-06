import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import { assignLane } from './lanes';

export interface StatementClause {
  text: string;
  evidenceIds: string[];
  edgeIds: string[];
}

export function architecturalRole(resource: ResourceNode, graph: EvidenceGraph): string {
  const lane = assignLane(resource, graph);
  const roles: Record<string, string> = {
    actors: 'External actor / traffic source',
    'public-edge': 'Public ingress endpoint',
    routing: 'Service routing layer',
    frontend: 'Frontend / edge-facing workload',
    application: 'Application service',
    processing: 'Asynchronous worker',
    data: 'Data or messaging store',
    integration: 'External dependency',
    observability: 'Observability component',
    platform: 'Platform control',
    unknown: 'Unclassified component',
  };
  return roles[lane] ?? 'Component';
}

export function generateArchitecturalStatement(
  resource: ResourceNode,
  graph: EvidenceGraph,
): { statement: string; clauses: StatementClause[] } {
  const inbound = graph.edges.filter((e) => e.target === resource.id);
  const outbound = graph.edges.filter((e) => e.source === resource.id);
  const clauses: StatementClause[] = [];
  const parts: string[] = [];

  const name = resource.displayName;

  const fromPublic = inbound.filter((e) => {
    const s = graph.resources.find((r) => r.id === e.source);
    return s && (s.kind === 'route' || s.kind === 'ingress' || s.kind === 'internet' || s.kind === 'service');
  });
  if (fromPublic.length) {
    const sources = uniqueNames(fromPublic.map((e) => graph.resources.find((r) => r.id === e.source)!));
    const text = `${name} receives traffic from ${sources.join(', ')}`;
    parts.push(text);
    clauses.push({
      text,
      evidenceIds: fromPublic.flatMap((e) => e.evidence),
      edgeIds: fromPublic.map((e) => e.id),
    });
  }

  const dataOut = outbound.filter((e) =>
    ['data-read', 'data-write', 'connects', 'event-publish', 'event-consume'].includes(e.relation),
  );
  for (const group of [
    { rel: ['data-read', 'connects'], verb: 'reads' },
    { rel: ['data-write'], verb: 'writes to' },
    { rel: ['event-publish'], verb: 'publishes to' },
    { rel: ['event-consume'], verb: 'consumes from' },
  ] as const) {
    const edges = dataOut.filter((e) => (group.rel as readonly string[]).includes(e.relation));
    if (!edges.length) continue;
    const targets = uniqueNames(edges.map((e) => graph.resources.find((r) => r.id === e.target)!).filter(Boolean));
    const text = `${group.verb} ${targets.join(', ')}`;
    parts.push(text);
    clauses.push({
      text,
      evidenceIds: edges.flatMap((e) => e.evidence),
      edgeIds: edges.map((e) => e.id),
    });
  }

  const external = outbound.filter((e) => {
    const t = graph.resources.find((r) => r.id === e.target);
    return t?.provider === 'external' || t?.kind === 'external-system';
  });
  if (external.length) {
    const targets = uniqueNames(external.map((e) => graph.resources.find((r) => r.id === e.target)!));
    const inferred = external.every((e) => e.truthStates.includes('inferred'));
    const text = inferred
      ? `has ${external.length} inferred external dependenc${external.length === 1 ? 'y' : 'ies'} (${targets.join(', ')})`
      : `depends on external system${targets.length > 1 ? 's' : ''} ${targets.join(', ')}`;
    parts.push(text);
    clauses.push({
      text,
      evidenceIds: external.flatMap((e) => e.evidence),
      edgeIds: external.map((e) => e.id),
    });
  }

  const selectedBy = inbound.filter(
    (e) => e.relation === 'service-to-workload' || e.relation === 'selector-relationship',
  );
  if (selectedBy.length && resource.kind === 'workload') {
    const services = uniqueNames(selectedBy.map((e) => graph.resources.find((r) => r.id === e.source)!));
    const text = `is selected by ${services.join(', ')}`;
    parts.push(text);
    clauses.push({
      text,
      evidenceIds: selectedBy.flatMap((e) => e.evidence),
      edgeIds: selectedBy.map((e) => e.id),
    });
  }

  if (!parts.length) {
    const role = architecturalRole(resource, graph);
    const text = `${name} is a ${role.toLowerCase()} with no resolved application dependencies in the current view.`;
    return {
      statement: text,
      clauses: [{ text, evidenceIds: resource.evidence, edgeIds: [] }],
    };
  }

  // Compose: "Catalog receives …, reads …, and publishes …"
  const composed =
    parts.length === 1
      ? `${name} ${parts[0].startsWith(name) ? parts[0].slice(name.length).trim() : parts[0]}.`
      : `${name} ${parts
          .map((p, i) => {
            const clause = p.startsWith(name) ? p.slice(name.length).trim() : p;
            if (i === 0) return clause;
            if (i === parts.length - 1) return `and ${clause}`;
            return clause;
          })
          .join(', ')}.`;

  return { statement: composed.replace(/\s+/g, ' '), clauses };
}

function uniqueNames(nodes: ResourceNode[]): string[] {
  return [...new Set(nodes.filter(Boolean).map((n) => n.displayName))];
}
