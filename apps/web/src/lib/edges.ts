import type { CSSProperties } from 'react';
import type { EvidenceGraph, ResourceEdge } from '@infralens/graph-model';

export type ZoomBand = 'far' | 'medium' | 'near';

/** High-chatter relations — hide labels except at near zoom to keep the canvas readable. */
const NOISY_RELATIONS = new Set([
  'supports-capability',
  'contains',
  'implements',
  'implemented-by',
  'owned-by',
  'classified-as',
  'runs-in',
  'protected-by',
  'inferred-relation',
  'configuration-reference',
  'decides',
  'realizes-intent',
  'depends-on-assumption',
  'satisfies-contract',
  'produces-obligation',
  'documents-decision',
]);

export function edgeLabel(edge: ResourceEdge, zoomBand: ZoomBand): string {
  if (zoomBand === 'far') return '';
  if (zoomBand === 'medium' && NOISY_RELATIONS.has(edge.relation)) return '';

  const port = edge.ports?.[0]?.from;
  const protocol = edge.protocol;
  const semantic = semanticRelation(edge);
  const raw = edge.label && !isOpaqueKey(edge.label) ? edge.label : undefined;
  const key = edge.label && isOpaqueKey(edge.label) ? edge.label : undefined;

  if (zoomBand === 'near') {
    const parts = [key, semantic !== key ? semantic : undefined, protocol, port != null ? `:${port}` : undefined]
      .filter(Boolean)
      .join(' · ');
    return parts || semantic;
  }

  // Medium: only concise operational labels
  if (key && protocol) return `${key} · ${protocol}${port != null ? ` :${port}` : ''}`;
  if (raw && protocol) return `${raw} · ${protocol}`;
  if (protocol && port != null) return `${protocol} :${port}`;
  if (['routes-to', 'ingress-route', 'exposes', 'network-blocked', 'data-read', 'data-write', 'event-publish', 'event-consume', 'connects'].includes(edge.relation)) {
    return semantic;
  }
  return '';
}

function isOpaqueKey(label: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(label);
}

function semanticRelation(edge: ResourceEdge): string {
  switch (edge.relation) {
    case 'service-to-workload':
    case 'selector-relationship':
      return 'selects pods';
    case 'routes-to':
    case 'ingress-route':
      return 'routes';
    case 'data-read':
      return 'reads';
    case 'data-write':
      return 'writes';
    case 'event-publish':
      return 'publishes';
    case 'event-consume':
      return 'consumes';
    case 'connects':
      return edge.protocol ? `${edge.protocol}` : 'connects';
    case 'exposes':
      return 'public';
    case 'network-blocked':
      return 'blocked';
    case 'network-reachable':
      return 'reachable';
    case 'configuration-reference':
      return 'config';
    case 'supports-capability':
      return 'supports';
    default:
      return edge.label ?? edge.relation.replace(/-/g, ' ');
  }
}

export function edgeStyle(edge: ResourceEdge): CSSProperties {
  const blocked = edge.effectiveState === 'blocked' || edge.relation === 'network-blocked';
  const inferred = edge.truthStates.includes('inferred') || edge.truthStates.includes('assumed');
  const uncertain = edge.effectiveState === 'unknown' || edge.effectiveState === 'partial';
  const noisy = NOISY_RELATIONS.has(edge.relation);
  return {
    strokeWidth: blocked ? 1.5 : noisy ? 1.5 : 2,
    stroke: blocked
      ? '#c23b4d'
      : uncertain
        ? '#c47a12'
        : inferred
          ? 'rgba(59, 111, 212, 0.55)'
          : noisy
            ? 'rgba(122, 0, 230, 0.28)'
            : 'rgba(122, 0, 230, 0.55)',
    strokeDasharray: blocked ? '4 4' : inferred || uncertain || noisy ? '6 4' : undefined,
    opacity: noisy ? 0.55 : inferred ? 0.75 : 0.9,
  };
}

export function preferHandles(
  edge: ResourceEdge,
  graph: EvidenceGraph,
): { source?: string; target?: string } {
  const source = graph.resources.find((r) => r.id === edge.source);
  const target = graph.resources.find((r) => r.id === edge.target);
  if (
    edge.relation === 'service-to-workload' ||
    edge.relation === 'selector-relationship'
  ) {
    return { source: 'bottom', target: 'top' };
  }
  if (source?.kind === 'internet' || source?.kind === 'route' || source?.kind === 'ingress') {
    return { source: 'right', target: 'left' };
  }
  if (target?.kind === 'external-system' || target?.provider === 'external') {
    return { source: 'right', target: 'left' };
  }
  if (
    target &&
    ['relational-database', 'bucket', 'queue', 'cache'].includes(target.kind)
  ) {
    return { source: 'right', target: 'left' };
  }
  // Capability / ownership links: route above/below to reduce card crossings
  if (
    edge.relation === 'supports-capability' ||
    edge.relation === 'owned-by' ||
    target?.kind === 'business-capability' ||
    source?.kind === 'business-capability'
  ) {
    return { source: 'top', target: 'bottom' };
  }
  return { source: 'right', target: 'left' };
}
