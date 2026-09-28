export interface BestResult {
  score: number;
  stars: number;
}

export type Progress = Record<string, BestResult>;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESS_KEY = 'orrery-sling-progress';

function isBestResult(value: unknown): value is BestResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.score === 'number' && typeof candidate.stars === 'number';
}

/** Read saved bests. Broken or missing data gives an empty record. */
export function loadProgress(store: KeyValueStore | undefined): Progress {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(PROGRESS_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    const progress: Progress = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (isBestResult(value)) progress[id] = { score: value.score, stars: value.stars };
    }
    return progress;
  } catch {
    return {};
  }
}

/**
 * Record a result if it beats the saved best.
 * Returns true when it set a new best.
 */
export function saveResult(store: KeyValueStore | undefined, levelId: string, result: BestResult): boolean {
  const progress = loadProgress(store);
  const best = progress[levelId];
  if (best && best.score >= result.score) return false;
  progress[levelId] = { score: result.score, stars: result.stars };
  try {
    store?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be full or blocked. The game still works without it.
  }
  return true;
}

/** Browser storage, or undefined where it is blocked. */
export function browserStore(): KeyValueStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
