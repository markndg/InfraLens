import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import {
  buildTimeline,
  computeBusinessBlastRadius,
  createArchitectureReview,
  persistReview,
  simulateArchitectureChange,
  type MissionId,
  type StartReviewOptions,
} from '@infralens/architecture-intelligence';
import {
  capabilityMatrix,
  isCapabilityEnabled,
  resolveEdition,
  type InfraLensEdition,
} from '@infralens/edition-capabilities';
import type {
  ArchitectureReview,
  ArchitectureView,
  EvidenceGraph,
  ScanBundle,
} from '@infralens/graph-model';
import { resolveEntityVisual } from '@infralens/icons';
import { ensureInternetNode } from '@infralens/reachability';
import { compareBundles } from '@infralens/reconciliation';
import { scanFiles } from '@infralens/scanner/browser';
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  FileSearch,
  Focus,
  GitCompare,
  Layers3,
  List,
  Map as MapIcon,
  Route,
  Search,
} from 'lucide-react';
import { BoundaryNode, LaneLabelNode } from './components/BoundaryNode';
import { CorridorEdge } from './components/CorridorEdge';
import { InfraNode, type FocusRole } from './components/InfraNode';
import { Inspector, generateArchitecturalStatement } from './components/Inspector';
import { LayoutDebugOverlay } from './components/LayoutDebugOverlay';
import { Legend } from './components/Legend';
import { ListView } from './components/ListView';
import { ProjectionIntegrityPanel } from './components/ProjectionIntegrityPanel';
import { QueryResultPanel } from './components/QueryResultPanel';
import { demoFiles, demoSnapshots } from './demoEstate';
import {
  clearLayoutCache,
  getLastLayoutGraph,
  getProjectionIntegrity,
  getSemanticProjection,
  resourcesForView,
  setLayoutDebug,
  toArchitectureFlow,
  type ZoomBand,
} from './lib/architectureLayout';
import { getProjectionContract } from './projection';
import { computeFocus } from './lib/focus';
import {
  concludeBlastRadius,
  concludeReachability,
  concludeTypedQuery,
  type QueryConclusion,
} from './lib/queryResults';
import {
  ArchitectureDNAPanel,
  ArchitectureStoryPanel,
  ComponentIntelligence,
  MissionPanel,
  RiskHealthPanel,
  TimelinePanel,
} from './workbench/IntelligencePanels';
import { GovernanceLanding } from './workbench/GovernanceConsole';
import { ActiveReviewPanel, ScorecardPanel } from './workbench/ReviewConsole';

const nodeTypes = {
  infra: InfraNode,
  boundary: BoundaryNode,
  laneLabel: LaneLabelNode,
};

const edgeTypes = {
  corridor: CorridorEdge,
};

/** Evidence explorer projections (secondary to review). */
const PROJECTIONS: ArchitectureView[] = [
  'decision',
  'governance',
  'capability',
  'application',
  'physical',
  'data',
  'ownership',
  'security',
  'risk',
  'cost',
  'time',
  'dna',
  'executive',
  'drift',
  'signoff',
];

type AppMode = 'review' | 'explore';

