import { stableId, type EvidenceGraph, type Finding, type FindingRecommendation } from '@infralens/graph-model';
import { computeBusinessBlastRadius } from '../blast.js';

function option(
  id: string,
  title: string,
  partial: Omit<FindingRecommendation['options'][number], 'id' | 'title'>,
): FindingRecommendation['options'][number] {
  return { id, title, ...partial };
}

export function recommendForFinding(graph: EvidenceGraph, finding: Finding): FindingRecommendation {
  const resources = finding.affectedResources
    .map((id) => graph.resources.find((r) => r.id === id))
    .filter(Boolean);
  const primary = resources[0];
  const blast = primary ? computeBusinessBlastRadius(graph, primary.id) : null;
  const caps = (blast?.capabilities ?? [])
    .map((id) => graph.resources.find((r) => r.id === id)?.displayName)
    .filter(Boolean) as string[];

  const title = finding.title.toLowerCase();
  let options = defaultOptions(finding);
  if (/multi-az|single.?az|availability/i.test(title + finding.rationale)) {
    options = multiAzOptions(finding);
  } else if (/public|ingress|route|exposure/i.test(title + finding.rationale)) {
    options = publicExposureOptions(finding);
  } else if (/replica|single.?point/i.test(title + finding.rationale)) {
    options = replicaOptions(finding);
  } else if (/ownership|orphan/i.test(title + finding.rationale)) {
    options = ownershipOptions(finding);
  } else if (/latest|image|tag/i.test(title + finding.rationale)) {
    options = imageOptions(finding);
  }

  return {
    id: stableId('rec', finding.id),
    findingId: finding.id,
    problem: finding.title,
    why: `Why this matters: ${finding.impact}. ${finding.rationale}`,
    capabilityImpact: caps.length ? caps : ['Unmapped — capability evidence incomplete'],
    businessImpact: blast?.publicUsersAffected
      ? 'May affect public users and dependent capabilities'
      : 'Primarily internal operational / architectural impact',
    technicalImpact: finding.remediation || finding.impact,
    approvalImpact: finding.blocksSignOff
      ? 'Blocks architectural approval until resolved or waived'
      : 'Does not block approval by itself',
    options,
    evidenceIds: finding.evidence,
    unknowns: primary?.confidence.missingEvidence ?? [],
    resourceIds: finding.affectedResources,
  };
}

export function generateRecommendations(graph: EvidenceGraph): FindingRecommendation[] {
  const significant = graph.findings.filter(
    (f) =>
      f.status === 'open' &&
      (f.blocksSignOff || f.severity === 'high' || f.severity === 'critical' || f.severity === 'medium'),
  );
  // Also synthesize for known architecture concerns without findings
  const recs = significant.map((f) => recommendForFinding(graph, f));
  const singleAz = graph.resources.filter(
    (r) => r.kind === 'relational-database' && (r.metadata.multi_az === false || r.metadata.multiAz === false),
  );
  for (const db of singleAz) {
    if (recs.some((r) => r.resourceIds.includes(db.id) && /multi-az|single/i.test(r.problem))) continue;
    recs.push({
      id: stableId('rec', 'single-az', db.id),
      problem: `Single-AZ database: ${db.displayName}`,
      why: 'Why this matters: loss of the availability zone takes the data plane offline for dependent capabilities.',
      capabilityImpact: graph.edges
        .filter((e) => e.target === db.id || e.source === db.id)
        .flatMap((e) => {
          const other = e.source === db.id ? e.target : e.source;
          const n = graph.resources.find((r) => r.id === other);
          return n?.kind === 'business-capability' ? [n.displayName] : [];
        }),
      businessImpact: 'Order processing and catalogue durability are at risk during AZ failure',
      technicalImpact: 'No automatic failover across availability zones',
      approvalImpact: 'Typically blocks production readiness / availability stage',
      options: multiAzOptions({
        id: 'synthetic-az',
        title: 'Single-AZ',
        rationale: '',
        impact: '',
        remediation: 'Enable Multi-AZ',
        affectedResources: [db.id],
        evidence: db.evidence,
        status: 'open',
        severity: 'high',
        firstSeen: graph.scan.generatedAt,
        lastSeen: graph.scan.generatedAt,
        blocksSignOff: true,
      }),
      evidenceIds: db.evidence,
      unknowns: db.confidence.missingEvidence ?? [],
      resourceIds: [db.id],
    });
  }
  return recs;
}

