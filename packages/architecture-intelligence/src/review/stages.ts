import type {
  EvidenceGraph,
  ReviewStageId,
  ReviewStageOutcome,
  ReviewStageResult,
} from '@infralens/graph-model';

type StageEval = (graph: EvidenceGraph) => Omit<
  ReviewStageResult,
  'id' | 'title' | 'projection' | 'comments'
> & { skip?: boolean };

function base(
  outcome: ReviewStageOutcome,
  partial: Omit<ReturnType<StageEval>, 'outcome' | 'continueApproval'> & {
    continueApproval?: boolean;
  },
): ReturnType<StageEval> {
  return {
    outcome,
    continueApproval: partial.continueApproval ?? (outcome === 'PASS' || outcome === 'WARNING' || outcome === 'SKIPPED'),
    importance: partial.importance,
    conclusion: partial.conclusion,
    evidenceIds: partial.evidenceIds,
    resourceIds: partial.resourceIds,
    unknowns: partial.unknowns,
    confidenceImprovements: partial.confidenceImprovements,
    recommendation: partial.recommendation,
    findingIds: partial.findingIds,
    decision: partial.decision,
    risk: partial.risk,
    skip: partial.skip,
  };
}

export const STAGE_META: Record<
  ReviewStageId,
  { title: string; projection: ReviewStageResult['projection']; importance: string }
> = {
  scope: {
    title: 'Scope',
    projection: 'capability',
    importance: 'Confirms what architecture is under review and whether the estate is coherent.',
  },
  architecture: {
    title: 'Architecture',
    projection: 'application',
    importance: 'Validates capability structure and application dependency shape.',
  },
  security: {
    title: 'Security',
    projection: 'security',
    importance: 'Reviews trust boundaries, public exposure and identity-sensitive edges.',
  },
  data: {
    title: 'Data',
    projection: 'data',
    importance: 'Assesses data assets, stores, flows and organisational egress.',
  },
  availability: {
    title: 'Availability',
    projection: 'risk',
    importance: 'Surfaces single points of failure and resilience gaps that threaten production.',
  },
  ownership: {
    title: 'Ownership',
    projection: 'ownership',
    importance: 'Ensures accountability for incidents, changes and approvals.',
  },
  evidence: {
    title: 'Evidence',
    projection: 'all',
    importance: 'Measures how much of the model is known versus inferred or missing.',
  },
  compliance: {
    title: 'Compliance',
    projection: 'risk',
    importance: 'Evaluates blocking findings, waivers and policy posture for approval.',
  },
  recommendations: {
    title: 'Recommendations',
    projection: 'all',
    importance: 'Produces deterministic options with trade-offs for each significant concern.',
  },
  approval: {
    title: 'Approval',
    projection: 'all',
    importance: 'Assembles the decision: approve, reject, or approve with waiver.',
  },
};

export function evaluateStage(graph: EvidenceGraph, id: ReviewStageId): ReviewStageResult {
  const meta = STAGE_META[id];
  const evaluator = EVALUATORS[id];
  const result = evaluator(graph);
  if (result.skip) {
    return {
      id,
      title: meta.title,
      projection: meta.projection,
      comments: [],
      ...base('SKIPPED', {
        ...result,
        importance: meta.importance,
        conclusion: result.conclusion || `${meta.title} skipped — not applicable to this estate.`,
        decision: 'Skipped',
        risk: 'None from this stage',
        recommendation: 'Continue to next applicable stage',
        continueApproval: true,
      }),
    };
  }
  return {
    id,
    title: meta.title,
    projection: meta.projection,
    comments: [],
    ...result,
    importance: meta.importance,
  };
}

