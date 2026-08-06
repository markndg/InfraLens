import type { EvidenceGraph, GraphLayer, ResourceNode } from '@infralens/graph-model';

export function layersForResource(resource: ResourceNode): GraphLayer[] {
  const layers = new Set<GraphLayer>();
  const kind = resource.kind;

  if (
    [
      'vpc',
      'subnet',
      'network',
      'security-group',
      'load-balancer',
      'dns',
      'bucket',
      'relational-database',
      'queue',
      'cache',
      'iam-role',
      'iam-policy',
      'function',
      'unknown',
    ].includes(kind) ||
    resource.provider === 'aws' ||
    resource.platform === 'terraform'
  ) {
    layers.add('infrastructure');
  }

  if (
    ['workload', 'service', 'application', 'route', 'ingress', 'gateway', 'config', 'function'].includes(
      kind,
    ) ||
    resource.platform === 'kubernetes' ||
    resource.platform === 'openshift'
  ) {
    layers.add('application');
    layers.add('deployment');
  }

  if (kind === 'business-capability') layers.add('business-capability');
  if (kind === 'data-asset' || ['relational-database', 'bucket', 'queue', 'topic', 'cache', 'storage'].includes(kind)) {
    layers.add('data');
  }
  if (
    ['architectural-decision', 'intent', 'assumption', 'architecture-contract', 'obligation', 'review-record', 'adr'].includes(
      kind,
    )
  ) {
    layers.add('governance');
    if (kind === 'architectural-decision' || kind === 'adr') layers.add('decision');
    if (kind === 'intent') layers.add('intent');
    if (kind === 'assumption') layers.add('assumption');
    if (kind === 'architecture-contract' || kind === 'obligation') layers.add('contract');
  }
  if (kind === 'team' || (resource.ownership?.length ?? 0) > 0) layers.add('ownership');
  if (
    kind === 'trust-zone' ||
    kind === 'network-policy' ||
    kind === 'security-group' ||
    kind === 'secret-ref' ||
    kind === 'iam-role' ||
    kind === 'iam-policy' ||
    kind === 'internet' ||
    kind === 'route' ||
    kind === 'ingress'
  ) {
    layers.add('security');
  }
  if (resource.truthStates.length) layers.add('evidence');
  if (resource.truthStates.includes('historical')) layers.add('time');
  if (resource.findings.length || resource.tags.includes('risk')) layers.add('risk');
  if (resource.metadata.estimatedMonthlyCost != null || resource.tags.includes('cost')) layers.add('cost');

  if (!layers.size) layers.add('infrastructure');
  return [...layers];
}

export function applyLayers(graph: EvidenceGraph): void {
  for (const resource of graph.resources) {
    resource.layers = layersForResource(resource);
  }
}
