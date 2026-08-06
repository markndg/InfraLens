import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import { kindLabel, scopeLabel } from '../lib/architectureLayout';
import { assignLane, LANE_LABELS } from '../lib/lanes';

export function ListView({
  graph,
  resources,
  selected,
  onSelect,
}: {
  graph: EvidenceGraph;
  resources: ResourceNode[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const sorted = [...resources].sort((a, b) => {
    const la = assignLane(a, graph);
    const lb = assignLane(b, graph);
    return LANE_LABELS[la].localeCompare(LANE_LABELS[lb]) || a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className="list-view" role="list" aria-label="Architecture list view">
      {sorted.map((r) => {
        const lane = assignLane(r, graph);
        const findings = graph.findings.filter((f) => f.affectedResources.includes(r.id));
        return (
          <button
            key={r.id}
            type="button"
            role="listitem"
            className={`list-row ${selected === r.id ? 'selected' : ''}`}
            onClick={() => onSelect(r.id)}
          >
            <span className="list-lane">{LANE_LABELS[lane]}</span>
            <span className="list-name">{r.displayName}</span>
            <span className="list-kind">
              {kindLabel(r)} · {scopeLabel(r)}
            </span>
            <span className="list-truth">{r.truthStates.join(', ')}</span>
            <span className="list-findings">
              {findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length
                ? `${findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length} risk`
                : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