export default function App() {
  const [edition, setEdition] = useState<InfraLensEdition>(resolveEdition());
  const [bundle, setBundle] = useState<ScanBundle | null>(null);
  const [baseline, setBaseline] = useState<ScanBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AppMode>('review');
  const [review, setReview] = useState<ArchitectureReview | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [showEvidence, setShowEvidence] = useState(false);
  const [view, setView] = useState<ArchitectureView>('capability');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const [depth, setDepth] = useState(2);
  const [zoomBand, setZoomBand] = useState<ZoomBand>('medium');
  const [queryResult, setQueryResult] = useState<QueryConclusion | null>(null);
  const [simNote, setSimNote] = useState('');
  const [signOffMsg, setSignOffMsg] = useState('');
  const [showMinimap, setShowMinimap] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [collapsedBoundaries, setCollapsedBoundaries] = useState<Set<string>>(new Set());
  const [missionId, setMissionId] = useState<MissionId>();
  const [missionHighlight, setMissionHighlight] = useState<string[]>([]);
  const [timelineIndex, setTimelineIndex] = useState(1);
  const [layoutDebug, setLayoutDebugState] = useState(false);
  const [projectionIntegrityOpen, setProjectionIntegrityOpen] = useState(false);

  useEffect(() => {
    setLayoutDebug(layoutDebug);
  }, [layoutDebug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      clearLayoutCache();
      const scanned = await scanFiles(demoFiles, {
        project: 'Retail SaaS reference estate',
        edition,
        snapshots: demoSnapshots,
      });
      if (!cancelled) {
        const approvedFiles = demoFiles.map((f) =>
          f.path === 'deploy/openshift.yaml'
            ? {
                ...f,
                content: f.content.replace(
                  /---\napiVersion: route\.openshift\.io\/v1\nkind: Route\nmetadata: \{ name: admin[\s\S]*?termination: edge \}\n/,
                  '',
                ),
              }
            : f,
        );
        const approved = await scanFiles(approvedFiles, {
          project: 'Retail SaaS reference estate',
          edition,
          snapshots: {
            awsInventory: {
              ...(demoSnapshots.awsInventory as object),
              resources: (demoSnapshots.awsInventory as { resources: unknown[] }).resources.filter(
                (r) => (r as { name?: string }).name !== 'retail-prod-assets-logs',
              ),
            },
          },
        });
        approved.graph.signOffs.push({
          id: 'signoff-approved-demo',
          scanBundleId: approved.graph.scan.id,
          project: approved.graph.scan.project,
          planStateHashes: [],
          liveInventoryTimestamps: [],
          environment: 'production',
          scope: 'retail-prod',
          reviewer: 'architect@example.com',
          findingsSummary: {
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            info: 0,
            openBlocking: 0,
          },
          unresolvedUnknowns: [],
          acceptedWaivers: [],
          comments: ['Approved previous architecture without admin route'],
          decision: 'Approved',
          timestamp: '2026-07-01T00:00:00.000Z',
          materialChangeRules: ['new public ingress'],
          evidenceHashes: [approved.graph.scan.contentHash],
        });
        setBaseline(approved);
        setBundle(scanned);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [edition]);

  const timeline = useMemo(() => {
    if (!bundle || !baseline) return null;
    if (!isCapabilityEnabled('temporalTimeline', edition)) return null;
    return buildTimeline([baseline, bundle]);
  }, [bundle, baseline, edition]);

  const graph = useMemo(() => {
    if (!bundle) return undefined;
    if (timeline?.frames.length && view === 'time') {
      return timeline.frames[Math.min(timelineIndex, timeline.frames.length - 1)]?.graph ?? bundle.graph;
    }
    return bundle.graph;
  }, [bundle, timeline, timelineIndex, view]);

  const flow = useMemo(() => {
    if (!graph) {
      return {
        nodes: [] as Node[],
        edges: [] as Edge[],
        integrity: null as ReturnType<typeof toArchitectureFlow>['integrity'] | null,
      };
    }
    return toArchitectureFlow(graph, view, zoomBand);
  }, [graph, view, zoomBand, layoutDebug]);

  const statement = useMemo(() => {
    if (!graph || !selected) return '';
    const resource = graph.resources.find((r) => r.id === selected);
    if (!resource) return '';
    return generateArchitecturalStatement(resource, graph).statement;
  }, [graph, selected]);

  const visible = useMemo(() => {
    if (!graph) return flow;
    return applyPresentation(flow.nodes, flow.edges, graph, {
      query,
      selected,
      depth,
      view,
      pathIds: [
        ...(queryResult?.pathIds ?? queryResult?.highlightIds ?? []),
        ...missionHighlight,
      ],
      collapsedBoundaries,
    });
  }, [flow, graph, query, selected, depth, view, queryResult, collapsedBoundaries, missionHighlight]);

  const selectedResource = graph?.resources.find((r) => r.id === selected);
  const comparison = baseline && bundle ? compareBundles(baseline, bundle) : null;
  const viewResources = graph ? resourcesForView(graph, view, zoomBand) : [];

  function runPathQuestion(kind: 'internet-db' | 'worker-payment' | 'depends-bucket') {
    if (!graph) return;
    ensureInternetNode(graph);
    if (kind === 'internet-db') {
      const internet = graph.resources.find((r) => r.kind === 'internet')!;
      const db = graph.resources.find((r) => r.kind === 'relational-database');
      if (!db) return;
      const conclusion = concludeReachability(
        graph,
        internet.id,
        db.id,
        edition,
        'Can the internet reach catalog-db?',
      );
      setQueryResult(conclusion);
      setSelected(db.id);
      return;
    }
    if (kind === 'worker-payment') {
      const worker = graph.resources.find((r) => r.name === 'order-worker');
      const payment = graph.resources.find((r) => r.name.includes('payments.partner'));
      if (!worker || !payment) return;
      setQueryResult(
        concludeReachability(
          graph,
          worker.id,
          payment.id,
          edition,
          'Can order-worker reach the payment provider?',
        ),
      );
      setSelected(worker.id);
      return;
    }
    const bucket = graph.resources.find((r) => r.kind === 'bucket');
    if (!bucket) return;
    setQueryResult(concludeBlastRadius(graph, bucket.id));
    setSelected(bucket.id);
  }

  function runTypedQuery(
    type: 'public-ingress' | 'data-stores' | 'observed-not-declared' | 'single-points-of-failure',
  ) {
    if (!graph) return;
    const labels = {
      'public-ingress': 'Show public ingress',
      'data-stores': 'Show data stores',
      'observed-not-declared': 'Show resources observed but not declared',
      'single-points-of-failure': 'Show single points of failure',
    } as const;
    const conclusion = concludeTypedQuery(graph, type, labels[type]);
    setQueryResult(conclusion);
    if (conclusion.highlightIds[0]) setSelected(conclusion.highlightIds[0]);
  }

  function handleFollowUp(prompt: string) {
    if (!graph || !queryResult) return;
    if (/exact path/i.test(prompt) && queryResult.pathIds.length) {
      setQueryResult({
        ...queryResult,
        explanation:
          queryResult.explanation +
          `\n\nExact path:\n${queryResult.pathIds
            .map((id) => graph.resources.find((r) => r.id === id)?.displayName ?? id)
            .join(' → ')}`,
      });
      return;
    }
    if (/missing network evidence/i.test(prompt)) {
      setQueryResult({
        ...queryResult,
        explanation:
          queryResult.explanation +
          `\n\nMissing evidence:\n${(queryResult.missing.length ? queryResult.missing : ['None listed']).map((m) => `- ${m}`).join('\n')}`,
      });
      return;
    }
    if (/consumers of/i.test(prompt) && selected) {
      setQueryResult(concludeBlastRadius(graph, selected));
    }
  }

  function simulateRemoveAdmin() {
    if (!bundle || !isCapabilityEnabled('counterfactualSimulation', edition)) {
      setSimNote('Counterfactual simulation requires commercial edition (or feature override).');
      return;
    }
    const admin = bundle.graph.resources.find((r) => r.name === 'admin' && r.kind === 'route');
    if (!admin) {
      setSimNote('Admin route not present.');
      return;
    }
    const before = computeBusinessBlastRadius(bundle.graph, admin.id);
    const result = simulateArchitectureChange(bundle.graph, { type: 'remove', resourceId: admin.id });
    const next = structuredClone(bundle);
    next.graph = result.graph;
    const note = `${result.note}. Capabilities previously in blast radius: ${before.capabilities.length}. ${result.approvalImpact} No production change.`;
    clearLayoutCache();
    setBundle(next);
    setSimNote(note);
    setQueryResult({
      id: 'sim-admin',
      question: 'Simulate removing admin route',
      answer: 'Admin public ingress removed from the graph-only simulation.',
      confidence: 'high',
      explanation: note,
      pathIds: [],
      missing: [],
      evidenceIds: [],
      impact: result.approvalImpact,
      followUps: ['Show public ingress', 'Attempt sign-off review', 'Compare with approved'],
      highlightIds: result.affectedIds,
    });
  }

  function simulateEnableMultiAz() {
    if (!bundle || !isCapabilityEnabled('counterfactualSimulation', edition)) {
      setSimNote('Counterfactual simulation requires commercial edition.');
      return;
    }
    const db = bundle.graph.resources.find((r) => r.kind === 'relational-database');
    if (!db) return;
    const result = simulateArchitectureChange(bundle.graph, { type: 'enable-multi-az', resourceId: db.id });
    const next = structuredClone(bundle);
    next.graph = result.graph;
    clearLayoutCache();
    setBundle(next);
    setSimNote(`${result.note}. ${result.approvalImpact}`);
  }

  function attemptSignOff() {
    if (!bundle || !isCapabilityEnabled('architectSignOff', edition)) {
      setSignOffMsg('Architect sign-off requires commercial edition.');
      return;
    }
    const blocking = bundle.graph.findings.filter((f) => f.blocksSignOff && f.status === 'open');
    if (blocking.length) {
      setSignOffMsg(`Sign-off blocked:\n${blocking.map((f) => `- ${f.severity}: ${f.title}`).join('\n')}`);
      return;
    }
    bundle.graph.signOffs.push({
      id: `signoff-${Date.now()}`,
      scanBundleId: bundle.graph.scan.id,
      project: bundle.graph.scan.project,
      planStateHashes: [],
      liveInventoryTimestamps: [],
      environment: 'production',
      scope: 'full',
      reviewer: 'architect@example.com',
      findingsSummary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        openBlocking: 0,
      },
      unresolvedUnknowns: [],
      acceptedWaivers: [],
      comments: ['Approved'],
      decision: 'Approved',
      timestamp: new Date().toISOString(),
      materialChangeRules: [],
      evidenceHashes: [bundle.graph.scan.contentHash],
    });
    setBundle({ ...bundle });
    setSignOffMsg('Approved.');
  }

  function startReview(opts: StartReviewOptions) {
    if (!graph) return;
    const started = createArchitectureReview(graph, opts);
    persistReview(graph, started);
    setReview(started);
    setStageIndex(0);
    setShowEvidence(false);
    setMode('review');
    const first = started.stages[0];
    if (first?.projection && first.projection !== 'all') {
      setView(first.projection as ArchitectureView);
    }
    setMissionHighlight(first?.resourceIds ?? []);
  }

  function showStageEvidence(resourceIds: string[], projectionHint?: string) {
    setShowEvidence(true);
    setMissionHighlight(resourceIds);
    if (projectionHint && projectionHint !== 'all') {
      setView(projectionHint as ArchitectureView);
    }
  }

  if (loading || !graph || !bundle) {
    return (
      <div className="boot">
        <h1>InfraLens</h1>
        <p>Preparing architecture governance for the Retail SaaS estate…</p>
      </div>
    );
  }

  const intel = graph.intelligence;
  const dash = intel?.governance?.dashboard;
  const reviewDash = intel?.reviewDashboard;
  const timelineFrame = timeline?.frames[Math.min(timelineIndex, (timeline?.frames.length ?? 1) - 1)];
  const inActiveReview = mode === 'review' && review != null;
  const showGraph = mode === 'explore' || showEvidence;

  return (
    <div className="app-shell workbench review-console">
      <header>
        <div>
          <h1>InfraLens</h1>
          <p>
            Architecture Governance · {graph.scan.project} · {edition} edition
          </p>
        </div>
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === 'review' ? 'active' : ''}
            onClick={() => {
              setMode('review');
              setShowEvidence(false);
            }}
          >
            Governance
          </button>
          <button
            type="button"
            className={mode === 'explore' ? 'active' : ''}
            onClick={() => setMode('explore')}
          >
            Evidence
          </button>
        </div>
        <label className="edition">
          Edition
          <select
            value={edition}
            onChange={(e) => setEdition(e.target.value as InfraLensEdition)}
            aria-label="Edition"
          >
            <option value="oss">OSS</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
      </header>

      <div className="metrics">
        <div>
          <CheckCircle2 size={15} />
          <span>
            <b>{Math.round((dash?.architectureHealth ?? reviewDash?.architectureReady ?? 0) * 100)}%</b> architecture
            health
          </span>
        </div>
        <div>
          <AlertTriangle size={15} />
          <span>
            <b>{dash?.brokenAssumptions ?? 0}</b> broken assumptions
          </span>
        </div>
        <div>
          <FileSearch size={15} />
          <span>
            <b>{dash?.invalidAdrs ?? 0}</b> invalid ADRs
          </span>
        </div>
        <div>
          <Layers3 size={15} />
          <span>
            <b>{dash?.intentDrift ?? 0}</b> intent drift
          </span>
        </div>
        <div>
          <Fingerprint size={15} />
          <span>
            <b>{dash?.outstandingObligations ?? 0}</b> obligations
          </span>
        </div>
        <div>
          <GitCompare size={15} />
          <span>
            <b>{dash?.status ?? '—'}</b> governance
          </span>
        </div>
      </div>

      {mode === 'explore' && (
        <div className="view-bar" role="tablist" aria-label="Architecture projections">
          {PROJECTIONS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={view === v ? 'active' : ''}
              onClick={() => setView(v)}
              title={getProjectionContract(v).architecturalQuestion}
            >
              {getProjectionContract(v).title}
            </button>
          ))}
          <button
            type="button"
            className={listMode ? 'active' : ''}
            onClick={() => setListMode((v) => !v)}
            aria-pressed={listMode}
            title="List view"
          >
            <List size={14} /> List
          </button>
        </div>
      )}

      {inActiveReview && review && (
        <div className="view-bar review-stage-bar" aria-label="Active review stage">
          <span className="muted">Active review · {review.stages[stageIndex]?.title}</span>
          <button type="button" className={showEvidence ? 'active' : ''} onClick={() => setShowEvidence((v) => !v)}>
            {showEvidence ? 'Hide evidence graph' : 'Show evidence graph'}
          </button>
          <button
            type="button"
            onClick={() => {
              setReview(null);
              setShowEvidence(false);
            }}
          >
            End review session
          </button>
        </div>
      )}

      {showGraph && mode === 'explore' && (
        <div className="projection-summary-bar" aria-live="polite">
          <div>
            <strong>{getProjectionContract(view).title}</strong>
            <span className="projection-question">{getProjectionContract(view).architecturalQuestion}</span>
          </div>
          <p>{getSemanticProjection()?.summary ?? getProjectionContract(view).purpose}</p>
        </div>
      )}

      {statement && showGraph && (
        <div className="statement-bar" aria-live="polite">
          <Focus size={14} />
          <p>{statement}</p>
        </div>
      )}

      {mode === 'review' && !review ? (
        <main className="review-main">
          <GovernanceLanding
            graph={graph}
            edition={edition}
            baseline={baseline}
            onStartReview={startReview}
            onExplore={() => setMode('explore')}
            onDecisionGraph={() => {
              setMode('explore');
              setView('decision');
              setShowEvidence(true);
            }}
            onHighlight={(ids) => {
              setMissionHighlight(ids);
              setMode('explore');
              setView('decision');
            }}
          />
        </main>
      ) : (
        <main className={showGraph ? '' : 'review-main-split'}>
          <aside className="left-panel">
            {inActiveReview && review ? (
              <>
                <h2>
                  <Focus size={16} /> Review stages
                </h2>
                <ScorecardPanel review={review} />
                <MissionPanel
                  graph={graph}
                  edition={edition}
                  missionId={missionId}
                  onMission={(id) => {
                    setMissionId(id);
                    setShowEvidence(true);
                  }}
                  onHighlight={(ids) => {
                    setMissionHighlight(ids);
                    setShowEvidence(true);
                  }}
                />
                {isCapabilityEnabled('counterfactualSimulation', edition) && (
                  <>
                    <h3>Counterfactual review</h3>
                    <div className="stack">
                      <button type="button" onClick={simulateRemoveAdmin}>
                        Simulate remove admin route
                      </button>
                      <button type="button" onClick={simulateEnableMultiAz}>
                        Simulate enable Multi-AZ
                      </button>
                    </div>
                    {simNote && <pre className="narrative">{simNote}</pre>}
                  </>
                )}
              </>
            ) : (
              <>
                <h2>
                  <Focus size={16} /> Investigation
                </h2>
                <label>
                  <span>Search</span>
                  <div className="search">
                    <Search size={15} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="capability, data, team…"
                    />
                  </div>
                </label>
                <label>
                  <span>Abstraction</span>
                  <select
                    value={zoomBand}
                    onChange={(e) => setZoomBand(e.target.value as ZoomBand)}
                    aria-label="Abstraction level"
                  >
                    <option value="far">Capability / systems</option>
                    <option value="medium">Services</option>
                    <option value="near">Deployment detail</option>
                  </select>
                </label>
                <MissionPanel
                  graph={graph}
                  edition={edition}
                  missionId={missionId}
                  onMission={setMissionId}
                  onHighlight={setMissionHighlight}
                />
                <TimelinePanel
                  edition={edition}
                  frameIndex={timelineIndex}
                  frameCount={timeline?.frames.length ?? 2}
                  riskSummary={timelineFrame?.riskSummary ?? 'Load commercial edition for timeline'}
                  onChange={(i) => {
                    setTimelineIndex(i);
                    setView('time');
                  }}
                  deltas={{
                    added: timelineFrame?.added.length ?? 0,
                    removed: timelineFrame?.removed.length ?? 0,
                    changed: timelineFrame?.changed.length ?? 0,
                  }}
                />
                <h3>Path explorer</h3>
                <div className="stack">
                  <button type="button" onClick={() => runPathQuestion('internet-db')}>
                    <Route size={14} /> Can internet reach catalog-db?
                  </button>
                  <button type="button" onClick={() => runPathQuestion('worker-payment')}>
                    Can order-worker reach payments?
                  </button>
                  <button type="button" onClick={() => runPathQuestion('depends-bucket')}>
                    What depends on the bucket?
                  </button>
                </div>
                <h3>Review questions</h3>
                <div className="stack">
                  <button type="button" onClick={() => runTypedQuery('public-ingress')}>
                    Review public exposure
                  </button>
                  <button type="button" onClick={() => runTypedQuery('data-stores')}>
                    Review data management
                  </button>
                  <button type="button" onClick={() => runTypedQuery('observed-not-declared')}>
                    Observed not declared
                  </button>
                  <button type="button" onClick={() => runTypedQuery('single-points-of-failure')}>
                    Review operational impact
                  </button>
                </div>
                {isCapabilityEnabled('counterfactualSimulation', edition) && (
                  <>
                    <h3>Future state</h3>
                    <div className="stack">
                      <button type="button" onClick={simulateRemoveAdmin}>
                        Remove admin route
                      </button>
                      <button type="button" onClick={simulateEnableMultiAz}>
                        Enable Multi-AZ database
                      </button>
                    </div>
                  </>
                )}
                <h3>Canvas</h3>
                <div className="stack">
                  <button type="button" onClick={() => setShowMinimap((v) => !v)}>
                    <MapIcon size={14} /> {showMinimap ? 'Hide' : 'Show'} minimap
                  </button>
                  <button
                    type="button"
                    className={layoutDebug ? 'active' : ''}
                    onClick={() => setLayoutDebugState((v) => !v)}
                  >
                    Layout debug
                  </button>
                  {(view === 'application' || view === 'security') && (
                    <button
                      type="button"
                      className={projectionIntegrityOpen ? 'active' : ''}
                      onClick={() => setProjectionIntegrityOpen((v) => !v)}
                    >
                      Projection integrity
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>

          {showGraph ? (
            <section className="canvas" aria-label="Supporting evidence graph">
              {queryResult && (
                <QueryResultPanel
                  result={queryResult}
                  onDismiss={() => setQueryResult(null)}
                  onFollowUp={handleFollowUp}
                />
              )}
              {projectionIntegrityOpen && (view === 'application' || view === 'security') && (
                <ProjectionIntegrityPanel
                  report={getProjectionIntegrity() ?? flow.integrity ?? null}
                  onClose={() => setProjectionIntegrityOpen(false)}
                />
              )}
              {listMode ? (
                <ListView
                  graph={graph}
                  resources={viewResources}
                  selected={selected}
                  onSelect={setSelected}
                />
              ) : (
                <ReactFlowProvider>
                  <ArchitectureCanvas
                    nodes={visible.nodes}
                    edges={visible.edges}
                    showMinimap={showMinimap}
                    layoutDebug={layoutDebug}
                    smallGraph={viewResources.length < 18}
                    onSelect={setSelected}
                    onClear={() => setSelected(undefined)}
                    onZoomBand={setZoomBand}
                    onBoundaryToggle={(id) =>
                      setCollapsedBoundaries((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                  />
                  <Legend view={view} />
                </ReactFlowProvider>
              )}
            </section>
          ) : (
            <section className="review-center" aria-label="Architecture review">
              {inActiveReview && review ? (
                <ActiveReviewPanel
                  graph={graph}
                  review={review}
                  edition={edition}
                  stageIndex={stageIndex}
                  onReviewChange={setReview}
                  onStageIndex={setStageIndex}
                  onShowEvidence={showStageEvidence}
                  onFinish={(done) => {
                    setReview(done);
                    setBundle({ ...bundle });
                  }}
                />
              ) : null}
            </section>
          )}

          <aside className="right-panel">
            {inActiveReview && review && showGraph ? (
              <ActiveReviewPanel
                graph={graph}
                review={review}
                edition={edition}
                stageIndex={stageIndex}
                onReviewChange={setReview}
                onStageIndex={setStageIndex}
                onShowEvidence={showStageEvidence}
                onFinish={(done) => {
                  setReview(done);
                  setBundle({ ...bundle });
                }}
              />
            ) : view === 'signoff' || view === 'drift' ? (
              <ReviewPanel
                graph={graph}
                comparison={comparison}
                edition={edition}
                onSignOff={attemptSignOff}
                signOffMsg={signOffMsg}
                simNote={simNote}
              />
            ) : view === 'dna' ? (
              <>
                <ArchitectureDNAPanel graph={graph} edition={edition} />
                <RiskHealthPanel graph={graph} />
              </>
            ) : selectedResource ? (
              <>
                <ComponentIntelligence graph={graph} resourceId={selectedResource.id} />
                <Inspector
                  graph={graph}
                  resource={selectedResource}
                  statement={statement}
                  projection={getSemanticProjection()}
                />
              </>
            ) : inActiveReview && review ? (
              <ScorecardPanel review={review} />
            ) : (
              <NarrativePanel graph={graph} edition={edition} />
            )}
          </aside>
        </main>
      )}
    </div>
  );
}

function ArchitectureCanvas({
  nodes,
  edges,
  showMinimap,
  layoutDebug,
  smallGraph,
  onSelect,
  onClear,
  onZoomBand,
  onBoundaryToggle,
}: {
  nodes: Node[];
  edges: Edge[];
  showMinimap: boolean;
  layoutDebug: boolean;
  smallGraph: boolean;
  onSelect: (id: string) => void;
  onClear: () => void;
  onZoomBand: (z: ZoomBand) => void;
  onBoundaryToggle: (id: string) => void;
}) {
  const debug = layoutDebug ? getLastLayoutGraph()?.debug ?? null : null;
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, n) => {
        if (n.type === 'boundary') onBoundaryToggle(n.id);
        else if (n.type !== 'laneLabel') onSelect(n.id);
      }}
      onPaneClick={onClear}
      fitView
      fitViewOptions={{ padding: 0.12, includeHiddenNodes: false }}
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      onMove={(_, viewport) => {
        if (viewport.zoom < 0.55) onZoomBand('far');
        else if (viewport.zoom > 1.15) onZoomBand('near');
        else onZoomBand('medium');
      }}
      defaultEdgeOptions={{ type: 'corridor', zIndex: 1 }}
      elevateNodesOnSelect
      nodesFocusable
      elementsSelectable
    >
      <Background gap={28} color="#e4dcf2" />
      {layoutDebug && debug && (
        <ViewportPortal>
          <div className="layout-debug-layer">
            <LayoutDebugOverlay debug={debug} />
          </div>
        </ViewportPortal>
      )}
      {(showMinimap || !smallGraph) && showMinimap && (
        <MiniMap
          pannable
          zoomable
          className="il-minimap"
          style={{ width: 140, height: 90 }}
          maskColor="rgba(122,0,230,0.08)"
          nodeColor={(node) => {
            const data = node.data as {
              resource?: { kind?: string; provider?: string; subtype?: string; platform?: string };
              techKey?: string;
              techLabel?: string;
            };
            const resource = data?.resource;
            if (!resource?.kind) return '#cbbce6';
            return resolveEntityVisual({
              kind: resource.kind,
              provider: resource.provider,
              subtype: resource.subtype,
              platform: resource.platform,
              techKey: data.techKey,
              techLabel: data.techLabel,
            }).theme.accent;
          }}
        />
      )}
      <Controls />
      <FitOnce />
    </ReactFlow>
  );
}

function FitOnce() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.12, duration: 200 }), 40);
    return () => window.clearTimeout(t);
  }, [fitView]);
  return null;
}

