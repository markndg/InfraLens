import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import { stableId, type ContractEvaluation, type EvidenceGraph } from '@infralens/graph-model';

interface ContractReq {
  id: string;
  label: string;
  check: (graph: EvidenceGraph, capabilityId: string) => { ok: boolean; reason: string; resourceIds: string[] };
}

const REQUIREMENTS: ContractReq[] = [
  {
    id: 'ha-database',
    label: 'HA database',
    check: (graph) => {
      const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
      const bad = dbs.filter((d) => d.metadata.multi_az === false || d.metadata.multiAz === false);
      return {
        ok: dbs.length > 0 && bad.length === 0,
        reason: bad.length ? `Non multi-AZ: ${bad.map((b) => b.displayName).join(', ')}` : 'HA DB requirement met or no DB',
        resourceIds: dbs.map((d) => d.id),
      };
    },
  },
  {
    id: 'encrypted-data',
    label: 'Encrypted data',
    check: (graph) => {
      const stores = graph.resources.filter((r) => ['relational-database', 'bucket'].includes(r.kind));
      const evidenced = stores.filter((s) => s.metadata.encrypted != null || s.metadata.encryption != null);
      return {
        ok: evidenced.length > 0 || stores.length === 0,
        reason: evidenced.length ? 'Encryption metadata present' : 'Encryption not evidenced',
        resourceIds: stores.map((s) => s.id),
      };
    },
  },
  {
    id: 'approved-ownership',
    label: 'Approved ownership',
    check: (graph) => {
      const orphans = graph.resources.filter((r) => r.tags.includes('orphaned-ownership'));
      return {
        ok: orphans.length < graph.resources.length * 0.4,
        reason: `${orphans.length} orphaned resources`,
        resourceIds: orphans.slice(0, 8).map((o) => o.id),
      };
    },
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    check: (graph) => {
      const ok =
        graph.resources.some((r) => r.kind === 'monitoring') ||
        graph.resources.some((r) => /otel|telemetry|metrics/i.test(r.name));
      return { ok, reason: ok ? 'Monitoring evidence found' : 'Monitoring missing', resourceIds: [] };
    },
  },
  {
    id: 'internal-communication',
    label: 'Internal communication',
    check: (graph) => {
      const external = graph.resources.filter((r) => r.provider === 'external');
      return {
        ok: true,
        reason: external.length
          ? `${external.length} external system(s) — review egress`
          : 'No external systems',
        resourceIds: external.map((e) => e.id),
      };
    },
  },
];

const OBLIGATIONS = [
  { id: 'pci', name: 'PCI', match: /payment/i },
  { id: 'soc2', name: 'SOC2', match: /./ },
  { id: 'encryption', name: 'Encryption', match: /data|order|customer/i },
  { id: 'backup', name: 'Backups', match: /database|order/i },
  { id: 'review-annually', name: 'Review annually', match: /./ },
  { id: 'retention', name: 'Retention', match: /audit|customer|order/i },
];

export function buildContractsAndObligations(graph: EvidenceGraph): {
  contractIds: string[];
  obligationIds: string[];
} {
  const contractIds: string[] = [];
  const obligationIds: string[] = [];
  const caps = graph.resources.filter(
    (r) => r.kind === 'business-capability' && (r.subtype === 'customer-ordering' || /order|catalog/i.test(r.name)),
  );
  const targets = caps.length
    ? caps
    : graph.resources.filter((r) => r.kind === 'business-capability' && r.subtype === 'platform').slice(0, 1);

  for (const cap of targets) {
    const contractId = stableId('contract', cap.subtype ?? cap.name);
    contractIds.push(contractId);
    if (!graph.resources.some((r) => r.id === contractId)) {
      const ev = createEvidence({
        adapter: 'governance-contracts',
        sourceType: 'inference',
        sourceUri: `contract:${cap.id}`,
        confidence: 0.75,
        truthState: 'declared',
        rationale: `Architecture contract for ${cap.displayName}`,
      });
      graph.evidence.push(ev);
      const reqResults = REQUIREMENTS.map((req) => ({ req, ...req.check(graph, cap.id) }));
      const violated = reqResults.filter((r) => !r.ok);
      const evaluation: ContractEvaluation = violated.length
        ? violated.length === reqResults.length
          ? 'violated'
          : 'partial'
        : 'satisfied';

      graph.resources.push({
        id: contractId,
        logicalId: contractId,
        kind: 'architecture-contract',
        subtype: cap.subtype,
        name: `${cap.displayName} Contract`,
        displayName: `${cap.displayName} Contract`,
        lifecycle: 'active',
        truthStates: ['declared'],
        instances: [],
        metadata: {
          evaluation,
          requirements: reqResults.map((r) => ({
            id: r.req.id,
            label: r.req.label,
            ok: r.ok,
            reason: r.reason,
          })),
          capabilityId: cap.id,
        },
        interfaces: [],
        evidence: [ev.id],
        findings: [],
        confidence: assessConfidence({ score: 0.75, reasons: [`Evaluation: ${evaluation}`] }),
        tags: ['contract', evaluation === 'violated' || evaluation === 'partial' ? 'contract-violated' : 'contract-ok'],
        layers: ['governance', 'contract'],
      });
      graph.edges.push({
        id: stableId(cap.id, 'satisfies-contract', contractId),
        source: cap.id,
        target: contractId,
        relation: evaluation === 'violated' ? 'violates-contract' : 'satisfies-contract',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.75, reasons: [evaluation] }),
        findings: [],
        label: evaluation === 'violated' ? 'violates' : 'bound by',
      });
    }

    for (const obl of OBLIGATIONS) {
      if (!obl.match.test(cap.name + (cap.subtype ?? ''))) continue;
      const oid = stableId('obligation', obl.id, cap.subtype ?? cap.name);
      obligationIds.push(oid);
      if (graph.resources.some((r) => r.id === oid)) continue;
      const ev = createEvidence({
        adapter: 'governance-contracts',
        sourceType: 'inference',
        sourceUri: `obligation:${obl.id}`,
        confidence: 0.65,
        truthState: 'declared',
        rationale: `Obligation ${obl.name} from ${cap.displayName} contract`,
      });
      graph.evidence.push(ev);
      graph.resources.push({
        id: oid,
        logicalId: oid,
        kind: 'obligation',
        subtype: obl.id,
        name: obl.name,
        displayName: obl.name,
        lifecycle: 'active',
        truthStates: ['declared'],
        instances: [],
        metadata: { status: 'outstanding', capabilityId: cap.id, contractId },
        interfaces: [],
        evidence: [ev.id],
        findings: [],
        confidence: assessConfidence({ score: 0.65, reasons: [`Required by ${cap.displayName}`] }),
        tags: ['obligation', 'outstanding'],
        layers: ['governance', 'contract'],
      });
      graph.edges.push({
        id: stableId(contractId, 'produces-obligation', oid),
        source: contractId,
        target: oid,
        relation: 'produces-obligation',
        direction: 'directed',
        truthStates: ['inferred'],
        evidence: [ev.id],
        confidence: assessConfidence({ score: 0.7, reasons: ['Contract produces obligation'] }),
        findings: [],
        label: 'requires',
      });
    }
  }

  return { contractIds: [...new Set(contractIds)], obligationIds: [...new Set(obligationIds)] };
}
