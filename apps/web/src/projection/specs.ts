import type { ArchitectureView, RelationKind, ResourceEdge, ResourceNode } from '@infralens/graph-model';
import { getProjectionContract, type RelationFamily } from './contracts';

/** @deprecated prefer contract.primaryRelationshipFamilies — kept for imports */
export const APPLICATION_RELATIONS = [
  'routes-to',
  'calls',
  'depends-on',
  'uses',
  'selects',
  'publishes',
  'consumes',
  'reads',
  'writes',
  'external-integration',
] as const;

export const SECURITY_RELATIONS = [
  'public-ingress',
  'crosses-boundary',
  'allowed',
  'blocked',
  'authenticated',
  'authorised',
  'encrypted',
  'uses-secret',
  'protects',
] as const;

const ALWAYS_SUPPRESS: Set<RelationKind> = new Set([
  'classified-as',
  'evaluated-by',
  'supersedes',
  'invalidates',
]);

export function isEligibleCanonicalEdge(view: ArchitectureView, edge: ResourceEdge): boolean {
  if (ALWAYS_SUPPRESS.has(edge.relation)) return false;
  const contract = getProjectionContract(view);
  if (!contract.eligibleCanonicalRelations.length) {
    // Evidence view: show nothing as flow edges by default
    return view === 'evidence' ? false : !ALWAYS_SUPPRESS.has(edge.relation);
  }
  return contract.eligibleCanonicalRelations.includes(edge.relation);
}

export function familyForEdge(
  view: ArchitectureView,
  edge: ResourceEdge,
  source: ResourceNode | undefined,
  target: ResourceNode | undefined,
  crossesBoundary: boolean,
): RelationFamily | string {
  if (view === 'application') return applicationFamily(edge, target);
  if (view === 'security') return securityFamily(edge, source, target, crossesBoundary);
  if (view === 'capability') return capabilityFamily(edge);
  if (view === 'data') return dataFamily(edge);
  if (view === 'ownership') return ownershipFamily(edge);
  if (view === 'physical' || view === 'platform') return physicalFamily(edge);
  if (view === 'risk') return riskFamily(edge);
  if (view === 'governance' || view === 'decision' || view === 'signoff') return governanceFamily(edge);
  if (view === 'cost') return 'consumes-cost';
  if (view === 'time' || view === 'drift') return edge.relation === 'drift-relation' ? 'drifted' : 'changed';
  return edge.relation;
}

function applicationFamily(edge: ResourceEdge, target?: ResourceNode): RelationFamily {
  switch (edge.relation) {
    case 'routes-to':
    case 'ingress-route':
    case 'exposes':
      return 'routes-to';
    case 'service-to-workload':
    case 'selector-relationship':
      return 'selects';
    case 'configuration-reference':
      return 'uses';
    case 'connects':
      return target?.kind === 'external-system' || target?.provider === 'external'
        ? 'external-integration'
        : 'calls';
    case 'data-read':
      return 'reads';
    case 'data-write':
      return 'writes';
    case 'event-publish':
      return 'publishes';
    case 'event-consume':
      return 'consumes';
    case 'declared-dependency':
    case 'deployment-dependency':
      return 'depends-on';
    default:
      return 'depends-on';
  }
}

function securityFamily(
  edge: ResourceEdge,
  source?: ResourceNode,
  _target?: ResourceNode,
  crossesBoundary?: boolean,
): RelationFamily | string {
  if (edge.relation === 'exposes') return 'public-ingress';
  if (edge.relation === 'network-reachable') return 'allowed';
  if (edge.relation === 'network-blocked' || edge.relation === 'iam-denied') return 'blocked';
  if (edge.relation === 'iam-authorised') return 'authorised';
  if (edge.relation === 'secret-reference') return 'uses-secret';
  if (edge.relation === 'protected-by') {
    if (source?.kind === 'network-policy' || source?.kind === 'security-group') return 'protects';
    return 'protects';
  }
  if (crossesBoundary) return 'crosses-boundary';
  if (edge.effectiveState === 'blocked') return 'blocked';
  if (edge.effectiveState === 'allowed') return 'allowed';
  if (edge.relation === 'routes-to' || edge.relation === 'ingress-route') return 'public-ingress';
  if (edge.protocol && /tls|https/i.test(edge.protocol)) return 'encrypted';
  return edge.relation;
}

function capabilityFamily(edge: ResourceEdge): RelationFamily {
  if (edge.relation === 'supports-capability') return 'supports';
  if (edge.relation === 'implements' || edge.relation === 'implemented-by') return 'implements';
  if (edge.relation === 'contains') return 'uses';
  return 'depends-on';
}

function dataFamily(edge: ResourceEdge): RelationFamily {
  if (edge.relation === 'creates') return 'creates';
  if (edge.relation === 'transforms') return 'transforms';
  if (edge.relation === 'data-read' || edge.relation === 'consumes-data') return 'reads';
  if (edge.relation === 'data-write' || edge.relation === 'stores') return 'writes';
  if (edge.relation === 'event-publish') return 'exports';
  return 'reads';
}

function ownershipFamily(edge: ResourceEdge): RelationFamily {
  if (edge.relation === 'owned-by' || edge.relation === 'ownership-relation') return 'owns';
  if (edge.relation === 'supports-capability') return 'supports';
  return 'depends-on';
}

function physicalFamily(edge: ResourceEdge): RelationFamily {
  if (edge.relation === 'implements' || edge.relation === 'implemented-by') return 'implements';
  if (edge.relation === 'runs-in' || edge.relation === 'contains') return 'hosts';
  if (edge.relation === 'service-to-workload') return 'attached-to';
  if (edge.relation === 'routes-to' || edge.relation === 'exposes') return 'network';
  return 'hosts';
}

function riskFamily(edge: ResourceEdge): RelationFamily {
  if (edge.relation === 'violates-contract') return 'amplifies';
  if (edge.relation === 'depends-on-assumption') return 'depends-on';
  if (edge.relation === 'exposes') return 'amplifies';
  return 'depends-on';
}

function governanceFamily(edge: ResourceEdge): RelationFamily {
  if (edge.relation === 'satisfies-contract') return 'validated';
  if (edge.relation === 'violates-contract') return 'violated';
  if (edge.relation === 'decides' || edge.relation === 'documents-decision') return 'approved';
  return 'validated';
}

export function aggregateKey(sourceId: string, targetId: string, family: string): string {
  return `${sourceId}→${targetId}::${family}`;
}