const EVALUATORS: Record<ReviewStageId, StageEval> = {
  scope: (graph) => {
    const caps = graph.resources.filter((r) => r.kind === 'business-capability');
    const envs = new Set(graph.resources.map((r) => r.environment).filter(Boolean));
    const ok = caps.length > 0 && graph.resources.length > 5;
    return base(ok ? 'PASS' : 'WARNING', {
      importance: STAGE_META.scope.importance,
      conclusion: ok
        ? `Reviewing ${graph.scan.project} with ${caps.length} capabilities across ${envs.size || 1} environment(s).`
        : 'Scope is thin — few capabilities or resources discovered.',
      evidenceIds: caps.flatMap((c) => c.evidence).slice(0, 12),
      resourceIds: caps.map((c) => c.id).slice(0, 20),
      unknowns: graph.unsupported.map((u) => u.construct).slice(0, 5),
      confidenceImprovements: ['Add capability labels in source metadata'],
      recommendation: ok ? 'Proceed with architecture review' : 'Expand discovery inputs before approval',
      findingIds: [],
      decision: ok ? 'Scope accepted' : 'Scope incomplete',
      risk: ok ? 'Low' : 'Medium — incomplete estate model',
    });
  },

  architecture: (graph) => {
    const caps = graph.resources.filter((r) => r.kind === 'business-capability' && r.subtype !== 'platform');
    const apps = graph.resources.filter((r) => ['workload', 'service', 'application'].includes(r.kind));
    const findings = graph.findings.filter((f) => /architecture|dependency|topology/i.test(f.title));
    const outcome: ReviewStageOutcome =
      caps.length >= 3 ? (findings.some((f) => f.severity === 'critical') ? 'FAIL' : 'PASS') : 'WARNING';
    return base(outcome, {
      importance: STAGE_META.architecture.importance,
      conclusion: `${caps.length} logical capabilities implemented by ${apps.length} application components.`,
      evidenceIds: [...caps, ...apps].flatMap((r) => r.evidence).slice(0, 20),
      resourceIds: [...caps, ...apps].map((r) => r.id).slice(0, 40),
      unknowns: caps.length ? [] : ['No capabilities inferred'],
      confidenceImprovements: ['Confirm capability membership with owners'],
      recommendation: 'Navigate by capability; collapse infrastructure under intent',
      findingIds: findings.map((f) => f.id),
      decision: outcome === 'PASS' ? 'Architecture structure acceptable' : 'Architecture needs clarification',
      risk: outcome === 'FAIL' ? 'High' : 'Medium',
    });
  },

  security: (graph) => {
    const routes = graph.resources.filter((r) => r.kind === 'route' || r.kind === 'ingress');
    if (!routes.length && !graph.resources.some((r) => r.kind === 'internet')) {
      return base('SKIPPED', {
        skip: true,
        importance: STAGE_META.security.importance,
        conclusion: 'No public ingress — internet exposure review skipped.',
        evidenceIds: [],
        resourceIds: [],
        unknowns: [],
        confidenceImprovements: [],
        recommendation: 'Skip internet review',
        findingIds: [],
        decision: 'Skipped',
        risk: 'None',
      });
    }
    const zones = graph.resources.filter((r) => r.kind === 'trust-zone');
    const external = graph.resources.filter((r) => r.provider === 'external' || r.kind === 'external-system');
    const findings = graph.findings.filter(
      (f) => f.status === 'open' && /public|ingress|security|exposure|iam/i.test(f.title + f.rationale),
    );
    const blocking = findings.filter((f) => f.blocksSignOff || f.severity === 'critical' || f.severity === 'high');
    const outcome: ReviewStageOutcome = blocking.length ? 'FAIL' : findings.length ? 'WARNING' : 'PASS';
    return base(outcome, {
      importance: STAGE_META.security.importance,
      conclusion: `${routes.length} public path(s), ${zones.length} trust zone(s), ${external.length} external dependenc${external.length === 1 ? 'y' : 'ies'}.`,
      evidenceIds: [...routes, ...zones, ...external].flatMap((r) => r.evidence).slice(0, 20),
      resourceIds: [...routes, ...zones, ...external].map((r) => r.id),
      unknowns: ['Effective encryption evidence may be incomplete'],
      confidenceImprovements: ['Import live network policy / WAF evidence'],
      recommendation: blocking.length
        ? 'Resolve public exposure blockers before approval'
        : 'Document intentional public paths',
      findingIds: findings.map((f) => f.id),
      decision: outcome,
      risk: blocking.length ? 'High — exposure blockers' : 'Medium',
      continueApproval: outcome !== 'FAIL',
    });
  },

  data: (graph) => {
    const assets = graph.resources.filter((r) => r.kind === 'data-asset');
    const dbs = graph.resources.filter((r) => r.kind === 'relational-database');
    if (!assets.length && !dbs.length && !graph.resources.some((r) => r.kind === 'bucket' || r.kind === 'queue')) {
      return base('SKIPPED', {
        skip: true,
        importance: STAGE_META.data.importance,
        conclusion: 'No databases or data assets — data durability review skipped.',
        evidenceIds: [],
        resourceIds: [],
        unknowns: [],
        confidenceImprovements: [],
        recommendation: 'Skip data durability',
        findingIds: [],
        decision: 'Skipped',
        risk: 'None',
      });
    }
    const egress = graph.resources.filter((r) => r.provider === 'external');
    const restricted = assets.filter((a) => a.sensitivity === 'restricted' || a.sensitivity === 'confidential');
    const outcome: ReviewStageOutcome = restricted.length && egress.length ? 'WARNING' : assets.length ? 'PASS' : 'UNKNOWN';
    return base(outcome, {
      importance: STAGE_META.data.importance,
      conclusion: `${assets.length} data asset(s); ${restricted.length} sensitive; ${egress.length} external sink(s).`,
      evidenceIds: assets.flatMap((a) => a.evidence).slice(0, 20),
      resourceIds: [...assets, ...dbs].map((r) => r.id),
      unknowns: assets.length ? [] : ['Data assets largely inferred from stores'],
      confidenceImprovements: ['Attach data classification catalogue'],
      recommendation: 'Trace customer data creation, storage and egress explicitly',
      findingIds: graph.findings.filter((f) => /data|pii|sensitive/i.test(f.title)).map((f) => f.id),
      decision: outcome === 'PASS' ? 'Data posture acceptable with known gaps' : 'Data management needs attention',
      risk: restricted.length ? 'High for sensitive data egress' : 'Medium',
    });
  },

  availability: (graph) => {
    const singleAz = graph.resources.filter(
      (r) => r.kind === 'relational-database' && (r.metadata.multi_az === false || r.metadata.multiAz === false),
    );
    const singleReplica = graph.resources.filter(
      (r) => r.kind === 'workload' && Number(r.metadata.replicas ?? 2) <= 1,
    );
    if (!graph.resources.some((r) => r.kind === 'relational-database' || r.kind === 'workload')) {
      return base('SKIPPED', {
        skip: true,
        importance: STAGE_META.availability.importance,
        conclusion: 'No workloads/databases — availability stage skipped.',
        evidenceIds: [],
        resourceIds: [],
        unknowns: [],
        confidenceImprovements: [],
        recommendation: 'Skip',
        findingIds: [],
        decision: 'Skipped',
        risk: 'None',
      });
    }
    const findings = graph.findings.filter((f) =>
      /multi-az|replica|availability|resilien/i.test(f.title + f.rationale),
    );
    const outcome: ReviewStageOutcome =
      singleAz.length || findings.some((f) => f.blocksSignOff) ? 'FAIL' : singleReplica.length ? 'WARNING' : 'PASS';
    return base(outcome, {
      importance: STAGE_META.availability.importance,
      conclusion: `${singleAz.length} non multi-AZ database(s); ${singleReplica.length} single-replica workload(s).`,
      evidenceIds: [...singleAz, ...singleReplica].flatMap((r) => r.evidence),
      resourceIds: [...singleAz, ...singleReplica].map((r) => r.id),
      unknowns: [],
      confidenceImprovements: ['Confirm backup/restore evidence'],
      recommendation: singleAz.length ? 'Enable Multi-AZ or accept with waiver' : 'Increase replicas where required',
      findingIds: findings.map((f) => f.id),
      decision: outcome,
      risk: singleAz.length ? 'High — AZ failure takes data plane offline' : 'Medium',
      continueApproval: outcome !== 'FAIL',
    });
  },

  ownership: (graph) => {
    const teams = graph.resources.filter((r) => r.kind === 'team');
    const orphans = graph.resources.filter((r) => r.tags.includes('orphaned-ownership'));
    const outcome: ReviewStageOutcome =
      orphans.length > graph.resources.length * 0.35 ? 'FAIL' : orphans.length ? 'WARNING' : teams.length ? 'PASS' : 'UNKNOWN';
    return base(outcome, {
      importance: STAGE_META.ownership.importance,
      conclusion: `${teams.length} team(s); ${orphans.length} orphaned resource(s).`,
      evidenceIds: teams.flatMap((t) => t.evidence),
      resourceIds: [...teams, ...orphans.slice(0, 15)].map((r) => r.id),
      unknowns: orphans.length ? ['Ownership metadata absent for orphans'] : [],
      confidenceImprovements: ['Annotate CODEOWNERS / ownership labels'],
      recommendation: 'Assign owners before production incidents rely on this graph',
      findingIds: [],
      decision: outcome,
      risk: orphans.length ? 'Ownership risk elevated' : 'Low',
    });
  },

  evidence: (graph) => {
    const overall = graph.completeness.overall;
    const outcome: ReviewStageOutcome =
      overall >= 0.7 ? 'PASS' : overall >= 0.45 ? 'WARNING' : overall > 0 ? 'FAIL' : 'UNKNOWN';
    return base(outcome, {
      importance: STAGE_META.evidence.importance,
      conclusion: graph.completeness.summary,
      evidenceIds: [],
      resourceIds: [],
      unknowns: graph.completeness.dimensions.flatMap((d) => d.missing).slice(0, 8),
      confidenceImprovements: graph.completeness.dimensions.flatMap((d) => d.missing).slice(0, 5),
      recommendation: 'Close evidence gaps listed before high-assurance approval',
      findingIds: [],
      decision: outcome,
      risk: outcome === 'FAIL' ? 'High evidence risk' : 'Medium',
    });
  },

  compliance: (graph) => {
    const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');
    const waivers = graph.waivers.filter((w) => w.status === 'active');
    const outcome: ReviewStageOutcome = blocking.length
      ? waivers.length
        ? 'WARNING'
        : 'FAIL'
      : 'PASS';
    return base(outcome, {
      importance: STAGE_META.compliance.importance,
      conclusion: `${blocking.length} open blocker(s); ${waivers.length} active waiver(s).`,
      evidenceIds: blocking.flatMap((f) => f.evidence).slice(0, 20),
      resourceIds: blocking.flatMap((f) => f.affectedResources),
      unknowns: graph.signOffs.length ? [] : ['No prior sign-off recorded'],
      confidenceImprovements: ['Link waivers to compensating controls'],
      recommendation: blocking.length
        ? 'Resolve blockers or raise time-bounded waivers'
        : 'Compliance path clear for approval consideration',
      findingIds: blocking.map((f) => f.id),
      decision: outcome,
      risk: blocking.length ? 'Blocks release' : 'Low',
      continueApproval: outcome !== 'FAIL',
    });
  },

  recommendations: (graph) => {
    const open = graph.findings.filter((f) => f.status === 'open' && (f.severity === 'high' || f.severity === 'critical' || f.blocksSignOff));
    return base(open.length ? 'WARNING' : 'PASS', {
      importance: STAGE_META.recommendations.importance,
      conclusion: `${open.length} significant finding(s) require optioned remediation.`,
      evidenceIds: open.flatMap((f) => f.evidence).slice(0, 20),
      resourceIds: open.flatMap((f) => f.affectedResources).slice(0, 30),
      unknowns: [],
      confidenceImprovements: [],
      recommendation: 'Compare options for each finding before deciding approval',
      findingIds: open.map((f) => f.id),
      decision: 'Recommendations generated',
      risk: 'See option trade-offs',
      continueApproval: true,
    });
  },

  approval: (graph) => {
    const blocking = graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');
    const waivers = graph.waivers.filter((w) => w.status === 'active');
    let outcome: ReviewStageOutcome = 'PASS';
    let decision = 'Approved';
    if (blocking.length && !waivers.length) {
      outcome = 'FAIL';
      decision = 'Not Ready / Changes Required';
    } else if (blocking.length && waivers.length) {
      outcome = 'WARNING';
      decision = 'Approved with Waiver (if reviewer accepts)';
    }
    return base(outcome, {
      importance: STAGE_META.approval.importance,
      conclusion: `Approval recommendation: ${decision}.`,
      evidenceIds: blocking.flatMap((f) => f.evidence).slice(0, 12),
      resourceIds: blocking.flatMap((f) => f.affectedResources),
      unknowns: [],
      confidenceImprovements: [],
      recommendation: decision,
      findingIds: blocking.map((f) => f.id),
      decision,
      risk: blocking.length ? 'Approval blocked or conditional' : 'Clear',
      continueApproval: outcome !== 'FAIL',
    });
  },
};

