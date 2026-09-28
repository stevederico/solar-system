export interface ScreenPoint {
  x: number;
  y: number;
  /** Distance from the camera in scene units. */
  depth: number;
  /** Radius of the body on screen in pixels. */
  radius: number;
  visible: boolean;
}

/** Smallest hit area in pixels, so tiny moons stay easy to tap. */
export const PICK_RADIUS = 22;

function reachOf(point: ScreenPoint): number {
  return Math.max(point.radius, PICK_RADIUS);
}

/** True when a nearer body's disk covers this body's center. */
function isHidden(point: ScreenPoint, points: ScreenPoint[]): boolean {
  return points.some(
    (other) => other !== point && other.depth < point.depth && Math.hypot(other.x - point.x, other.y - point.y) < other.radius,
  );
}

/**
 * Body under a click or tap.
 * Bodies hidden behind a nearer disk are skipped. Among the rest the smallest
 * hit area wins, so a moon in front of its planet can still be picked.
 */
export function pickBody(points: Map<string, ScreenPoint>, x: number, y: number): string | undefined {
  const visible = [...points.entries()].filter(([, point]) => point.visible);
  const all = visible.map(([, point]) => point);
  let best: { id: string; reach: number; depth: number } | undefined;
  for (const [id, point] of visible) {
    const reach = reachOf(point);
    if (Math.hypot(point.x - x, point.y - y) > reach) continue;
    if (isHidden(point, all)) continue;
    const isBetter = !best || reach < best.reach || (reach === best.reach && point.depth < best.depth);
    if (isBetter) best = { id, reach, depth: point.depth };
  }
  return best?.id;
}
