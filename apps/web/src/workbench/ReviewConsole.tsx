import {
  availablePlaybooks,
  compareReviews,
  completeStage,
  decisionSupport,
  finalizeReview,
  listPersonas,
  persistReview,
  type StartReviewOptions,
} from '@infralens/architecture-intelligence';
import type {
  ArchitectPersona,
  ArchitectureReview,
  EvidenceGraph,
  ReviewStageId,
} from '@infralens/graph-model';
import { useMemo, useState } from 'react';

export function ReviewLanding({
  graph,
  onStart,
  onExplore,
}: {
  graph: EvidenceGraph;
  onStart: (opts: StartReviewOptions) => void;
  onExplore: () => void;
}) {
  const dash = graph.intelligence?.reviewDashboard;
  const personas = listPersonas();
  const playbooks = availablePlaybooks();
  const [persona, setPersona] = useState<ArchitectPersona>('enterprise');
  const [playbookId, setPlaybookId] = useState('architecture-board');

  if (!dash) {
    return (
      <div className="review-landing">
        <h2>Architecture Review</h2>
        <p className="muted">Review dashboard unavailable — scan may still be loading.</p>
      </div>
    );
  }

  return (
    <div className="review-landing">
      <header className="review-hero">
        <span className="provider-chip">architecture review</span>
        <h2>Architecture Review</h2>
        <p>{graph.scan.project}</p>
      </header>

      <div className={`review-status status-${dash.status.replace(/\s+/g, '-').toLowerCase()}`}>
        <span>Current review status</span>
        <strong>{dash.status}</strong>
      </div>

      <section>
        <h3>Reason</h3>
        <ul className="reason-list">
          {dash.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <div className="review-metrics">
        <div>
          <span>Architecture ready</span>
          <b>{Math.round(dash.architectureReady * 100)}%</b>
        </div>
        <div>
          <span>Critical blockers</span>
          <b>{dash.criticalBlockers}</b>
        </div>
        <div>
          <span>Unknowns</span>
          <b>{dash.unknowns}</b>
        </div>
        <div>
          <span>Waivers</span>
          <b>{dash.waivers}</b>
        </div>
        <div>
          <span>Estimated review time</span>
          <b>{dash.reviewTimeMinutes} minutes</b>
        </div>
        <div>
          <span>Last approval</span>
          <b>{dash.lastApprovalDaysAgo != null ? `${dash.lastApprovalDaysAgo} days ago` : '—'}</b>
        </div>
        <div>
          <span>Architecture trend</span>
          <b>{dash.trend}</b>
        </div>
      </div>

      <section>
        <h3>Architect persona</h3>
        <div className="persona-grid">
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              className={persona === p.id ? 'active' : ''}
              onClick={() => {
                setPersona(p.id);
                setPlaybookId(p.defaultPlaybookId);
              }}
            >
              <b>{p.label}</b>
              <small>{p.focus}</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Review playbook</h3>
        <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)} aria-label="Playbook">
          {playbooks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>

      <div className="review-actions">
        <button
          type="button"
          className="primary"
          onClick={() =>
            onStart({
              persona,
              playbookId,
              reviewer: 'architect@example.com',
            })
          }
        >
          Start Review
        </button>
        <button type="button" className="ghost" onClick={onExplore}>
          Open evidence explorer
        </button>
      </div>

      {(graph.reviews?.length ?? 0) > 0 && (
        <section>
          <h3>Architectural memory</h3>
          <p className="muted">{graph.reviews!.length} persisted review(s) on this estate</p>
          <ul className="reason-list">
            {graph.reviews!.slice(-3).map((r) => (
              <li key={r.id}>
                {r.date.slice(0, 10)} · {r.outcome} · {r.persona}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ActiveReviewPanel({
  graph,
  review,
  stageIndex,
  onReviewChange,
  onStageIndex,
  onShowEvidence,
  onFinish,
}: {
  graph: EvidenceGraph;
  review: ArchitectureReview;
  stageIndex: number;
  onReviewChange: (r: ArchitectureReview) => void;
  onStageIndex: (i: number) => void;
  onShowEvidence: (resourceIds: string[], projectionHint?: string) => void;
  onFinish: (r: ArchitectureReview) => void;
}) {
  const stage = review.stages[stageIndex];
  const support = useMemo(() => decisionSupport(review), [review]);
  const prior = graph.reviews?.filter((r) => r.id !== review.id).at(-1);
  const comparison = prior ? compareReviews(prior, review) : null;

  if (!stage) return null;

  return (
    <div className="active-review">
      <div className="panel-title">
        <span className="provider-chip">{review.playbookId}</span>
        <h2>
          {stage.title}{' '}
          <em className={`outcome outcome-${stage.outcome.toLowerCase()}`}>{stage.outcome}</em>
        </h2>
        <p>
          Stage {stageIndex + 1} of {review.stages.length} · {review.persona} persona · est.{' '}
          {review.estimatedMinutes}m
        </p>
      </div>

      <ol className="stage-rail">
        {review.stages.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={[
                i === stageIndex ? 'active' : '',
                review.completedStageIds.includes(s.id) ? 'done' : '',
                `tone-${s.outcome.toLowerCase()}`,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                onStageIndex(i);
                onShowEvidence(s.resourceIds, s.projection);
              }}
            >
              {s.title}
              <small>{s.outcome}</small>
            </button>
          </li>
        ))}
      </ol>

      <section className="wb-panel">
        <h3>What is being reviewed?</h3>
        <p>{stage.title}</p>
        <h3>Why is it important?</h3>
        <p>{stage.importance}</p>
        <h3>Conclusion</h3>
        <p className="conclusion">{stage.conclusion}</p>
        <h3>Evidence</h3>
        <p className="muted">{stage.evidenceIds.length} evidence records · {stage.resourceIds.length} nodes</p>
        <button type="button" className="ghost" onClick={() => onShowEvidence(stage.resourceIds, stage.projection)}>
          Show supporting evidence graph
        </button>
        <h3>Unknowns</h3>
        <ul className="reason-list">
          {(stage.unknowns.length ? stage.unknowns : ['None listed for this stage']).map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
        <h3>Improve confidence</h3>
        <ul className="reason-list">
          {(stage.confidenceImprovements.length ? stage.confidenceImprovements : ['—']).map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
        <h3>Recommendation</h3>
        <p>{stage.recommendation}</p>
        <h3>Should approval continue?</h3>
        <p>{stage.continueApproval ? 'Yes — proceed' : 'No — resolve this stage first'}</p>
      </section>

      {stage.id === 'recommendations' && (
        <section className="wb-panel">
          <h3>Architectural options</h3>
          {review.recommendations.slice(0, 6).map((rec) => (
            <article key={rec.id} className="rec-card">
              <b>{rec.problem}</b>
              <p>{rec.why}</p>
              <small>
                Business: {rec.businessImpact} · Approval: {rec.approvalImpact}
              </small>
              <div className="option-grid">
                {rec.options.map((opt) => (
                  <div key={opt.id} className="option-card">
                    <b>{opt.title}</b>
                    <p>{opt.impact}</p>
                    <ul>
                      {opt.pros.slice(0, 2).map((p) => (
                        <li key={p}>+ {p}</li>
                      ))}
                      {opt.cons.slice(0, 2).map((c) => (
                        <li key={c}>− {c}</li>
                      ))}
                    </ul>
                    <small>
                      Effort {opt.estimatedEffort} · Cost {opt.cost} · Confidence {opt.confidence}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {stage.id === 'approval' && (
        <section className="wb-panel">
          <h3>Decision support</h3>
          {support.questions.map((q) => (
            <div key={q.question} className="qa">
              <b>{q.question}</b>
              <p>{q.answer}</p>
            </div>
          ))}
          <div className="review-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                const done = finalizeReview(
                  completeStage(review, 'approval'),
                  support.canApprove ? 'Approved' : 'Rejected',
                );
                persistReview(graph, done);
                onFinish(done);
              }}
            >
              {support.canApprove ? 'Approve architecture' : 'Record rejection'}
            </button>
            <button
              type="button"
              onClick={() => {
                const done = finalizeReview(completeStage(review, 'approval'), 'Approved with Waiver');
                persistReview(graph, done);
                onFinish(done);
              }}
            >
              Approve with waiver
            </button>
          </div>
        </section>
      )}

      <section className="wb-panel">
        <h3>Review confidence</h3>
        <p>
          <b>{review.confidence.overall}</b> — {review.confidence.summary}
        </p>
      </section>

      {review.coachNotes.length > 0 && (
        <section className="wb-panel coach">
          <h3>Architectural coach</h3>
          <p>{review.coachNotes[review.coachNotes.length - 1]}</p>
        </section>
      )}

      {comparison && (
        <section className="wb-panel">
          <h3>Review difference</h3>
          <p className="muted">{comparison.summary}</p>
          <ul className="reason-list">
            {comparison.entries
              .filter((e) => e.changed)
              .slice(0, 8)
              .map((e) => (
                <li key={e.stageId}>
                  {e.title}: {e.previous} → {e.current} — {e.reason}
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="review-actions">
        <button
          type="button"
          className="primary"
          onClick={() => {
            const updated = completeStage(review, stage.id as ReviewStageId);
            onReviewChange(updated);
            if (stageIndex < review.stages.length - 1) {
              const next = stageIndex + 1;
              onStageIndex(next);
              onShowEvidence(review.stages[next]!.resourceIds, review.stages[next]!.projection);
            }
          }}
        >
          {stageIndex >= review.stages.length - 1 ? 'Complete stage' : 'Next stage'}
        </button>
      </div>

      <section className="wb-panel">
        <h3>Review notebook</h3>
        <p className="muted">
          {review.date.slice(0, 10)} · {review.reviewer} · hash {review.evidenceHash}
        </p>
        {review.notebook.map((n) => (
          <article key={n.stageId} className="notebook-row">
            <b>
              {n.title} · {n.outcome}
            </b>
            <p>{n.reason}</p>
            <small>{n.recommendation}</small>
          </article>
        ))}
      </section>
    </div>
  );
}

export function ScorecardPanel({ review }: { review: ArchitectureReview }) {
  const entries = Object.values(review.scorecard);
  return (
    <section className="wb-panel">
      <h3>Architectural scorecard</h3>
      <div className="score-grid">
        {entries.map((s) => (
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
