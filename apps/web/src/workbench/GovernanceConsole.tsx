import {
  availablePlaybooks,
  generateGovernanceReport,
  getPersona,
  listPersonas,
  replayHistoricalReview,
  simulateAssumptionFailure,
  type StartReviewOptions,
} from '@infralens/architecture-intelligence';
import { isCapabilityEnabled, type InfraLensEdition } from '@infralens/edition-capabilities';
import type { ArchitectPersona, EvidenceGraph, ScanBundle } from '@infralens/graph-model';
import { useMemo, useState } from 'react';
import { ReviewLanding } from './ReviewConsole';

export function GovernanceLanding({
  graph,
  edition,
  baseline,
  onStartReview,
  onExplore,
  onDecisionGraph,
  onHighlight,
}: {
  graph: EvidenceGraph;
  edition: InfraLensEdition;
  baseline: ScanBundle | null;
  onStartReview: (opts: StartReviewOptions) => void;
  onExplore: () => void;
  onDecisionGraph: () => void;
  onHighlight: (ids: string[]) => void;
}) {
  const gov = graph.intelligence?.governance;
  const dash = gov?.dashboard;
  const [replayNote, setReplayNote] = useState('');
  const [consequence, setConsequence] = useState('');
  const [persona, setPersona] = useState<ArchitectPersona>('enterprise');
  const [playbookId, setPlaybookId] = useState('architecture-board');
  const personas = listPersonas({ commercial: edition === 'commercial' });
  const playbooks = availablePlaybooks(isCapabilityEnabled('reviewPlaybooks', edition));
  const selectedPersona = getPersona(persona);
  const report = useMemo(() => generateGovernanceReport(graph), [graph]);

  if (!dash) {
    return (
      <ReviewLanding
        graph={graph}
        edition={edition}
        onStart={onStartReview}
        onExplore={onExplore}
      />
    );
  }

  function startWithPersona() {
    onStartReview({
      persona,
      playbookId: isCapabilityEnabled('reviewPlaybooks', edition) ? playbookId : selectedPersona.defaultPlaybookId,
      commercial: edition === 'commercial',
      reviewer: 'architect@example.com',
    });
  }

  return (
    <div className="review-landing governance-landing">
      <header className="review-hero">
        <span className="provider-chip">architecture governance</span>
        <h2>Architecture Governance</h2>
        <p>{graph.scan.project}</p>
      </header>

      <div className={`review-status status-${dash.status.replace(/\s+/g, '-').toLowerCase()}`}>
        <span>Governance status</span>
        <strong>{dash.status}</strong>
      </div>

      <section>
        <h3>Why</h3>
        <ul className="reason-list">
          {dash.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <div className="review-metrics">
        <div>
          <span>Architecture health</span>
          <b>{Math.round(dash.architectureHealth * 100)}%</b>
        </div>
        <div>
          <span>Current reviews</span>
          <b>{dash.currentReviews}</b>
        </div>
        <div>
          <span>Expiring approvals</span>
          <b>{dash.expiringApprovals}</b>
        </div>
        <div>
          <span>Invalid ADRs</span>
          <b>{dash.invalidAdrs}</b>
        </div>
        <div>
          <span>Broken assumptions</span>
          <b>{dash.brokenAssumptions}</b>
        </div>
        <div>
          <span>Intent drift</span>
          <b>{dash.intentDrift}</b>
        </div>
        <div>
          <span>Outstanding obligations</span>
          <b>{dash.outstandingObligations}</b>
        </div>
        <div>
          <span>Unknown ownership</span>
          <b>{dash.unknownOwnership}</b>
        </div>
      </div>

      <section className="wb-panel">
        <h3>Architectural coach</h3>
        <ul className="reason-list">
          {dash.coachNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section className="wb-panel">
        <h3>Governance metrics</h3>
        <div className="score-grid">
          {(gov?.metrics ?? []).slice(0, 8).map((m) => (
            <div key={m.id} className={`score-card band-${m.band}`}>
              <span>{m.label}</span>
              <b>{Math.round(m.score * 100)}%</b>
              <small>{m.reasons[0]}</small>
            </div>
          ))}
        </div>
      </section>

      {isCapabilityEnabled('architectPersonas', edition) && (
        <section className="wb-panel persona-section">
          <h3>Review as persona</h3>
          <p className="muted">
            Same evidence graph — different review lens, stage order and emphasis.
          </p>
          <div className="persona-grid" role="listbox" aria-label="Architect persona">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={persona === p.id}
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
          {edition === 'oss' && (
            <p className="muted persona-hint">
              OSS includes Enterprise Architect. Switch edition to Commercial for Security, Platform,
              Data, Operations and FinOps persona packs.
            </p>
          )}
          <p className="persona-selected">
            Selected: <b>{selectedPersona.label}</b> — stages emphasise{' '}
            {selectedPersona.metricEmphasis.join(', ')}.
          </p>
        </section>
      )}

      {isCapabilityEnabled('reviewPlaybooks', edition) && (
        <section className="wb-panel">
          <h3>Review playbook</h3>
          <select
            value={playbookId}
            onChange={(e) => setPlaybookId(e.target.value)}
            aria-label="Review playbook"
          >
            {playbooks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <div className="review-actions">
        <button type="button" className="primary" onClick={startWithPersona}>
          Start review as {selectedPersona.label}
        </button>
        <button type="button" onClick={onDecisionGraph}>
          Open decision graph
        </button>
        <button type="button" className="ghost" onClick={onExplore}>
          Evidence explorer
        </button>
      </div>

      <section className="wb-panel">
        <h3>Assumption consequences</h3>
        <div className="stack">
          {graph.resources
            .filter((r) => r.kind === 'assumption' && (r.metadata.status === 'failed' || r.metadata.status === 'unsupported'))
            .slice(0, 4)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  const chain = simulateAssumptionFailure(graph, a.id);
                  setConsequence(chain.summary);
                  onHighlight(chain.steps.flatMap((s) => s.resourceIds));
                }}
              >
                Simulate: {a.displayName} is false
              </button>
            ))}
        </div>
        {consequence && <p className="conclusion">{consequence}</p>}
      </section>

      {isCapabilityEnabled('reviewReplay', edition) && baseline && (
        <section className="wb-panel">
          <h3>Review replay</h3>
          <button
            type="button"
            onClick={() => {
              const result = replayHistoricalReview(baseline, { reviewer: 'auditor@example.com' });
              setReplayNote(`${result.note} Outcome: ${result.review.outcome}`);
            }}
          >
            Replay historical (approved baseline) review
          </button>
          {replayNote && <pre className="narrative">{replayNote}</pre>}
        </section>
      )}

      {!isCapabilityEnabled('portfolioGovernance', edition) && (
        <p className="muted">Portfolio governance requires commercial edition.</p>
      )}

      <section className="wb-panel">
        <h3>Executive governance report</h3>
        <pre className="narrative report-preview">{report.markdown.slice(0, 1200)}…</pre>
      </section>
    </div>
  );
}