function multiAzOptions(finding: Finding): FindingRecommendation['options'] {
  return [
    option('enable-multi-az', 'Enable Multi-AZ', {
      pros: ['Minimal topology change', 'High confidence remediation', 'Preserves existing engine'],
      cons: ['Incremental cost', 'Brief maintenance window possible'],
      impact: 'Removes single-AZ availability failure mode',
      risk: 'Low operational risk during enablement',
      cost: 'low',
      complexity: 'low',
      confidence: 'high',
      evidenceIds: finding.evidence,
      sideEffects: ['Slightly higher managed DB cost'],
      estimatedEffort: 'low',
    }),
    option('migrate-aurora', 'Migrate to Aurora', {
      pros: ['Higher resilience', 'Storage autoscaling'],
      cons: ['Higher cost', 'Topology / connection change required'],
      impact: 'Stronger resilience and failover characteristics',
      risk: 'Medium — migration and cutover risk',
      cost: 'high',
      complexity: 'high',
      confidence: 'medium',
      evidenceIds: finding.evidence,
      sideEffects: ['Application connection string changes', 'Possibly new IAM/network paths'],
      estimatedEffort: 'high',
    }),
  ];
}

function publicExposureOptions(finding: Finding): FindingRecommendation['options'] {
  return [
    option('remove-public', 'Remove or privatise the public ingress', {
      pros: ['Eliminates exposure', 'Clear approval path'],
      cons: ['May break intended public access'],
      impact: 'Reduces internet attack surface',
      risk: 'Low if route is non-essential',
      cost: 'low',
      complexity: 'low',
      confidence: 'high',
      evidenceIds: finding.evidence,
      sideEffects: ['Clients lose direct route'],
      estimatedEffort: 'low',
    }),
    option('protect-edge', 'Keep public with hardened controls', {
      pros: ['Preserves product access', 'Can satisfy policy with compensating controls'],
      cons: ['Residual exposure remains', 'Needs ongoing review'],
      impact: 'Documents intentional exposure with controls',
      risk: 'Medium residual security risk',
      cost: 'medium',
      complexity: 'medium',
      confidence: 'medium',
      evidenceIds: finding.evidence,
      sideEffects: ['Requires WAF/auth evidence'],
      estimatedEffort: 'medium',
    }),
  ];
}

function replicaOptions(finding: Finding): FindingRecommendation['options'] {
  return [
    option('scale-replicas', 'Increase replica count (≥2)', {
      pros: ['Simple change', 'Improves availability'],
      cons: ['Higher compute cost'],
      impact: 'Removes single-replica SPOF',
      risk: 'Low',
      cost: 'low',
      complexity: 'low',
      confidence: 'high',
      evidenceIds: finding.evidence,
      sideEffects: ['Need pod disruption budgets reviewed'],
      estimatedEffort: 'low',
    }),
  ];
}

function ownershipOptions(finding: Finding): FindingRecommendation['options'] {
  return [
    option('annotate-owners', 'Add explicit ownership metadata', {
      pros: ['Removes UNKNOWN ownership', 'Improves review confidence'],
      cons: ['Requires organisational agreement'],
      impact: 'Clear accountability for incidents and approvals',
      risk: 'Low',
      cost: 'low',
      complexity: 'low',
      confidence: 'high',
      evidenceIds: finding.evidence,
      sideEffects: ['None on runtime topology'],
      estimatedEffort: 'low',
    }),
  ];
}

function imageOptions(finding: Finding): FindingRecommendation['options'] {
  return [
    option('pin-digest', 'Pin image digest / immutable tag', {
      pros: ['Reproducible deployments', 'Policy compliance'],
      cons: ['Requires pipeline change'],
      impact: 'Stops floating latest tags',
      risk: 'Low',
      cost: 'low',
      complexity: 'medium',
      confidence: 'high',
      evidenceIds: finding.evidence,
      sideEffects: ['CI must update digests'],
      estimatedEffort: 'medium',
    }),
  ];
}

function defaultOptions(finding: Finding): FindingRecommendation['options'] {
  return [
    option('remediate', finding.remediation || 'Remediate according to policy', {
      pros: ['Addresses finding directly'],
      cons: ['May require design change'],
      impact: finding.impact,
      risk: finding.severity,
      cost: 'unknown',
      complexity: 'medium',
      confidence: 'medium',
      evidenceIds: finding.evidence,
      sideEffects: ['Re-run scan to confirm'],
      estimatedEffort: 'medium',
    }),
    option('waiver', 'Time-bounded waiver with compensating control', {
      pros: ['Unblocks release when risk accepted'],
      cons: ['Does not remove underlying risk'],
      impact: 'Approval may proceed with waiver audit trail',
      risk: 'Accepted residual risk',
      cost: 'low',
      complexity: 'low',
      confidence: 'medium',
      evidenceIds: finding.evidence,
      sideEffects: ['Requires expiry and re-review'],
      estimatedEffort: 'low',
    }),
  ];
}
