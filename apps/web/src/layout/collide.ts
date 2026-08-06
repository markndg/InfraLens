import type { Box, LayoutContainer, LayoutNode, RoutedEdge } from './types';
import { CONTAINER_CONSTRAINTS } from './types';

function overlaps(a: Box, b: Box, pad = 0): boolean {
  return !(
    a.x + a.width + pad <= b.x ||
    b.x + b.width + pad <= a.x ||
    a.y + a.height + pad <= b.y ||
    b.y + b.height + pad <= a.y
  );
}

/**
 * Collision resolution after placement.
 * Prefer moving labels; only nudge leaves within their parent when unavoidable.
 * Sibling containers must not overlap — push along primary axis.
 */
export function resolveCollisions(root: LayoutContainer, edges: RoutedEdge[]): void {
  resolveSiblingContainerOverlaps(root);
  recomputeAbs(root, root.abs.x, root.abs.y);

  // Nudge leaves that still overlap inside a container
  for (const child of root.children) {
    if (child.kind === 'container') resolveLeafOverlaps(child);
  }
  recomputeAbs(root, root.abs.x, root.abs.y);

  // Move edge labels off node boxes
  const leaves = collectLeaves(root);
  for (const e of edges) {
    if (!e.labelBox) continue;
    for (const leaf of leaves) {
      if (!overlaps(e.labelBox, leaf.abs, 4)) continue;
      e.labelBox = { ...e.labelBox, y: e.labelBox.y - 22 };
      // Prefer label move over node move
      break;
    }
  }
}

function resolveSiblingContainerOverlaps(root: LayoutContainer): void {
  const C = CONTAINER_CONSTRAINTS;
  const siblings = root.children.filter((c) => c.kind === 'container') as LayoutContainer[];
  siblings.sort((a, b) => a.rel.x - b.rel.x || a.rel.y - b.rel.y);

  for (let i = 0; i < siblings.length; i++) {
    for (let j = i + 1; j < siblings.length; j++) {
      const a = siblings[i];
      const b = siblings[j];
      const aBox = {
        x: root.abs.x + a.rel.x,
        y: root.abs.y + a.rel.y,
        width: a.measured.width,
        height: a.measured.height,
      };
      const bBox = {
        x: root.abs.x + b.rel.x,
        y: root.abs.y + b.rel.y,
        width: b.measured.width,
        height: b.measured.height,
      };
      if (!overlaps(aBox, bBox, C.siblingGap * 0.25)) continue;

      // Push b to the right of a
      const needX = aBox.x + aBox.width + C.siblingGap + C.corridorWidth - bBox.x;
      if (needX > 0) {
        b.rel.x += needX;
      }
    }
  }

  // Recompute root measured width after pushes
  let maxR = 0;
  let maxB = 0;
  for (const child of root.children) {
    maxR = Math.max(maxR, child.rel.x + child.measured.width);
    maxB = Math.max(maxB, child.rel.y + child.measured.height);
  }
  root.measured = { width: maxR, height: maxB };
  root.abs = { ...root.abs, width: maxR, height: maxB };
}

function resolveLeafOverlaps(container: LayoutContainer): void {
  const C = CONTAINER_CONSTRAINTS;
  const leaves = container.children.filter((c) => c.kind === 'leaf');
  leaves.sort((a, b) => a.rel.y - b.rel.y || a.rel.x - b.rel.x);

  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i];
      const b = leaves[j];
      const aBox = { x: a.rel.x, y: a.rel.y, width: a.measured.width, height: a.measured.height };
      const bBox = { x: b.rel.x, y: b.rel.y, width: b.measured.width, height: b.measured.height };
      if (!overlaps(aBox, bBox, 4)) continue;
      b.rel.y = a.rel.y + a.measured.height + C.childGapY;
    }
  }

  // Inflate container to fit nudged children
  let maxR: number = C.paddingLeft;
  let maxB: number = C.paddingTop;
  for (const child of container.children) {
    maxR = Math.max(maxR, child.rel.x + child.measured.width);
    maxB = Math.max(maxB, child.rel.y + child.measured.height);
  }
  container.measured = {
    width: Math.max(C.minWidth, maxR + C.paddingRight),
    height: Math.max(C.minHeight, maxB + C.paddingBottom),
  };
}

function recomputeAbs(node: LayoutNode, absX: number, absY: number): void {
  if (node.kind === 'leaf') {
    node.abs = {
      x: absX + node.rel.x,
      y: absY + node.rel.y,
      width: node.measured.width,
      height: node.measured.height,
    };
    return;
  }
  node.abs = {
    x: absX + node.rel.x,
    y: absY + node.rel.y,
    width: node.measured.width,
    height: node.measured.height,
  };
  for (const child of node.children) {
    recomputeAbs(child, node.abs.x, node.abs.y);
  }
}

function collectLeaves(root: LayoutContainer) {
  const out: LayoutNode[] = [];
  const walk = (n: LayoutNode) => {
    if (n.kind === 'leaf') out.push(n);
    else n.children.forEach(walk);
  };
  walk(root);
  return out.filter((n): n is import('./types').LayoutLeaf => n.kind === 'leaf');
}
