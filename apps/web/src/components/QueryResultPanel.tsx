import type { QueryConclusion } from '../lib/queryResults';

export function QueryResultPanel({
  result,
  onDismiss,
  onFollowUp,
}: {
  result: QueryConclusion;
  onDismiss: () => void;
  onFollowUp: (prompt: string) => void;
}) {
  return (
    <div className="query-result" role="status" aria-live="polite">
      <header>
        <div>
          <span className="provider-chip">query result</span>
          <h3>{result.question}</h3>
        </div>
        <button type="button" className="ghost" onClick={onDismiss} aria-label="Dismiss query result">
          ×
        </button>
      </header>
      <p className="query-answer">{result.answer}</p>
      {result.status && (
        <p className={`query-status status-${slug(result.status)}`}>
          <b>{result.status}</b>
          <span> · confidence {result.confidence}</span>
        </p>
      )}
      <pre className="narrative">{result.explanation}</pre>
      {!!result.missing.length && (
        <div>
          <h4>Missing evidence</h4>
          <ul>
            {result.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {result.impact && <p className="warning">{result.impact}</p>}
      <div className="followups">
        {result.followUps.map((f) => (
          <button key={f} type="button" onClick={() => onFollowUp(f)}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
