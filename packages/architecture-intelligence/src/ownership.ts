import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import { stableId, type EvidenceGraph, type ResourceNode } from '@infralens/graph-model';

const TEAM_RULES: Array<{ id: string; name: string; match: (r: ResourceNode) => boolean }> = [
  { id: 'retail', name: 'Retail Team', match: (r) => /storefront|catalog|retail|order/i.test(r.name + (r.namespace ?? '')) },
  { id: 'payments', name: 'Payments Team', match: (r) => /payment/i.test(r.name) || (r.provider === 'external' && /payment/i.test(r.name)) },
  { id: 'platform', name: 'Platform Team', match: (r) => ['vpc', 'subnet', 'network', 'security-group', 'cluster', 'network-policy', 'dns', 'load-balancer'].includes(r.kind) },
  { id: 'shared', name: 'Shared Services', match: (r) => r.kind === 'monitoring' || /otel|shared|logging/i.test(r.name) },
  { id: 'external-vendor', name: 'External Vendor', match: (r) => r.provider === 'external' || r.kind === 'external-system' },
];

export function inferOwnership(graph: EvidenceGraph): string[] {
  const teamIds: string[] = [];
  for (const rule of TEAM_RULES) {
    const members = graph.resources.filter(
      (r) => !['team', 'business-capability', 'data-asset', 'trust-zone'].includes(r.kind) && rule.match(r),
    );
    if (!members.length) continue;
    const id = stableId('team', rule.id);
    if (graph.resources.some((r) => r.id === id)) {
      teamIds.push(id);
      continue;
    }
    const ev = createEvidence({
      adapter: 'architecture-intelligence',
      sourceType: 'inference',
      sourceUri: `team:${rule.id}`,
      confidence: 0.65,
      truthState: 'inferred',
      rationale: `Inferred ownership domain ${rule.name}`,
    });
    graph.evidence.push(ev);
    graph.resources.push({
      id,
      logicalId: id,
      kind: 'team',
      subtype: rule.id,
      name: rule.name,
      displayName: rule.name,
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [],
      metadata: { memberIds: members.map((m) => m.id) },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({
        score: 0.65,
        reasons: [`${members.length} resources matched ownership heuristics`],
        missingEvidence: ['explicit ownership annotations'],
        inferenceMethod: 'ownership-heuristics',
      }),
      tags: ['team'],
      layers: ['ownership'],
      ownership: [{ team: rule.name }],
    });
    teamIds.push(id);
    for (const member of members) {
      if (!member.ownership?.length) member.ownership = [{ team: rule.name }];
      graph.edges.push({
        id: stableId(member.id, 'owned-by', id),
        source: member.id,
        target: id,
        relation: 'owned-by',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.65, reasons: [`${member.displayName} owned by ${rule.name}`] }),
        findings: [],
        label: 'owned by',
      });
    }
  }

  // Orphan finding markers via tags
  for (const r of graph.resources) {
    if (['team', 'business-capability', 'data-asset', 'trust-zone', 'internet'].includes(r.kind)) continue;
    if (!r.ownership?.length) r.tags = [...new Set([...(r.tags ?? []), 'orphaned-ownership'])];
  }
  return teamIds;
}

export function inferTrustZones(graph: EvidenceGraph): string[] {
  const zones: Array<{ id: string; name: string; members: ResourceNode[] }> = [
    {
      id: 'public-edge',
      name: 'Public Edge',
      members: graph.resources.filter((r) => ['internet', 'route', 'ingress', 'dns', 'load-balancer'].includes(r.kind)),
    },
    {
      id: 'application',
      name: 'Application Trust Zone',
      members: graph.resources.filter((r) => ['workload', 'service', 'application'].includes(r.kind)),
    },
    {
      id: 'data',
      name: 'Data Trust Zone',
      members: graph.resources.filter((r) =>
        ['relational-database', 'bucket', 'queue', 'cache', 'data-asset'].includes(r.kind),
      ),
    },
    {
      id: 'external',
      name: 'External Trust Zone',
      members: graph.resources.filter((r) => r.provider === 'external' || r.kind === 'external-system'),
    },
  ];

  const ids: string[] = [];
  for (const zone of zones) {
    if (!zone.members.length) continue;
    const id = stableId('trust', zone.id);
    if (graph.resources.some((r) => r.id === id)) {
      ids.push(id);
      continue;
    }
    const ev = createEvidence({
      adapter: 'architecture-intelligence',
      sourceType: 'inference',
      sourceUri: `trust:${zone.id}`,
      confidence: 0.8,
      truthState: 'inferred',
      rationale: `Trust zone ${zone.name}`,
    });
    graph.evidence.push(ev);
    graph.resources.push({
      id,
      logicalId: id,
      kind: 'trust-zone',
      subtype: zone.id,
      name: zone.name,
      displayName: zone.name,
      lifecycle: 'active',
      truthStates: ['inferred'],
      instances: [],
      metadata: { memberIds: zone.members.map((m) => m.id) },
      interfaces: [],
      evidence: [ev.id],
      findings: [],
      confidence: assessConfidence({ score: 0.8, reasons: [`${zone.members.length} members in ${zone.name}`] }),
      tags: ['trust-zone'],
      layers: ['security'],
    });
    ids.push(id);
    for (const m of zone.members) {
      graph.edges.push({
        id: stableId(m.id, 'protected-by', id),
        source: m.id,
        target: id,
        relation: 'protected-by',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.75, reasons: [`${m.displayName} in ${zone.name}`] }),
        findings: [],
        label: 'in trust zone',
      });
    }
  }
  return ids;
}

