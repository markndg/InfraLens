import type { EvidenceGraph, ResourceEdge, ResourceNode } from '@infralens/graph-model';
import type { RelationFamily } from './contracts';

/**
 * Architectural edge labels — intent first, implementation second.
 */
export function architecturalEdgeLabel(
  graph: EvidenceGraph,
  edge: ResourceEdge,
  family: string,
  target?: ResourceNode,
  opts?: { crossesBoundary?: boolean; aggregateCount?: number },
): string {
  const lines: string[] = [];
  const intent = intentLine(family as RelationFamily, edge, target);
  if (intent) lines.push(intent);

  const impl = implementationLine(edge, target);
  if (impl && impl !== intent) lines.push(impl);

  if (opts?.crossesBoundary) lines.push('Cross-zone');
  if (edge.effectiveState === 'allowed') lines.push('Allowed');
  if (edge.effectiveState === 'blocked') lines.push('Blocked');
  if (edge.effectiveState === 'unknown' && family.includes('network')) lines.push('Unknown');

  const auth = authenticationHint(edge);
  if (auth) lines.push(auth);

  const dataClass = dataClassificationHint(graph, edge, target);
  if (dataClass) lines.push(dataClass);

  if (opts?.aggregateCount && opts.aggregateCount > 1) {
    lines.push(`${opts.aggregateCount} relationships`);
  }

  return lines.filter(Boolean).join(' · ');
}

function intentLine(family: RelationFamily | string, edge: ResourceEdge, target?: ResourceNode): string {
  switch (family) {
    case 'calls':
      return target ? `Calls ${friendlyName(target)}` : 'Calls';
    case 'depends-on':
      return 'Depends on';
    case 'uses':
    case 'configured-to-use':
      return target ? `Uses ${friendlyName(target)}` : 'Uses';
    case 'reads':
      return target ? `Reads ${friendlyName(target)}` : 'Reads';
    case 'writes':
      return target ? `Writes ${friendlyName(target)}` : 'Writes';
    case 'publishes':
      return target ? `Publishes to ${friendlyName(target)}` : 'Publishes';
    case 'consumes':
      return target ? `Consumes ${friendlyName(target)}` : 'Consumes';
    case 'external-integration':
      return target ? `Integrates with ${friendlyName(target)}` : 'External integration';
    case 'routes-to':
    case 'public-ingress':
      return 'Public ingress';
    case 'selects':
      return 'Implements';
    case 'protects':
    case 'protected-by-network-policy':
    case 'protected-by-security-group':
      return 'Protects';
    case 'authorised':
    case 'authorized-by-iam':
      return 'Authorises';
    case 'uses-secret':
      return 'Uses secret';
    case 'crosses-boundary':
    case 'crosses-trust-boundary':
      return 'Crosses trust boundary';
    case 'encrypted':
    case 'encrypted-flow':
      return 'Encrypted';
    case 'owns':
      return 'Owns';
    case 'supports':
      return 'Supports';
    case 'implements':
      return 'Implements';
    case 'creates':
      return 'Creates';
    case 'transforms':
      return 'Transforms';
    default:
      return humanize(family);
  }
}

function implementationLine(edge: ResourceEdge, target?: ResourceNode): string | undefined {
  const parts: string[] = [];
  if (edge.protocol) parts.push(edge.protocol.toUpperCase());
  if (edge.port != null) parts.push(String(edge.port));

  const label = String(edge.label ?? '');
  if (/JDBC|POSTGRES|MYSQL|DB_/i.test(label) || edge.port === 5432) {
    const db = target?.displayName ?? 'Database';
    return `${db} · TCP ${edge.port ?? 5432}`;
  }
  if (/SQS|QUEUE|ORDER_QUEUE/i.test(label) || target?.kind === 'queue') {
    return `${target?.displayName ?? 'Events'} · SQS`;
  }
  if (/BUCKET|S3|ASSET/i.test(label) || target?.kind === 'bucket') {
    return `${target?.displayName ?? 'Object store'} · S3`;
  }
  if (/HTTPS|TLS/i.test(label) || /HTTPS|TLS/i.test(edge.protocol ?? '')) {
    return parts.length ? parts.join(' ') : 'HTTPS';
  }
  if (parts.length) return parts.join(' ');
  if (label && !/^https?:/i.test(label) && label.length < 28) return label;
  return undefined;
}

function authenticationHint(edge: ResourceEdge): string | undefined {
  const blob = `${edge.protocol ?? ''} ${edge.label ?? ''} ${(edge.confidence.reasons ?? []).join(' ')}`;
  if (/tls|https|mtls|oauth|oidc|authenticated/i.test(blob)) return 'Authenticated';
  return undefined;
}

function dataClassificationHint(
  graph: EvidenceGraph,
  edge: ResourceEdge,
  target?: ResourceNode,
): string | undefined {
  const asset = graph.resources.find(
    (r) =>
      r.kind === 'data-asset' &&
      (r.id === edge.target ||
        r.id === edge.source ||
        (target && String(r.metadata.memberIds ?? '').includes(target.id))),
  );
  const cls = String(asset?.metadata.classification ?? asset?.metadata.sensitivity ?? '');
  if (/customer|pii|personal/i.test(cls + (asset?.name ?? ''))) return 'Customer data';
  if (/payment|pci/i.test(cls + (asset?.name ?? ''))) return 'Payment data';
  if (cls) return cls;
  return undefined;
}

function friendlyName(r: ResourceNode): string {
  if (r.kind === 'relational-database') return r.displayName.replace(/^retail-/, '').replace(/-/g, ' ');
  if (r.kind === 'queue') return r.displayName.replace(/^retail-/, '').replace(/-/g, ' ');
  if (r.kind === 'bucket') return r.displayName.replace(/^retail-/, '').replace(/-/g, ' ');
  return r.displayName;
}

function humanize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
