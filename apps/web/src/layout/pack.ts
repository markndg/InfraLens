import type { LayoutContainer, LayoutLeaf, LayoutNode } from './types';
import { CONTAINER_CONSTRAINTS } from './types';

/**
 * Recursive outside-in packing.
 * layout(node): if leaf return intrinsic; else layout children → measure → size container → position children.
 */
export function layoutTree(root: LayoutContainer, originX = 0, originY = 0): void {
  measureAndPack(root);
  assignAbsolute(root, originX, originY);
  assignPorts(root);
}

function measureAndPack(node: LayoutNode): { width: number; height: number } {
  if (node.kind === 'leaf') {
    return { ...node.measured };
  }

  const C = CONTAINER_CONSTRAINTS;
  const isRoot = node.id === '__root__';

  // 1) Layout children first
  for (const child of node.children) {
    measureAndPack(child);
  }

  // 2) Pack children locally (flow / grid by dimension)
  if (isRoot) {
    packRootChildren(node);
  } else {
    packContainerChildren(node);
  }

  // 3) Compute container size from children bounding box + constraints
  let maxR = 0;
  let maxB = 0;
  for (const child of node.children) {
    const w = child.kind === 'leaf' ? child.measured.width : child.measured.width;
    const h = child.kind === 'leaf' ? child.measured.height : child.measured.height;
    maxR = Math.max(maxR, child.rel.x + w);
    maxB = Math.max(maxB, child.rel.y + h);
  }

  if (isRoot) {
    node.measured = {
      width: Math.max(C.minWidth, maxR),
      height: Math.max(C.minHeight, maxB),
    };
  } else {
    node.measured = {
      width: Math.max(C.minWidth, maxR + C.paddingRight),
      height: Math.max(C.minHeight, maxB + C.paddingBottom),
    };
  }

  return { ...node.measured };
}

function packContainerChildren(container: LayoutContainer): void {
  const C = CONTAINER_CONSTRAINTS;
  const startX = C.paddingLeft;
  const startY = C.paddingTop;
  let x = startX;
  let y = startY;
  let rowH = 0;
  const maxRowWidth = 720;

  for (const child of container.children) {
    const w = child.measured.width;
    const h = child.measured.height;
    if (x > startX && x + w > startX + maxRowWidth) {
      x = startX;
      y += rowH + C.childGapY;
      rowH = 0;
    }
    child.rel = { x, y };
    x += w + C.childGapX;
    rowH = Math.max(rowH, h);
  }
}

function packRootChildren(root: LayoutContainer): void {
  const C = CONTAINER_CONSTRAINTS;
  // Place top-level containers left-to-right with corridor gaps between them
  let x = 0;
  let y = 0;
  let rowH = 0;
  const maxRow = 1600;

  for (const child of root.children) {
    const w = child.measured.width;
    const h = child.measured.height;
    if (x > 0 && x + w > maxRow) {
      x = 0;
      y += rowH + C.siblingGap + C.corridorWidth;
      rowH = 0;
    }
    child.rel = { x, y };
    x += w + C.siblingGap + C.corridorWidth;
    rowH = Math.max(rowH, h);
  }
}

function assignAbsolute(node: LayoutNode, absX: number, absY: number): void {
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
    assignAbsolute(child, node.abs.x, node.abs.y);
  }
}

export function assignPorts(node: LayoutNode): void {
  if (node.kind === 'leaf') return;
  const b = node.abs;
  node.ports = [
    { id: `${node.id}:left`, side: 'left', t: 0.5, x: b.x, y: b.y + b.height / 2 },
    { id: `${node.id}:right`, side: 'right', t: 0.5, x: b.x + b.width, y: b.y + b.height / 2 },
    { id: `${node.id}:top`, side: 'top', t: 0.5, x: b.x + b.width / 2, y: b.y },
    { id: `${node.id}:bottom`, side: 'bottom', t: 0.5, x: b.x + b.width / 2, y: b.y + b.height },
  ];
  for (const child of node.children) assignPorts(child);
}

export function indexTree(root: LayoutContainer): Map<string, LayoutNode> {
  const map = new Map<string, LayoutNode>();
  const walk = (n: LayoutNode) => {
    map.set(n.id, n);
    if (n.kind === 'container') n.children.forEach(walk);
  };
  walk(root);
  return map;
}

export function findContainerOf(root: LayoutContainer, leafId: string): LayoutContainer | null {
  for (const child of root.children) {
    if (child.kind === 'container') {
      if (child.memberIds.includes(leafId)) return child;
      const nested = findContainerOf(child, leafId);
      if (nested) return nested;
    } else if (child.id === leafId) {
      return root.id === '__root__' ? null : root;
    }
  }
  return null;
}
