// Back up and restore: everything the app stores, as one JSON file with a version number. The avatar pack is not included.
import { kvDelete, kvGet, kvPut } from './store';
import { cleanFavourites, FAVOURITES_KEY } from './favourites';
import { cleanOutfits, OUTFITS_KEY } from './outfits';
import { cleanItems, NECKLINE_KEY, SHEER_KEY, WARDROBE_KEY } from './wardrobe';

export const BACKUP_FORMAT = 'huedrobe-backup';
export const BACKUP_VERSION = 1;
export const QUIZ_KEY = 'colourQuiz';
export const OUTFIT_KEY = 'outfit';
export const COLOURS_KEY = 'colours';

function cleanStringMap(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
}

/** Every key the app stores, with its cleaner. A cleaner returns undefined for a value it cannot use. */
const KEYS: Record<string, (v: unknown) => unknown> = {
  [WARDROBE_KEY]: cleanItems,
  [OUTFITS_KEY]: cleanOutfits,
  [FAVOURITES_KEY]: cleanFavourites,
  [QUIZ_KEY]: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined),
  [OUTFIT_KEY]: cleanStringMap,
  [COLOURS_KEY]: cleanStringMap,
  [NECKLINE_KEY]: (v) => (typeof v === 'string' ? v : undefined),
  [SHEER_KEY]: (v) => (typeof v === 'boolean' ? v : undefined),
};

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function buildBackup(data: Record<string, unknown>, now = new Date()): Backup {
  const clean: Record<string, unknown> = {};
  for (const [k, fn] of Object.entries(KEYS)) {
    const v = fn(data[k]);
    if (v !== undefined) clean[k] = v;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: clean };
}

/** Checks a file's text. Returns the cleaned data, or an error message when the file is not one of ours. */
export function parseBackup(text: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const notOurs = { ok: false, error: 'That file is not a Hue-drobe backup.' } as const;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return notOurs;
  }
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT || !b.data || typeof b.data !== 'object' || Array.isArray(b.data))
    return notOurs;
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION)
    return { ok: false, error: 'That backup was made by a newer version of the app.' };
  return { ok: true, data: buildBackup(b.data as Record<string, unknown>).data };
}

export async function exportBackup(): Promise<Backup> {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(KEYS)) data[k] = await kvGet<unknown>(k, undefined);
  return buildBackup(data);
}

/** Replaces everything stored: keys missing from the backup are cleared. */
export async function importBackup(data: Record<string, unknown>): Promise<void> {
  for (const k of Object.keys(KEYS)) {
    if (k in data) await kvPut(k, data[k]);
    else await kvDelete(k);
  }
}

export function backupFileName(now = new Date()): string {
  return `hue-drobe-backup-${now.toISOString().slice(0, 10)}.json`;
}
