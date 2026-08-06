import { assessConfidence, createEvidence } from '@infralens/evidence-model';
import {
  stableId,
  type DriftRecord,
  type EvidenceGraph,
  type FindingSeverity,
  type ResourceNode,
  type ScanBundle,
} from '@infralens/graph-model';

interface MatchCandidate {
  a: ResourceNode;
  b: ResourceNode;
  score: number;
  method: string;
  deterministic: boolean;
}

export function reconcileTruthStates(graph: EvidenceGraph): void {
  const byLogical = new Map<string, ResourceNode[]>();
  for (const r of graph.resources) {
    const key = r.logicalId || r.id;
    const list = byLogical.get(key) ?? [];
    list.push(r);
    byLogical.set(key, list);
  }

  // Deterministic matching across different logical IDs
  const unmatched = [...graph.resources];
  const pairs: MatchCandidate[] = [];

  for (let i = 0; i < unmatched.length; i++) {
    for (let j = i + 1; j < unmatched.length; j++) {
      const a = unmatched[i];
      const b = unmatched[j];
      const match = scoreMatch(a, b);
      if (match) pairs.push(match);
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  const consumed = new Set<string>();

  for (const pair of pairs) {
    if (consumed.has(pair.a.id) || consumed.has(pair.b.id)) continue;
    if (pair.score < 0.7) continue;
    mergeMatched(graph, pair);
    consumed.add(pair.a.id);
    consumed.add(pair.b.id);
  }

  detectDrift(graph);
}

function scoreMatch(a: ResourceNode, b: ResourceNode): MatchCandidate | null {
  if (a.id === b.id) return null;
  const aArn = String(a.metadata.arn ?? '');
  const bArn = String(b.metadata.arn ?? '');
  if (aArn && aArn === bArn) {
    return { a, b, score: 1, method: 'exact-arn', deterministic: true };
  }
  const aPid = String(a.metadata.providerId ?? '');
  const bPid = String(b.metadata.providerId ?? '');
  if (aPid && aPid === bPid) {
    return { a, b, score: 1, method: 'provider-id', deterministic: true };
  }
  const aAddr = String(a.metadata.address ?? '');
  const bAddr = String(b.metadata.address ?? '');
  if (aAddr && aAddr === bAddr) {
    return { a, b, score: 1, method: 'terraform-address', deterministic: true };
  }
  if (
    a.kind === b.kind &&
    a.namespace &&
    a.namespace === b.namespace &&
    a.name === b.name &&
    a.subtype === b.subtype
  ) {
    return { a, b, score: 0.98, method: 'namespace-name-kind', deterministic: true };
  }
  if (a.kind === b.kind && a.name === b.name && a.account && a.account === b.account) {
    return { a, b, score: 0.92, method: 'name-account-kind', deterministic: true };
  }
  if (a.kind === b.kind && a.name === b.name) {
    return {
      a,
      b,
      score: 0.75,
      method: 'scored-name-kind',
      deterministic: false,
    };
  }
  // Endpoint match — exact only. Prefix includes (retail-prod-assets ⊂ *-logs) caused
  // distinct buckets/queues to collapse during reconciliation.
  const aEndpoint = String(a.metadata.endpoint ?? a.metadata.identifier ?? '');
  const bEndpoint = String(b.metadata.endpoint ?? b.metadata.identifier ?? '');
  if (a.kind === b.kind && aEndpoint && aEndpoint === bEndpoint) {
    return { a, b, score: 0.85, method: 'endpoint-exact-match', deterministic: false };
  }
  const aBucket = String(a.metadata.bucket ?? '');
  const bBucket = String(b.metadata.bucket ?? '');
  if (
    a.kind === 'bucket' &&
    b.kind === 'bucket' &&
    ((aBucket && aBucket === b.name) || (bBucket && bBucket === a.name)) &&
    a.name === b.name
  ) {
    return { a, b, score: 0.9, method: 'bucket-name-match', deterministic: false };
  }
  return null;
}

function mergeMatched(graph: EvidenceGraph, pair: MatchCandidate): void {
  const primary = preferPrimary(pair.a, pair.b);
  const secondary = primary.id === pair.a.id ? pair.b : pair.a;

  primary.truthStates = [...new Set([...primary.truthStates, ...secondary.truthStates])];
  primary.evidence = [...new Set([...primary.evidence, ...secondary.evidence])];
  primary.instances = [...primary.instances, ...secondary.instances];
  primary.metadata = { ...secondary.metadata, ...primary.metadata };
  primary.tags = [...new Set([...primary.tags, ...secondary.tags, 'reconciled'])];
  if (!pair.deterministic) {
    primary.confidence = assessConfidence({
      score: Math.min(primary.confidence.score, 0.7),
      reasons: [
        ...primary.confidence.reasons,
        `Probabilistic match via ${pair.method} (score ${pair.score})`,
      ],
      missingEvidence: [
        ...primary.confidence.missingEvidence,
        'deterministic identity (ARN/UID/address)',
      ],
      conflicts: primary.confidence.conflicts,
      inferenceMethod: pair.method,
      wouldIncreaseConfidence: ['Confirm ARN or Terraform address equality'],
    });
    const ev = createEvidence({
      adapter: 'reconciliation',
      sourceType: 'inference',
      sourceUri: `reconcile:${primary.id}:${secondary.id}`,
      confidence: pair.score,
      truthState: 'inferred',
      rationale: `Probabilistic reconciliation via ${pair.method}`,
      extractedValue: { primary: primary.id, secondary: secondary.id, score: pair.score },
    });
    graph.evidence.push(ev);
    primary.evidence.push(ev.id);
  } else {
    primary.confidence = assessConfidence({
      score: Math.max(primary.confidence.score, secondary.confidence.score),
      reasons: [
        ...primary.confidence.reasons,
        `Deterministic match via ${pair.method}`,
      ],
      missingEvidence: primary.confidence.missingEvidence.filter(
        (m) => !/live|inventory/i.test(m),
      ),
      wouldIncreaseConfidence: primary.confidence.wouldIncreaseConfidence,
    });
  }

  // Retarget edges from secondary to primary
  for (const edge of graph.edges) {
    if (edge.source === secondary.id) edge.source = primary.id;
    if (edge.target === secondary.id) edge.target = primary.id;
  }
  for (const f of graph.findings) {
    f.affectedResources = f.affectedResources.map((id) => (id === secondary.id ? primary.id : id));
  }

  graph.resources = graph.resources.filter((r) => r.id !== secondary.id);
  primary.logicalId = primary.logicalId || secondary.logicalId;
}

function preferPrimary(a: ResourceNode, b: ResourceNode): ResourceNode {
  const rank = (r: ResourceNode) => {
    let s = 0;
    if (r.truthStates.includes('observed')) s += 4;
    if (r.truthStates.includes('planned')) s += 3;
    if (r.truthStates.includes('evaluated')) s += 3;
    if (r.truthStates.includes('rendered')) s += 2;
    if (r.truthStates.includes('declared')) s += 1;
    return s;
  };
  return rank(a) >= rank(b) ? a : b;
}

function detectDrift(graph: EvidenceGraph): void {
  const now = graph.scan.generatedAt;
  for (const r of graph.resources) {
    const hasDeclared = r.truthStates.includes('declared') || r.truthStates.includes('rendered');
    const hasPlanned = r.truthStates.includes('planned') || r.truthStates.includes('evaluated');
    const hasObserved = r.truthStates.includes('observed');

    if (hasDeclared && !hasPlanned && graph.scan.adapters.includes('terraform')) {
      // only if plan was expected - skip soft
    }

    if (hasPlanned && !hasObserved && graph.resources.some((x) => x.truthStates.includes('observed'))) {
      pushDrift(graph, {
        category: 'planned-not-observed',
        severity: severityForDrift('planned-not-observed', r),
        resourceId: r.id,
        logicalId: r.logicalId,
        explanation: `${r.displayName} is planned/evaluated but absent from observed inventory.`,
        impact: 'Deployment may have failed or inventory scope is incomplete.',
        evidence: r.evidence,
      });
    }

    if (hasObserved && !hasDeclared && !hasPlanned) {
      pushDrift(graph, {
        category: 'observed-not-declared',
        severity: severityForDrift('observed-not-declared', r),
        resourceId: r.id,
        logicalId: r.logicalId,
        explanation: `${r.displayName} was observed live but is not declared in IaC.`,
        impact: 'Shadow infrastructure may exist outside change control.',
        evidence: r.evidence,
      });
    }

    // Attribute drift within reconciled instances
    if (r.instances.length >= 2) {
      const declared = r.instances.find((i) => i.truthState === 'declared' || i.truthState === 'rendered');
      const observed = r.instances.find((i) => i.truthState === 'observed');
      if (declared && observed) {
        for (const field of ['multi_az', 'multiAz', 'encryption', 'storage_encrypted', 'image', 'replicas']) {
          const dv = declared.attributes[field] ?? r.metadata[field];
          const ov = observed.attributes[field];
          if (ov !== undefined && dv !== undefined && String(dv) !== String(ov)) {
            pushDrift(graph, {
              category: field.includes('image') ? 'version-drift' : 'attribute-drift',
              severity: severityForAttribute(field, dv, ov),
              resourceId: r.id,
              logicalId: r.logicalId,
              field,
              declared: dv,
              observed: ov,
              explanation: `Attribute ${field} differs between declared (${dv}) and observed (${ov}).`,
              impact: impactForAttribute(field),
              evidence: r.evidence,
            });
          }
        }
      }
    }
  }

  // Surface critical drifts as findings
  for (const d of graph.drifts) {
    if (!['critical', 'high'].includes(d.severity)) continue;
    if (graph.findings.some((f) => f.id === stableId('finding', 'drift', d.id))) continue;
    graph.findings.push({
      id: stableId('finding', 'drift', d.id),
      severity: d.severity,
      title: `Drift: ${d.category}`,
      rationale: d.explanation,
      impact: d.impact,
      remediation: 'Reconcile declared configuration with live state or update inventory scope.',
      affectedResources: d.resourceId ? [d.resourceId] : [],
      evidence: d.evidence,
      status: 'open',
      firstSeen: now,
      lastSeen: now,
      blocksSignOff: d.severity === 'critical' || d.severity === 'high',
    });
  }
}

function pushDrift(
  graph: EvidenceGraph,
  partial: Omit<DriftRecord, 'id'>,
): void {
  const id = stableId(
    'drift',
    partial.category,
    partial.resourceId,
    partial.field,
    String(partial.declared),
    String(partial.observed),
  );
  if (graph.drifts.some((d) => d.id === id)) return;
  graph.drifts.push({ id, ...partial });
}

function severityForDrift(category: string, r: ResourceNode): FindingSeverity {
  if (category === 'observed-not-declared') {
    if (r.kind === 'bucket' || r.kind === 'relational-database' || r.kind === 'iam-role') return 'high';
    return 'medium';
  }
  if (category === 'planned-not-observed') return 'medium';
  return 'low';
}

function severityForAttribute(field: string, declared: unknown, observed: unknown): FindingSeverity {
  if (field === 'multi_az' || field === 'multiAz') {
    if (observed === false || observed === 'false') return 'high';
  }
  if (/encrypt/i.test(field) && (observed === false || observed === 'false')) return 'high';
  if (field === 'image' && String(observed).endsWith(':latest')) return 'medium';
  if (field === 'replicas') return 'medium';
  void declared;
  return 'low';
}

function impactForAttribute(field: string): string {
  if (field === 'multi_az' || field === 'multiAz') return 'Availability zone failure may cause outage.';
  if (/encrypt/i.test(field)) return 'Data may be stored without required encryption.';
  if (field === 'image') return 'Mutable image tags undermine reproducibility.';
  return 'Configuration drift may indicate unapproved change.';
}

export function compareBundles(baseline: ScanBundle, candidate: ScanBundle) {
  const baseIds = new Map(baseline.graph.resources.map((r) => [r.logicalId || r.id, r]));
  const candIds = new Map(candidate.graph.resources.map((r) => [r.logicalId || r.id, r]));
  const added: ResourceNode[] = [];
  const removed: ResourceNode[] = [];
  const modified: Array<{ before: ResourceNode; after: ResourceNode; fields: string[] }> = [];

  for (const [id, r] of candIds) {
    if (!baseIds.has(id)) added.push(r);
  }
  for (const [id, r] of baseIds) {
    if (!candIds.has(id)) removed.push(r);
  }
  for (const [id, after] of candIds) {
    const before = baseIds.get(id);
    if (!before) continue;
    const fields: string[] = [];
    for (const key of new Set([...Object.keys(before.metadata), ...Object.keys(after.metadata)])) {
      if (JSON.stringify(before.metadata[key]) !== JSON.stringify(after.metadata[key])) fields.push(key);
    }
    if (fields.length) modified.push({ before, after, fields });
  }

  const newlyExposed = added.filter((r) => r.kind === 'ingress' || r.kind === 'route');
  const policyRegression = candidate.graph.findings.filter(
    (f) =>
      (f.severity === 'critical' || f.severity === 'high') &&
      !baseline.graph.findings.some((b) => b.title === f.title && b.affectedResources.join() === f.affectedResources.join()),
  );

  const materialChange =
    newlyExposed.length > 0 ||
    policyRegression.length > 0 ||
    modified.some((m) => m.fields.some((f) => /multi_az|encrypt|public|egress|image/i.test(f)));

  return {
    added,
    removed,
    modified,
    newlyExposed,
    policyRegression,
    materialChange,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      newlyExposed: newlyExposed.length,
      policyRegression: policyRegression.length,
    },
  };
}

export function invalidateSignOffsOnMaterialChange(
  graph: EvidenceGraph,
  comparison: ReturnType<typeof compareBundles>,
): void {
  if (!comparison.materialChange) return;
  for (const s of graph.signOffs) {
    if (s.decision === 'Approved' || s.decision === 'Approved with Waivers') {
      s.decision = 'Invalidated by Change';
      s.comments.push(
        `Invalidated due to material change: +${comparison.summary.newlyExposed} exposed, ${comparison.summary.policyRegression} policy regressions.`,
      );
    }
  }
}
