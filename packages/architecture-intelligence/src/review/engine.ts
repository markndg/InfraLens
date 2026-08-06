import { stableId, type ArchitectPersona, type ArchitectureReview, type EvidenceGraph, type ReviewDashboard, type ReviewNotebookSection, type ReviewOutcome, type ReviewStageId } from '@infralens/graph-model';
import { computeReviewConfidence } from './confidence.js';
import { getPersona } from './personas.js';
import { getPlaybook, listPlaybooks } from './playbooks.js';
import { generateRecommendations } from './recommendations.js';
import { computeArchitecturalScorecard } from './scorecard.js';
import { evaluateStage, smartStageOrder } from './stages.js';
import { coachAfterStage } from './coach.js';

export interface StartReviewOptions {
  playbookId?: string;
  persona?: ArchitectPersona;
  reviewer?: string;
  repository?: string;
  commercial?: boolean;
}

export function buildReviewDashboard(
  graph: EvidenceGraph,
  prior?: ArchitectureReview[],
): ReviewDashboard {
  const critical = graph.findings.filter(
    (f) => f.status === 'open' && (f.severity === 'critical' || (f.blocksSignOff && f.severity === 'high')),
  );
  const concerns = graph.findings.filter(
    (f) => f.status === 'open' && (f.severity === 'high' || f.severity === 'medium'),
  );
  const gaps = graph.completeness.dimensions.flatMap((d) => d.missing);
  const unknowns = [
    ...gaps,
    ...graph.resources
      .filter((r) => r.confidence.band === 'unknown' || r.truthStates.includes('assumed'))
      .map((r) => r.displayName),
  ];
  const waivers = graph.waivers.filter((w) => w.status === 'active').length;
  const lastApproval = [...graph.signOffs, ...(prior ?? [])]
    .map((x) => ('timestamp' in x ? x.timestamp : x.date))
    .filter(Boolean)
    .sort()
    .reverse()[0];
  let lastApprovalDaysAgo: number | undefined;
  if (lastApproval) {
    lastApprovalDaysAgo = Math.max(
      0,
      Math.round((Date.now() - new Date(lastApproval).getTime()) / (24 * 3600 * 1000)),
    );
  }

  const readyScore = Math.max(
    0,
    Math.min(
      1,
      (graph.intelligence?.health.approvalReadiness.score ?? 0.3) *
        (1 - Math.min(0.6, critical.length * 0.12)) *
        (0.5 + graph.completeness.overall * 0.5),
    ),
  );

  const reasons: string[] = [];
  if (critical.length) reasons.push(`${critical.length} critical findings`);
  if (concerns.length) reasons.push(`${concerns.length} architectural concerns`);
  if (gaps.length) reasons.push(`${Math.min(gaps.length, 12)} evidence gaps`);
  if (!reasons.length) reasons.push('No open critical blockers detected from current evidence');

  const status: ReviewDashboard['status'] =
    critical.length === 0 && readyScore >= 0.65
      ? waivers
        ? 'READY WITH WAIVERS'
        : 'READY'
      : 'NOT READY';

  let trend: ReviewDashboard['trend'] = 'unknown';
  if (prior && prior.length >= 1) {
    const prevReady = prior[prior.length - 1]!.dashboard.architectureReady;
    if (readyScore > prevReady + 0.05) trend = 'improving';
    else if (readyScore < prevReady - 0.05) trend = 'regressing';
    else trend = 'stable';
  }

  const estimated = Math.min(45, Math.max(8, 6 + critical.length * 2 + concerns.length + Math.ceil(gaps.length / 3)));

  return {
    architectureReady: readyScore,
    criticalBlockers: critical.length,
    architecturalConcerns: concerns.length,
    evidenceGaps: Math.min(gaps.length, 99),
    unknowns: unknowns.length,
    waivers,
    reviewTimeMinutes: estimated,
    lastApprovalDaysAgo,
    trend,
    status,
    reasons,
  };
}

