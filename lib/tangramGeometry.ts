import type { Silhouette } from './silhouettes';

export interface Point {
  x: number;
  y: number;
}

export interface PieceGeometry {
  // Points after any silhouette-level transform is applied, in the 0..100
  // silhouette coordinate space.
  absolute: Point[];
  // Points re-anchored so the bounding box starts at (0, 0).
  normalized: Point[];
  bbox: { minX: number; minY: number; width: number; height: number };
}

function parsePoints(s: string): Point[] {
  return s
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });
}

function applyTransform(points: Point[], transform?: string): Point[] {
  if (!transform) return points;
  // Supports "rotate(<deg> <cx> <cy>)" — the only transform we use today
  // (Diamond silhouette: rotate(45 50 50)). Falls back to identity for
  // anything else so we don't silently mis-place pieces.
  const match = transform.match(
    /rotate\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/,
  );
  if (!match) return points;
  const angle = parseFloat(match[1]);
  const cx = parseFloat(match[2]);
  const cy = parseFloat(match[3]);
  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return points.map(({ x, y }) => ({
    x: c * (x - cx) - s * (y - cy) + cx,
    y: s * (x - cx) + c * (y - cy) + cy,
  }));
}

export function getPieceGeometries(silhouette: Silhouette): PieceGeometry[] {
  return silhouette.pieces.map((pointsStr) => {
    const raw = parsePoints(pointsStr);
    const absolute = applyTransform(raw, silhouette.transform);
    const xs = absolute.map((p) => p.x);
    const ys = absolute.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const bbox = { minX, minY, width: maxX - minX, height: maxY - minY };
    const normalized = absolute.map((p) => ({
      x: p.x - minX,
      y: p.y - minY,
    }));
    return { absolute, normalized, bbox };
  });
}

export function pointsToString(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
