import type {
  ArchitectureView,
  EvidenceGraph,
  RelationKind,
  ResourceEdge,
  ResourceNode,
} from '@infralens/graph-model';

/** Architectural relationship families used in projection contracts. */
export type RelationFamily =
  | 'supports'
  | 'depends-on'
  | 'uses'
  | 'implements'
  | 'calls'
  | 'publishes'
  | 'consumes'
  | 'reads'
  | 'writes'
  | 'external-integration'
  | 'routes-to'
  | 'selects'
  | 'hosts'
  | 'attached-to'
  | 'network'
  | 'storage'
  | 'creates'
  | 'transforms'
  | 'replicates'
  | 'archives'
  | 'exports'
  | 'owns'
  | 'shared-ownership'
  | 'public-ingress'
  | 'crosses-boundary'
  | 'allowed'
  | 'blocked'
  | 'authenticated'
  | 'authorised'
  | 'encrypted'
  | 'uses-secret'
  | 'protects'
  | 'causes'
  | 'amplifies'
  | 'mitigates'
  | 'consumes-cost'
  | 'shared-cost'
  | 'unused'
  | 'duplicated'
  | 'introduced'
  | 'removed'
  | 'changed'
  | 'drifted'
  | 'validated'
  | 'violated'
  | 'approved'
  | 'waived'
  | 'signoff-blocked';

export type SemanticKind =
  | 'application'
  | 'logical-application'
  | 'app-stack'
  | 'platform'
  | 'network'
  | 'environment'
  | 'capability'
  | 'trust'
  | 'lane'
  | 'data-domain'
  | 'team'
  | 'risk-domain'
  | 'cost-domain'
  | 'review-period'
  | 'review'
  | 'security-controls'
  | 'technology';

export type ProjectionSummaryFn = (
  graph: EvidenceGraph,
  resources: ResourceNode[],
  edges: ResourceEdge[],
) => string;

export interface ProjectionContract {
  id: ArchitectureView;
  title: string;
  architecturalQuestion: string;
  /** One-line UX cue shown with the question */
  purpose: string;
  primaryContainment: SemanticKind;
  primaryRelationshipFamilies: RelationFamily[];
  /** Canonical evidence relations eligible for this projection */
  eligibleCanonicalRelations: RelationKind[];
  /** Kinds treated as secondary metadata (badges/filters), never containment */
  secondaryMetadata: SemanticKind[];
  summaryGenerator: ProjectionSummaryFn;
}

