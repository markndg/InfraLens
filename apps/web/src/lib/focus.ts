import type { EvidenceGraph } from '@infralens/graph-model';

export interface FocusSets {
  selected: string;
  upstream: Set<string>;
  downstream: Set<string>;
  pathMembers: Set<string>;
  dimmed: Set<string>;
}

export function computeFocus(
  graph: EvidenceGraph,
  selectedId: string,
  depth: number,
  pathIds: string[] = [],
): FocusSets {
  const upstream = new Set<string>();
  const downstream = new Set<string>();

  let frontier = [selectedId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of graph.edges) {
        if (e.target === id && !upstream.has(e.source) && e.source !== selectedId) {
          upstream.add(e.source);
          next.push(e.source);
        }
      }
    }
    frontier = next;
  }

  frontier = [selectedId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of graph.edges) {
        if (e.source === id && !downstream.has(e.target) && e.target !== selectedId) {
          downstream.add(e.target);
          next.push(e.target);
        }
      }
    }
    frontier = next;
  }

  const pathMembers = new Set(pathIds);
  const related = new Set<string>([selectedId, ...upstream, ...downstream, ...pathMembers]);
  const dimmed = new Set(graph.resources.map((r) => r.id).filter((id) => !related.has(id)));

  return { selected: selectedId, upstream, downstream, pathMembers, dimmed };
}
