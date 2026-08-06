import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import { computeBusinessBlastRadius } from './blast.js';

export interface ComponentReasoning {
  resourceId: string;
  what: string;
  why: string;
  capabilities: string[];
  owners: string[];
  dataHandled: string[];
  dependents: string[];
  blastIfRemoved: string[];
  risks: string[];
  approvalsAffected: string[];
  certainty: string;
  evidenceIds: string[];
  missing: string[];
}

function nameOf(graph: EvidenceGraph, id: string): string {
  return graph.resources.find((r) => r.id === id)?.displayName ?? id;
}

export function reasonAboutComponent(graph: EvidenceGraph, resourceId: string): ComponentReasoning {
  const node = graph.resources.find((r) => r.id === resourceId);
  if (!node) {
    return {
      resourceId,
      what: 'Unknown component',
      why: 'No matching node in the evidence graph.',
      capabilities: [],
      owners: [],
      dataHandled: [],
      dependents: [],
      blastIfRemoved: [],
      risks: [],
      approvalsAffected: [],
      certainty: 'Unknown',
      evidenceIds: [],
      missing: ['resource not present'],
    };
  }

  const caps = graph.edges
    .filter((e) => e.source === resourceId && (e.relation === 'implements' || e.relation === 'supports-capability'))
    .map((e) => nameOf(graph, e.target));
  const owners =
    node.ownership?.map((o) => o.team ?? o.owner ?? 'unknown').filter(Boolean) ??
    graph.edges
      .filter((e) => e.source === resourceId && e.relation === 'owned-by')
      .map((e) => nameOf(graph, e.target));
  const dataHandled = graph.edges
    .filter(
      (e) =>
        (e.source === resourceId || e.target === resourceId) &&
        ['creates', 'stores', 'consumes-data', 'transforms', 'data-read', 'data-write'].includes(e.relation),
    )
    .map((e) => {
      const other = e.source === resourceId ? e.target : e.source;
      return nameOf(graph, other);
    });
  const dependents = graph.edges
    .filter((e) => e.target === resourceId && e.source !== resourceId)
    .map((e) => nameOf(graph, e.source));
  const blast = computeBusinessBlastRadius(graph, resourceId);
  const findings = graph.findings.filter((f) => f.affectedResources.includes(resourceId) && f.status === 'open');
  const approvals = graph.signOffs.filter(
    (s) => s.decision === 'Approved' || s.decision === 'Approved with Waivers',
  );

  const truth = node.truthStates[0] ?? 'unknown';
  const certaintyMap: Record<string, string> = {
    known: 'Known',
    observed: 'Observed',
    declared: 'Declared',
    rendered: 'Rendered',
    inferred: 'Inferred',
    unknown: 'Unknown',
    conflicting: 'Conflicting',
    historical: 'Historical',
  };

  return {
    resourceId,
    what: `${node.displayName} is a ${node.kind}${node.subtype ? ` (${node.subtype})` : ''}${node.provider ? ` on ${node.provider}` : ''}.`,
    why: whyExists(node, caps),
    capabilities: [...new Set(caps)],
    owners: [...new Set(owners)],
    dataHandled: [...new Set(dataHandled)],
    dependents: [...new Set(dependents)].slice(0, 20),
    blastIfRemoved: [
      ...blast.capabilities.map((id) => `Capability: ${nameOf(graph, id)}`),
      ...blast.applications.slice(0, 8).map((id) => `App: ${nameOf(graph, id)}`),
      ...blast.dataAssets.slice(0, 8).map((id) => `Data: ${nameOf(graph, id)}`),
      blast.publicUsersAffected ? 'Public users may be affected' : 'No public edge in radius',
    ],
    risks: findings.map((f) => `${f.severity}: ${f.title}`),
    approvalsAffected: approvals.length
      ? [`${approvals.length} approved sign-off(s) may require revalidation if material`]
      : ['No approved sign-offs linked'],
    certainty: certaintyMap[truth] ?? String(truth),
    evidenceIds: node.evidence,
    missing: node.confidence.missingEvidence ?? [],
  };
}

function whyExists(node: ResourceNode, caps: string[]): string {
  if (caps.length) return `Supports ${caps.join(', ')}.`;
  if (node.kind === 'route' || node.kind === 'ingress') return 'Exposes application traffic at the public edge.';
  if (node.kind === 'relational-database') return 'Persists application state.';
  if (node.kind === 'queue') return 'Decouples asynchronous processing.';
  if (node.kind === 'bucket') return 'Stores object/binary assets.';
  if (node.kind === 'business-capability') return 'Logical architectural intent inferred from implementing components.';
  if (node.kind === 'data-asset') return 'First-class data value inferred from stores and producers.';
  if (node.kind === 'team') return 'Ownership domain for related resources.';
  if (node.kind === 'trust-zone') return 'Security/trust boundary grouping.';
  return node.confidence.reasons?.[0] ?? 'Present in the evidence graph from discovery adapters.';
}
