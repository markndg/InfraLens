import type { EvidenceGraph } from '@infralens/graph-model';

/** Tarjan SCC — returns components with size > 1 (cyclic clusters). */
export function findCycles(graph: EvidenceGraph, nodeIds: string[]): string[][] {
  const idSet = new Set(nodeIds);
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of graph.edges) {
    if (idSet.has(e.source) && idSet.has(e.target)) {
      adj.get(e.source)!.push(e.target);
    }
  }

  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  function strongConnect(v: string) {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }
    if (lowlink.get(v) === indices.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) components.push(comp.sort());
    }
  }

  for (const v of nodeIds) {
    if (!indices.has(v)) strongConnect(v);
  }
  return components;
}