/** Smart review order — drop/skip inapplicable stages early and reorder for multi-cloud. */
export function smartStageOrder(graph: EvidenceGraph, requested: ReviewStageId[]): ReviewStageId[] {
  const hasPublic = graph.resources.some((r) => ['route', 'ingress', 'internet'].includes(r.kind));
  const hasData = graph.resources.some((r) =>
    ['relational-database', 'bucket', 'queue', 'data-asset'].includes(r.kind),
  );
  const multiCloud =
    new Set(graph.resources.map((r) => r.provider).filter(Boolean)).size >= 2 ||
    graph.resources.some((r) => r.provider === 'aws') &&
      graph.resources.some((r) => r.platform === 'openshift' || r.platform === 'kubernetes');

  let stages = [...requested];
  if (!hasPublic) {
    // keep security but evaluator will SKIP internet-heavy checks
  }
  if (!hasData) {
    // data stage will SKIP
  }
  if (multiCloud) {
    // trust boundaries earlier
    const sec = stages.indexOf('security');
    const arch = stages.indexOf('architecture');
    if (sec > -1 && arch > -1 && sec > arch + 1) {
      stages = stages.filter((s) => s !== 'security');
      stages.splice(arch + 1, 0, 'security');
    }
  }
  // Always end with recommendations then approval if present
  const tail: ReviewStageId[] = [];
  for (const t of ['recommendations', 'approval'] as ReviewStageId[]) {
    if (stages.includes(t)) {
      stages = stages.filter((s) => s !== t);
      tail.push(t);
    }
  }
  return [...stages, ...tail];
}