export function createArchitectureReview(
  graph: EvidenceGraph,
  options: StartReviewOptions = {},
): ArchitectureReview {
  const commercial = options.commercial ?? graph.scan.edition === 'commercial';
  const persona = options.persona ?? 'enterprise';
  const lens = getPersona(persona);
  const playbook = getPlaybook(options.playbookId ?? lens.defaultPlaybookId);
  if (playbook.commercial && !commercial) {
    // Fall back to OSS architecture-board
    return createArchitectureReview(graph, {
      ...options,
      playbookId: 'architecture-board',
      persona: 'enterprise',
      commercial: false,
    });
  }

  const personaOrder = lens.stageOrder.filter((s) => playbook.stages.includes(s));
  const stagesOrder = smartStageOrder(graph, personaOrder.length ? personaOrder : playbook.stages);

  const stages = stagesOrder.map((id) => evaluateStage(graph, id));
  const recommendations = generateRecommendations(graph);
  const scorecard = computeArchitecturalScorecard(graph);
  const confidence = computeReviewConfidence(graph);
  const dashboard = buildReviewDashboard(graph, graph.reviews);
  const notebook: ReviewNotebookSection[] = stages.map((s) => ({
    stageId: s.id,
    title: s.title,
    evidence: s.evidenceIds,
    decision: s.decision,
    reason: s.conclusion,
    risk: s.risk,
    recommendation: s.recommendation,
    comments: s.comments,
    unknowns: s.unknowns,
    outcome: s.outcome,
  }));

  const outcome = deriveOutcome(stages, dashboard);
  const review: ArchitectureReview = {
    id: stableId('review', graph.scan.id, String(Date.now())),
    version: '1.4',
    playbookId: playbook.id,
    persona,
    date: new Date().toISOString(),
    reviewer: options.reviewer ?? 'architect@local',
    repository: options.repository ?? graph.scan.project,
    scanBundleId: graph.scan.id,
    evidenceHash: graph.scan.contentHash,
    status: 'in-progress',
    outcome: 'In Progress',
    stages,
    recommendations,
    scorecard,
    confidence,
    dashboard,
    notebook,
    coachNotes: [],
    estimatedMinutes: dashboard.reviewTimeMinutes,
    completedStageIds: [],
  };

  // Seed coach for first stage
  review.coachNotes = [`Start with ${stages[0]?.title ?? 'Scope'}. Estimated ${review.estimatedMinutes} minutes.`];
  void outcome;
  return review;
}

export function completeStage(
  review: ArchitectureReview,
  stageId: ReviewStageId,
  comment?: string,
): ArchitectureReview {
  const next = structuredClone(review);
  if (!next.completedStageIds.includes(stageId)) next.completedStageIds.push(stageId);
  const stage = next.stages.find((s) => s.id === stageId);
  if (stage && comment) stage.comments = [...stage.comments, comment];
  next.notebook = next.stages.map((s) => ({
    stageId: s.id,
    title: s.title,
    evidence: s.evidenceIds,
    decision: s.decision,
    reason: s.conclusion,
    risk: s.risk,
    recommendation: s.recommendation,
    comments: s.comments,
    unknowns: s.unknowns,
    outcome: s.outcome,
  }));
  next.coachNotes = [...next.coachNotes, coachAfterStage(next, stageId)];
  return next;
}

export function finalizeReview(
  review: ArchitectureReview,
  decision?: 'Approved' | 'Rejected' | 'Approved with Waiver',
): ArchitectureReview {
  const next = structuredClone(review);
  next.status = 'completed';
  next.completedStageIds = next.stages.map((s) => s.id);
  next.outcome = decision ?? deriveOutcome(next.stages, next.dashboard);
  next.coachNotes = [...next.coachNotes, `Review finalized: ${next.outcome}.`];
  return next;
}

export function persistReview(graph: EvidenceGraph, review: ArchitectureReview): ArchitectureReview {
  graph.reviews = [...(graph.reviews ?? []).filter((r) => r.id !== review.id), review];
  if (graph.intelligence) {
    graph.intelligence.reviewDashboard = review.dashboard;
    graph.intelligence.activeReviewId = review.id;
    graph.intelligence.version = '1.4';
  }
  graph.version = '1.4';
  return review;
}

export function runFullReview(graph: EvidenceGraph, options: StartReviewOptions = {}): ArchitectureReview {
  let review = createArchitectureReview(graph, options);
  for (const stage of review.stages) {
    review = completeStage(review, stage.id);
  }
  review = finalizeReview(review);
  persistReview(graph, review);
  return review;
}

function deriveOutcome(
  stages: ArchitectureReview['stages'],
  dashboard: ReviewDashboard,
): ReviewOutcome {
  const fails = stages.filter((s) => s.outcome === 'FAIL');
  if (fails.length) return dashboard.waivers ? 'Changes Required' : 'Not Ready';
  if (dashboard.waivers) return 'Approved with Waiver';
  if (dashboard.status === 'READY') return 'Approved';
  return 'Changes Required';
}

export function availablePlaybooks(commercial: boolean) {
  return listPlaybooks({ commercial });
}
