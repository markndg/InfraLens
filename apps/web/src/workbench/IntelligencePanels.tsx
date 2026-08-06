import {
  dnaBars,
  listMissions,
  buildMission,
  reasonAboutComponent,
  type MissionId,
  type MissionPlan,
} from '@infralens/architecture-intelligence';
import type { EvidenceGraph } from '@infralens/graph-model';

export function ArchitectureStoryPanel({ graph }: { graph: EvidenceGraph }) {
  const intel = graph.intelligence;
  const clauses = intel?.storyClauses ?? [];
  return (
    <section className="wb-panel">
      <h3>Architectural story</h3>
      <p className="muted">Every sentence is derived from graph traversal.</p>
      <ol className="story-list">
        {clauses.map((c, i) => (
          <li key={i}>
            <p>{c.text}</p>
            <small>{c.evidenceIds.length} evidence · {c.resourceIds.length} nodes</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ArchitectureDNAPanel({ graph }: { graph: EvidenceGraph }) {
  const dna = graph.intelligence?.dna;
  if (!dna) return null;
  const bars = dnaBars(dna);
  return (
    <section className="wb-panel dna-panel">
      <h3>Architecture DNA</h3>
      <p className="muted">Semantic fingerprint from the evidence graph</p>
      <div className="dna-bars">
        {bars.map((b) => (
          <div key={b.id} className="dna-row">
            <span>{b.label}</span>
            <code aria-label={`${b.label} ${Math.round(b.score * 100)}%`}>{b.bar}</code>
            <b>{Math.round(b.score * 100)}%</b>
          </div>
        ))}
      </div>
      <small className="muted">{dna.fingerprint}</small>
    </section>
  );
}

export function RiskHealthPanel({ graph }: { graph: EvidenceGraph }) {
  const risk = graph.intelligence?.risk;
  const health = graph.intelligence?.health;
  if (!risk || !health) return null;
  return (
    <section className="wb-panel">
      <h3>Risk & health</h3>
      <div className="score-grid">
        {Object.values(risk).map((s) => (
          <div key={s.id} className={`score-card band-${s.band}`}>
            <span>{s.label}</span>
            <b>{Math.round(s.score * 100)}%</b>
            <small>{s.reasons[0]}</small>
          </div>
        ))}
      </div>
      <h4>Architectural health</h4>
      <div className="score-grid">
        {Object.values(health).map((s) => (
          <div key={s.id} className={`score-card band-${s.band}`}>
            <span>{s.label}</span>
            <b>{Math.round(s.score * 100)}%</b>
            <small>{s.reasons[0]}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MissionPanel({
  graph,
  missionId,
  onMission,
  onHighlight,
}: {
  graph: EvidenceGraph;
  missionId?: MissionId;
  onMission: (id: MissionId) => void;
  onHighlight: (ids: string[]) => void;
}) {
  const missions = listMissions();
  const plan: MissionPlan | null = missionId ? buildMission(graph, missionId) : null;
  return (
    <section className="wb-panel">
      <h3>Mission mode</h3>
      <p className="muted">Guided investigation instead of free exploration</p>
      <div className="stack">
        {missions.map((m) => (
          <button
            key={m.id}
            type="button"
            className={missionId === m.id ? 'active' : ''}
            onClick={() => {
              onMission(m.id);
              const built = buildMission(graph, m.id);
              onHighlight(built.steps.flatMap((s) => s.highlightIds).slice(0, 40));
            }}
          >
            {m.title}
          </button>
        ))}
      </div>
      {plan && (
        <div className="mission-steps">
          <p>
            <b>{plan.title}</b> — {plan.objective}
          </p>
          {plan.steps.map((step, i) => (
            <article key={i}>
              <button type="button" className="ghost" onClick={() => onHighlight(step.highlightIds)}>
                {i + 1}. {step.title}
              </button>
              <p className="muted">{step.detail}</p>
            </article>
          ))}
          <p className="conclusion">{plan.conclusion}</p>
        </div>
      )}
    </section>
  );
}

export function ComponentIntelligence({
  graph,
  resourceId,
}: {
  graph: EvidenceGraph;
  resourceId: string;
}) {
  const r = reasonAboutComponent(graph, resourceId);
  return (
    <section className="wb-panel">
      <h3>Architectural reasoning</h3>
      <p>{r.what}</p>
      <p className="muted">{r.why}</p>
      <dl className="reason-dl">
        <dt>Capability</dt>
        <dd>{r.capabilities.join(', ') || '—'}</dd>
        <dt>Owners</dt>
        <dd>{r.owners.join(', ') || '—'}</dd>
        <dt>Data</dt>
        <dd>{r.dataHandled.join(', ') || '—'}</dd>
        <dt>Dependents</dt>
        <dd>{r.dependents.slice(0, 8).join(', ') || '—'}</dd>
        <dt>If removed</dt>
        <dd>{r.blastIfRemoved.slice(0, 6).join(' · ') || '—'}</dd>
        <dt>Risks</dt>
        <dd>{r.risks.join(' · ') || 'None open'}</dd>
        <dt>Certainty</dt>
        <dd>{r.certainty}</dd>
      </dl>
    </section>
  );
}

export function TimelinePanel({
  frameIndex,
  frameCount,
  riskSummary,
  onChange,
  deltas,
}: {
  frameIndex: number;
  frameCount: number;
  riskSummary: string;
  onChange: (index: number) => void;
  deltas: { added: number; removed: number; changed: number };
}) {
  return (
    <section className="wb-panel">
      <h3>Timeline</h3>
      <p className="muted">Architecture as an evolving evidence graph</p>
      <label>
        <span>
          Frame {frameIndex + 1}/{frameCount}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(frameCount - 1, 0)}
          value={frameIndex}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
      <p>
        +{deltas.added} / -{deltas.removed} / ~{deltas.changed}
      </p>
      <small className="muted">{riskSummary}</small>
    </section>
  );
}