/**
 * Infer control→resource protection edges from discovery metadata / naming.
 * Idempotent: skips when an equivalent edge already exists.
 */
export function linkSecurityControls(graph: EvidenceGraph): number {
  let added = 0;
  const hasEdge = (source: string, target: string, relation: string) =>
    graph.edges.some((e) => e.source === source && e.target === target && e.relation === relation);

  for (const sg of graph.resources.filter((r) => r.kind === 'security-group')) {
    const targets = graph.resources.filter((r) => {
      if (!['relational-database', 'workload', 'service', 'load-balancer'].includes(r.kind)) return false;
      const a = sg.name.replace(/[^a-z0-9]/gi, '');
      const b = r.name.replace(/[^a-z0-9]/gi, '');
      return a.length >= 3 && (b.includes(a) || a.includes(b.replace(/prod|staging|dev/gi, '')));
    });
    for (const t of targets) {
      if (hasEdge(sg.id, t.id, 'protected-by')) continue;
      const ev = createEvidence({
        adapter: 'architecture-intelligence',
        sourceType: 'inference',
        sourceUri: `sg:${sg.id}`,
        confidence: 0.7,
        truthState: 'inferred',
        rationale: `Security group ${sg.name} protects ${t.name}`,
      });
      graph.evidence.push(ev);
      graph.edges.push({
        id: stableId(sg.id, 'protected-by', t.id),
        source: sg.id,
        target: t.id,
        relation: 'protected-by',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.7, reasons: [`SG ${sg.name} ↔ ${t.name}`] }),
        findings: [],
        label: 'security-group',
        effectiveState: 'allowed',
      });
      added++;
    }
  }

  for (const np of graph.resources.filter((r) => r.kind === 'network-policy')) {
    const targets = graph.resources.filter((r) => {
      if (!['workload', 'service'].includes(r.kind)) return false;
      return (
        np.name.toLowerCase().includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().includes(np.name.replace(/^restrict-?/i, '').toLowerCase())
      );
    });
    for (const t of targets) {
      if (hasEdge(np.id, t.id, 'protected-by')) continue;
      const ev = createEvidence({
        adapter: 'architecture-intelligence',
        sourceType: 'inference',
        sourceUri: `np:${np.id}`,
        confidence: 0.72,
        truthState: 'inferred',
        rationale: `NetworkPolicy ${np.name} protects ${t.name}`,
      });
      graph.evidence.push(ev);
      graph.edges.push({
        id: stableId(np.id, 'protected-by', t.id),
        source: np.id,
        target: t.id,
        relation: 'protected-by',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.72, reasons: [`NetworkPolicy ${np.name} ↔ ${t.name}`] }),
        findings: [],
        label: 'network-policy',
        effectiveState: 'allowed',
      });
      added++;
    }
  }

  for (const role of graph.resources.filter((r) => r.kind === 'iam-role' || r.kind === 'iam-policy')) {
    const targets = graph.resources.filter((r) => {
      if (!['bucket', 'queue', 'relational-database', 'workload', 'service'].includes(r.kind)) return false;
      const roleToken = role.name.replace(/-?role$/i, '').replace(/[^a-z0-9]/gi, '');
      const resToken = r.name.replace(/[^a-z0-9]/gi, '');
      return roleToken.length >= 4 && (resToken.includes(roleToken) || roleToken.includes(resToken.slice(0, 12)));
    });
    for (const t of targets) {
      if (hasEdge(role.id, t.id, 'iam-authorised')) continue;
      const ev = createEvidence({
        adapter: 'architecture-intelligence',
        sourceType: 'inference',
        sourceUri: `iam:${role.id}`,
        confidence: 0.68,
        truthState: 'inferred',
        rationale: `IAM ${role.name} authorises ${t.name}`,
      });
      graph.evidence.push(ev);
      graph.edges.push({
        id: stableId(role.id, 'iam-authorised', t.id),
        source: role.id,
        target: t.id,
        relation: 'iam-authorised',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.68, reasons: [`IAM ${role.name} ↔ ${t.name}`] }),
        findings: [],
        label: 'IAM',
        effectiveState: 'allowed',
      });
      added++;
    }
  }

  return added;
}