function NarrativePanel({ graph, edition }: { graph: EvidenceGraph; edition: InfraLensEdition }) {
  return (
    <>
      <div className="panel-title">
        <span className="provider-chip">workbench</span>
        <h2>Architecture intelligence</h2>
        <p>One evidence graph · many projections</p>
      </div>
      <ArchitectureStoryPanel graph={graph} />
      <ArchitectureDNAPanel graph={graph} edition={edition} />
      <RiskHealthPanel graph={graph} />
      <section>
        <h3>Evidence completeness</h3>
        {graph.completeness.dimensions.map((d) => (
          <div key={d.id} className="completeness-row">
            <span>{d.label}</span>
            <b>{Math.round(d.score * 100)}%</b>
          </div>
        ))}
      </section>
    </>
  );
}

function ReviewPanel({
  graph,
  comparison,
  edition,
  onSignOff,
  signOffMsg,
  simNote,
}: {
  graph: EvidenceGraph;
  comparison: ReturnType<typeof compareBundles> | null;
  edition: InfraLensEdition;
  onSignOff: () => void;
  signOffMsg: string;
  simNote: string;
}) {
  return (
    <>
      <div className="panel-title">
        <span className="provider-chip">sign-off</span>
        <h2>Assurance & drift</h2>
        <p>{edition} capability-enforced workflow</p>
      </div>
      <section>
        <h3>Reviewed scope</h3>
        <p>
          {graph.scan.project} · hash <code>{graph.scan.contentHash}</code>
        </p>
      </section>
      <section>
        <h3>Since approved scan</h3>
        {comparison ? (
          <>
            <p>
              +{comparison.summary.added} / -{comparison.summary.removed} / ~{comparison.summary.modified}
            </p>
            {comparison.newlyExposed.map((r) => (
              <article key={r.id} className="finding high">
                <span>exposure</span>
                <b>New public ingress: {r.displayName}</b>
                <p>Material change — prior approval should be invalidated.</p>
              </article>
            ))}
            {comparison.materialChange && <p className="warning">Material change detected.</p>}
          </>
        ) : (
          <p className="muted">No baseline loaded.</p>
        )}
      </section>
      <section>
        <h3>Blocking findings</h3>
        {graph.findings
          .filter((f) => f.blocksSignOff && f.status === 'open')
          .map((f) => (
            <article key={f.id} className={`finding ${f.severity}`}>
              <span>{f.severity}</span>
              <b>{f.title}</b>
              <p>{f.rationale}</p>
            </article>
          ))}
      </section>
      <section>
        <h3>Sign-off</h3>
        {isCapabilityEnabled('architectSignOff', edition) ? (
          <button type="button" className="primary" onClick={onSignOff}>
            Attempt approval
          </button>
        ) : (
          <p className="muted">Enable commercial edition for sign-off workflow.</p>
        )}
        {signOffMsg && <pre className="narrative">{signOffMsg}</pre>}
        {simNote && <pre className="narrative">{simNote}</pre>}
        {graph.signOffs.map((s) => (
          <p key={s.id}>
            {s.decision} · {s.reviewer} · {s.timestamp}
          </p>
        ))}
      </section>
      <section>
        <h3>Capabilities</h3>
        <ul className="cap-list">
          {capabilityMatrix()
            .slice(0, 8)
            .map((c) => (
              <li key={c.id}>
                <code>{c.id}</code>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function applyPresentation(
  nodes: Node[],
  edges: Edge[],
  graph: EvidenceGraph,
  opts: {
    query: string;
    selected?: string;
    depth: number;
    view: ArchitectureView;
    pathIds: string[];
    collapsedBoundaries: Set<string>;
  },
) {
  const ql = opts.query.toLowerCase();
  const match = new Set(
    graph.resources
      .filter((r) => {
        if (opts.view === 'drift') {
          return (
            graph.drifts.some((d) => d.resourceId === r.id) ||
            r.tags.includes('reconciled') ||
            r.kind === 'route' ||
            r.kind === 'ingress'
          );
        }
        if (!ql) return true;
        return JSON.stringify(r).toLowerCase().includes(ql);
      })
      .map((r) => r.id),
  );

  const focus = opts.selected
    ? computeFocus(graph, opts.selected, opts.depth, opts.pathIds)
    : null;

  const collapsedMembers = new Set<string>();
  for (const n of nodes) {
    if (n.type === 'boundary' && opts.collapsedBoundaries.has(n.id)) {
      const members = (n.data as { boundary?: { memberIds: string[] } }).boundary?.memberIds ?? [];
      members.forEach((id) => collapsedMembers.add(id));
    }
  }

  const styledNodes = nodes.map((n) => {
    if (n.type === 'laneLabel') return { ...n, hidden: false };
    if (n.type === 'boundary') {
      return {
        ...n,
        className: opts.collapsedBoundaries.has(n.id) ? 'boundary-collapsed' : undefined,
      };
    }
    const hidden = !match.has(n.id) || collapsedMembers.has(n.id);
    let focusRole: FocusRole = 'normal';
    if (focus) {
      if (n.id === focus.selected) focusRole = 'selected';
      else if (focus.pathMembers.has(n.id)) focusRole = 'path';
      else if (focus.upstream.has(n.id)) focusRole = 'upstream';
      else if (focus.downstream.has(n.id)) focusRole = 'downstream';
      else if (focus.dimmed.has(n.id)) focusRole = 'dimmed';
    }
    return {
      ...n,
      hidden,
      data: { ...n.data, focusRole },
      style: {
        ...(n.style || {}),
        opacity: focusRole === 'dimmed' ? 0.12 : 1,
        transition: 'opacity 120ms ease',
      },
    };
  });

  const styledEdges = edges.map((e) => {
    const related =
      !focus ||
      focus.selected === e.source ||
      focus.selected === e.target ||
      focus.upstream.has(e.source) ||
      focus.upstream.has(e.target) ||
      focus.downstream.has(e.source) ||
      focus.downstream.has(e.target) ||
      focus.pathMembers.has(e.source) ||
      focus.pathMembers.has(e.target);
    const onPath =
      focus &&
      opts.pathIds.length > 1 &&
      opts.pathIds.includes(e.source) &&
      opts.pathIds.includes(e.target);
    const upstreamEdge = focus?.upstream.has(e.source) && (e.target === focus.selected || focus.upstream.has(e.target));
    const downstreamEdge =
      focus?.downstream.has(e.target) && (e.source === focus.selected || focus.downstream.has(e.source));
    return {
      ...e,
      hidden: !match.has(e.source) || !match.has(e.target) || collapsedMembers.has(e.source) || collapsedMembers.has(e.target),
      className: onPath ? 'edge-path' : upstreamEdge ? 'edge-upstream' : downstreamEdge ? 'edge-downstream' : undefined,
      style: {
        ...(e.style || {}),
        opacity: focus && !related ? 0.06 : onPath ? 1 : 1,
        strokeWidth: onPath ? 3 : (e.style?.strokeWidth as number) ?? 2,
      },
    };
  });

  return { nodes: styledNodes, edges: styledEdges };
}