function countKinds(resources: ResourceNode[], kinds: string[]): number {
  return resources.filter((r) => kinds.includes(r.kind)).length;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const PROJECTION_CONTRACTS: Record<ArchitectureView, ProjectionContract> = {
  capability: {
    id: 'capability',
    title: 'Capability',
    architecturalQuestion: 'What business capabilities exist?',
    purpose: 'What the business does.',
    primaryContainment: 'capability',
    primaryRelationshipFamilies: ['supports', 'depends-on', 'uses', 'implements'],
    eligibleCanonicalRelations: [
      'supports-capability',
      'implements',
      'implemented-by',
      'contains',
      'connects',
      'routes-to',
      'event-publish',
      'data-read',
      'data-write',
    ],
    secondaryMetadata: ['technology', 'environment', 'platform'],
    summaryGenerator: (graph, resources, edges) => {
      const caps = countKinds(resources, ['business-capability']);
      return `${plural(caps, 'business capability', 'business capabilities')} with ${plural(edges.length, 'supporting relationship')}.`;
    },
  },

  application: {
    id: 'application',
    title: 'Application',
    architecturalQuestion: 'How do applications communicate?',
    purpose: 'How software communicates.',
    primaryContainment: 'logical-application',
    primaryRelationshipFamilies: [
      'calls',
      'depends-on',
      'publishes',
      'consumes',
      'reads',
      'writes',
      'external-integration',
      'routes-to',
      'selects',
    ],
    eligibleCanonicalRelations: [
      'routes-to',
      'ingress-route',
      'service-to-workload',
      'configuration-reference',
      'connects',
      'data-read',
      'data-write',
      'event-publish',
      'event-consume',
      'exposes',
      'declared-dependency',
      'deployment-dependency',
      'selector-relationship',
    ],
    secondaryMetadata: ['technology', 'environment', 'platform'],
    summaryGenerator: (_g, resources, edges) => {
      const apps = new Set(
        resources
          .filter((r) => ['application', 'workload', 'service'].includes(r.kind))
          .map((r) => r.name),
      );
      return `${plural(apps.size, 'logical application')} communicate through ${plural(edges.length, 'service dependency', 'service dependencies')}.`;
    },
  },

  physical: {
    id: 'physical',
    title: 'Physical',
    architecturalQuestion: 'What infrastructure implements this architecture?',
    purpose: 'What runs where.',
    primaryContainment: 'platform',
    primaryRelationshipFamilies: ['implements', 'hosts', 'attached-to', 'network', 'storage'],
    eligibleCanonicalRelations: [
      'implements',
      'implemented-by',
      'runs-in',
      'contains',
      'connects',
      'routes-to',
      'ingress-route',
      'service-to-workload',
      'exposes',
    ],
    secondaryMetadata: ['environment', 'technology'],
    summaryGenerator: (_g, resources, edges) => {
      const compute = countKinds(resources, ['workload', 'service', 'route', 'ingress', 'load-balancer']);
      return `${plural(compute, 'compute resource')} across ${plural(
        new Set(resources.map((r) => r.platform || r.provider || 'unknown')).size,
        'platform',
      )} with ${plural(edges.length, 'infrastructure link')}.`;
    },
  },

  data: {
    id: 'data',
    title: 'Data',
    architecturalQuestion: 'Where does data move?',
    purpose: 'How information moves.',
    primaryContainment: 'data-domain',
    primaryRelationshipFamilies: [
      'creates',
      'reads',
      'writes',
      'transforms',
      'replicates',
      'archives',
      'exports',
    ],
    eligibleCanonicalRelations: [
      'creates',
      'stores',
      'transforms',
      'consumes-data',
      'data-read',
      'data-write',
      'event-publish',
      'event-consume',
      'connects',
    ],
    secondaryMetadata: ['technology', 'environment', 'platform'],
    summaryGenerator: (_g, resources, edges) => {
      const assets = countKinds(resources, ['data-asset']);
      const stores = countKinds(resources, ['relational-database', 'bucket', 'queue', 'cache', 'storage']);
      const external = countKinds(resources, ['external-system']);
      return `${plural(assets, 'data asset')} traverse ${plural(stores, 'store')} and ${plural(external, 'external system')}.`;
    },
  },

  ownership: {
    id: 'ownership',
    title: 'Ownership',
    architecturalQuestion: 'Who owns what?',
    purpose: 'Who is responsible.',
    primaryContainment: 'team',
    primaryRelationshipFamilies: ['owns', 'supports', 'depends-on', 'shared-ownership'],
    eligibleCanonicalRelations: ['owned-by', 'ownership-relation', 'supports-capability', 'connects'],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (graph, resources, edges) => {
      const teams = countKinds(resources, ['team']);
      const owned = resources.filter((r) => r.kind !== 'team');
      const orphans = owned.filter((r) => r.tags.includes('orphaned-ownership') || !r.ownership?.length);
      return `${plural(teams, 'team')} own ${plural(owned.length, 'resource')}. ${plural(orphans.length, 'asset')} ${orphans.length === 1 ? 'has' : 'have'} no owner.`;
    },
  },

  security: {
    id: 'security',
    title: 'Security',
    architecturalQuestion: 'How does trust flow?',
    purpose: 'How trust is enforced.',
    primaryContainment: 'trust',
    primaryRelationshipFamilies: [
      'public-ingress',
      'crosses-boundary',
      'allowed',
      'blocked',
      'authenticated',
      'authorised',
      'encrypted',
      'uses-secret',
      'protects',
    ],
    eligibleCanonicalRelations: [
      'exposes',
      'routes-to',
      'ingress-route',
      'network-reachable',
      'network-blocked',
      'protected-by',
      'iam-authorised',
      'iam-denied',
      'secret-reference',
      'connects',
      'data-read',
      'data-write',
      'event-publish',
      'event-consume',
      'service-to-workload',
      'configuration-reference',
    ],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (graph, resources, edges) => {
      const publicEntry = edges.filter(
        (e) => e.relation === 'exposes' || e.relation === 'routes-to' || e.relation === 'ingress-route',
      ).length;
      const zones = graph.resources.filter((r) => r.kind === 'trust-zone').length;
      const cross = edges.filter((e) => {
        const zs = zoneOf(graph, e.source);
        const zt = zoneOf(graph, e.target);
        return zs && zt && zs !== zt;
      }).length;
      return `${plural(publicEntry, 'public entry point')}, ${plural(zones, 'trust zone')}, ${plural(cross, 'cross-zone flow')}.`;
    },
  },

  risk: {
    id: 'risk',
    title: 'Risk',
    architecturalQuestion: 'What is most likely to fail?',
    purpose: 'What keeps me awake.',
    primaryContainment: 'risk-domain',
    primaryRelationshipFamilies: ['causes', 'depends-on', 'amplifies', 'mitigates'],
    eligibleCanonicalRelations: [
      'connects',
      'routes-to',
      'exposes',
      'depends-on-assumption',
      'violates-contract',
      'data-read',
      'data-write',
      'event-publish',
    ],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (graph, resources, edges) => {
      const critical = graph.findings.filter((f) => f.severity === 'critical' && f.status === 'open').length;
      const high = graph.findings.filter((f) => f.severity === 'high' && f.status === 'open').length;
      return `${plural(critical + high, 'elevated finding')} across ${plural(resources.length, 'risk-relevant node')}; ${plural(edges.length, 'risk path')}.`;
    },
  },

  cost: {
    id: 'cost',
    title: 'Cost',
    architecturalQuestion: 'Where is money spent?',
    purpose: 'Where money is spent.',
    primaryContainment: 'cost-domain',
    primaryRelationshipFamilies: ['consumes-cost', 'shared-cost', 'unused', 'duplicated'],
    eligibleCanonicalRelations: ['connects', 'data-read', 'data-write', 'event-publish', 'contains', 'owned-by'],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (_g, resources, edges) => {
      const priced = resources.filter((r) => r.metadata.estimatedMonthlyCost != null).length;
      return `${plural(priced, 'costed resource')} in ${plural(
        new Set(resources.map((r) => r.environment || 'shared')).size,
        'cost domain',
      )} with ${plural(edges.length, 'cost relationship')}.`;
    },
  },

  time: {
    id: 'time',
    title: 'Time',
    architecturalQuestion: 'How has the architecture evolved?',
    purpose: 'How the architecture evolved.',
    primaryContainment: 'review-period',
    primaryRelationshipFamilies: ['introduced', 'removed', 'changed', 'drifted'],
    eligibleCanonicalRelations: ['drift-relation', 'connects', 'routes-to', 'implements'],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (graph, _r, edges) => {
      const drifts = graph.drifts.length;
      return `${plural(drifts, 'drift record')} and ${plural(edges.length, 'temporal relationship')} across the review window.`;
    },
  },

  governance: {
    id: 'governance',
    title: 'Governance',
    architecturalQuestion: 'Is this architecture acceptable?',
    purpose: 'Can I sign this off?',
    primaryContainment: 'review',
    primaryRelationshipFamilies: ['validated', 'violated', 'approved', 'waived', 'signoff-blocked'],
    eligibleCanonicalRelations: [
      'satisfies-contract',
      'violates-contract',
      'decides',
      'realizes-intent',
      'depends-on-assumption',
      'produces-obligation',
      'documents-decision',
      'evaluated-by',
    ],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (graph, resources, edges) => {
      const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open').length;
      return `${plural(resources.length, 'governance artefact')} · ${plural(edges.length, 'control link')} · ${plural(blocking, 'blocking finding')}.`;
    },
  },

  // Supporting / legacy views — still contracted so nothing is ad-hoc
  executive: {
    id: 'executive',
    title: 'Executive',
    architecturalQuestion: 'What is the architecture at a glance?',
    purpose: 'Executive overview.',
    primaryContainment: 'application',
    primaryRelationshipFamilies: ['calls', 'depends-on', 'external-integration'],
    eligibleCanonicalRelations: ['exposes', 'routes-to', 'connects', 'data-read', 'event-publish', 'service-to-workload'],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (_g, resources, edges) =>
      `${plural(resources.length, 'key component')} and ${plural(edges.length, 'critical path')}.`,
  },
  architecture: {
    id: 'architecture',
    title: 'Architecture',
    architecturalQuestion: 'What is the runtime architecture?',
    purpose: 'Runtime architecture overview.',
    primaryContainment: 'application',
    primaryRelationshipFamilies: ['calls', 'depends-on', 'routes-to', 'reads', 'writes'],
    eligibleCanonicalRelations: [
      'exposes',
      'routes-to',
      'connects',
      'data-read',
      'data-write',
      'event-publish',
      'service-to-workload',
      'configuration-reference',
    ],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (_g, resources, edges) =>
      `${plural(resources.length, 'runtime node')} linked by ${plural(edges.length, 'dependency', 'dependencies')}.`,
  },
  platform: {
    id: 'platform',
    title: 'Platform',
    architecturalQuestion: 'What platforms host the estate?',
    purpose: 'Platform estates.',
    primaryContainment: 'platform',
    primaryRelationshipFamilies: ['hosts', 'implements', 'attached-to'],
    eligibleCanonicalRelations: ['runs-in', 'contains', 'service-to-workload', 'routes-to', 'implements'],
    secondaryMetadata: ['environment', 'technology'],
    summaryGenerator: (_g, resources, edges) =>
      `${plural(resources.length, 'platform resource')} with ${plural(edges.length, 'hosting relationship')}.`,
  },
  network: {
    id: 'network',
    title: 'Network',
    architecturalQuestion: 'How is the estate networked?',
    purpose: 'Network topology.',
    primaryContainment: 'network',
    primaryRelationshipFamilies: ['network', 'public-ingress', 'allowed', 'blocked'],
    eligibleCanonicalRelations: [
      'exposes',
      'routes-to',
      'connects',
      'network-reachable',
      'network-blocked',
      'protected-by',
    ],
    secondaryMetadata: ['technology', 'environment'],
    summaryGenerator: (_g, resources, edges) =>
      `${plural(resources.length, 'network node')} and ${plural(edges.length, 'network path')}.`,
  },
  evidence: {
    id: 'evidence',
    title: 'Evidence',
    architecturalQuestion: 'What evidence underpins the model?',
    purpose: 'Evidence completeness.',
    primaryContainment: 'lane',
    primaryRelationshipFamilies: ['depends-on'],
    eligibleCanonicalRelations: [],
    secondaryMetadata: [],
    summaryGenerator: (graph) =>
      `${plural(graph.evidence.length, 'evidence record')} across ${plural(graph.resources.length, 'resource')}.`,
  },
  drift: {
    id: 'drift',
    title: 'Drift',
    architecturalQuestion: 'Where has reality diverged from intent?',
    purpose: 'Declared vs observed drift.',
    primaryContainment: 'environment',
    primaryRelationshipFamilies: ['drifted', 'changed'],
    eligibleCanonicalRelations: ['drift-relation', 'connects', 'routes-to'],
    secondaryMetadata: ['technology'],
    summaryGenerator: (graph, _r, edges) =>
      `${plural(graph.drifts.length, 'drift finding')} with ${plural(edges.length, 'related link')}.`,
  },
  signoff: {
    id: 'signoff',
    title: 'Sign-off',
    architecturalQuestion: 'What still blocks sign-off?',
    purpose: 'Sign-off readiness.',
    primaryContainment: 'review',
    primaryRelationshipFamilies: ['signoff-blocked', 'violated', 'waived'],
    eligibleCanonicalRelations: ['violates-contract', 'satisfies-contract', 'exposes', 'connects'],
    secondaryMetadata: ['environment'],
    summaryGenerator: (graph, resources, edges) => {
      const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open').length;
      return `${plural(blocking, 'blocking finding')} among ${plural(resources.length, 'sign-off relevant node')}.`;
    },
  },
  dna: {
    id: 'dna',
    title: 'DNA',
    architecturalQuestion: 'What is the architectural fingerprint?',
    purpose: 'Architecture DNA.',
    primaryContainment: 'capability',
    primaryRelationshipFamilies: ['supports', 'owns'],
    eligibleCanonicalRelations: ['supports-capability', 'owned-by', 'protected-by'],
    secondaryMetadata: ['technology'],
    summaryGenerator: (_g, resources) =>
      `DNA view over ${plural(resources.length, 'fingerprint component')}.`,
  },
  decision: {
    id: 'decision',
    title: 'Decision',
    architecturalQuestion: 'What decisions shape the architecture?',
    purpose: 'Architectural decisions.',
    primaryContainment: 'review',
    primaryRelationshipFamilies: ['validated', 'violated'],
    eligibleCanonicalRelations: [
      'decides',
      'realizes-intent',
      'depends-on-assumption',
      'documents-decision',
      'satisfies-contract',
      'violates-contract',
    ],
    secondaryMetadata: ['environment'],
    summaryGenerator: (_g, resources, edges) =>
      `${plural(countKinds(resources, ['architectural-decision', 'adr', 'intent']), 'decision artefact')} with ${plural(edges.length, 'decision link')}.`,
  },
};

export function getProjectionContract(view: ArchitectureView): ProjectionContract {
  return PROJECTION_CONTRACTS[view];
}

function zoneOf(graph: EvidenceGraph, resourceId: string): string | null {
  const edge = graph.edges.find(
    (e) =>
      e.relation === 'protected-by' &&
      e.source === resourceId &&
      graph.resources.find((r) => r.id === e.target)?.kind === 'trust-zone',
  );
  return edge?.target ?? null;
}

/** Ordered trust-zone flow for security layout (LTR). */
export const SECURITY_ZONE_ORDER = [
  'trust:internet',
  'internet',
  'trust:public-edge',
  'trust:application',
  'trust:data',
  'trust:external',
  'security-controls',
] as const;
