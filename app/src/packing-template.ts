// V6-01: asks our own server's /api/packing-template (which calls Gemini) for a packing-list template.
// What leaves the phone: the trip name, the two dates, only if the colour quiz is complete the season name and its palette as
// hex colours, and (V7-05) the wardrobe list: each saved piece's id, garment type, name and colour. No photos, no measurements,
// and no key in the app (decision of 18 Nov 2026, amended 23 Nov 2026 twice).
import { kvGet } from './store';
import { scoreQuiz } from './quiz/quiz';
import { QUIZ_KEY, isComplete } from './screens/quiz';
import { GARMENTS, type GarmentId, type SavedItem } from './wardrobe';
import type { TemplateLine, Trip } from './trips';

/** One saved piece as Gemini sees it: no photo, no neckline, no dates. */
export interface WardrobePiece {
  id: string;
  garment: GarmentId;
  name: string;
  colour: string;
}

export interface TemplateRequest {
  name: string;
  starts: string;
  ends: string;
  season?: { name: string; palette: string[] };
  wardrobe?: WardrobePiece[];
}

/** The most pieces sent (the server refuses more), and a byte guard well under its 32 KB body cap. The newest pieces win. */
export const MAX_WARDROBE = 150;
const MAX_WARDROBE_BYTES = 24_000;
const PIECE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The most lines kept from an answer (the server sends at most this many). */
const MAX_LINES = 60;

/** The season and palette for a finished quiz, or undefined when the quiz is missing or not complete. */
export function seasonFromAnswers(answers: unknown): TemplateRequest['season'] {
  if (!isComplete(answers)) return undefined;
  const { season } = scoreQuiz(answers);
  return { name: season.name, palette: [...season.palette] };
}

/** Takes out what the server refuses in a name (control characters, markup, web addresses), so the request does not fail on it. */
const plainText = (s: string) => s.replace(/[\u0000-\u001f\u007f<>]|:\/\/|www\./gi, ' ').replace(/\s+/g, ' ').trim();

/** The pieces to send: only id, garment, name and colour, the newest 150 that fit under the byte guard. Nothing else on the item is read. */
export function wardrobePieces(items: SavedItem[]): WardrobePiece[] {
  const pieces: WardrobePiece[] = [];
  for (const i of items) {
    if (!PIECE_ID.test(i.id) || !(i.garment in GARMENTS)) continue;
    const name = plainText(i.name).slice(0, 40).trim() || GARMENTS[i.garment].label;
    pieces.push({ id: i.id, garment: i.garment, name, colour: i.colour.toLowerCase() });
  }
  let kept = pieces.slice(-MAX_WARDROBE);
  while (kept.length && new TextEncoder().encode(JSON.stringify(kept)).length > MAX_WARDROBE_BYTES) kept = kept.slice(1);
  return kept;
}

/**
 * The request for a trip. The season is added only when there is one, so without the quiz neither key is sent, and the wardrobe
 * only when there is a saved piece. `wardrobe` is the saved items; only their id, garment, name and colour are used.
 */
export function buildTemplateRequest(trip: Pick<Trip, 'name' | 'starts' | 'ends'>, season?: TemplateRequest['season'], wardrobe: SavedItem[] = []): TemplateRequest {
  const name = plainText(trip.name) || 'Trip';
  const req: TemplateRequest = { name, starts: trip.starts, ends: trip.ends };
  if (season) req.season = season;
  const pieces = wardrobePieces(wardrobe);
  if (pieces.length) req.wardrobe = pieces;
  return req;
}

/** Reads the saved colour quiz, if it was finished. */
export async function loadSeason(): Promise<TemplateRequest['season']> {
  const saved = await kvGet<{ answers?: unknown } | null>(QUIZ_KEY, null);
  return seasonFromAnswers(saved?.answers);
}

/** Reads the server's answer into lines. Null if it holds none. */
export function toLines(raw: unknown): TemplateLine[] | null {
  const items = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  const out: TemplateLine[] = [];
  for (const i of items.slice(0, MAX_LINES)) {
    if (!i || typeof i !== 'object' || typeof i.label !== 'string' || !i.label.trim()) continue;
    const line: TemplateLine = { label: i.label };
    if (Number.isInteger(i.quantity) && i.quantity > 1) line.quantity = i.quantity;
    if (typeof i.group === 'string' && i.group.trim()) line.group = i.group;
    if (typeof i.colour === 'string' && /^#[0-9a-f]{6}$/i.test(i.colour)) line.colour = i.colour.toLowerCase();
    if (typeof i.type === 'string' && Object.prototype.hasOwnProperty.call(GARMENTS, i.type)) line.type = i.type as GarmentId;
    if (Array.isArray(i.matches)) {
      const ids = [...new Set((i.matches as unknown[]).filter((m): m is string => typeof m === 'string' && !!m))];
      if (ids.length) line.matches = ids;
    }
    out.push(line);
  }
  return out.length ? out : null;
}

/** Why a template could not be made. `message` is safe to show. */
export class TemplateError extends Error {}

/** Asks the server for a template. Throws a TemplateError with a message to show; the trip is not changed by a failure. */
export async function fetchTemplate(request: TemplateRequest): Promise<TemplateLine[]> {
  let res: Response;
  try {
    res = await fetch('/api/packing-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new TemplateError('Could not reach the server. Check your connection and try again.');
  }
  if (res.status === 404) throw new TemplateError('Packing templates are not switched on yet.');
  if (res.status === 400) throw new TemplateError('This trip cannot be sent as it is. Trips can be up to 90 days long.');
  if (!res.ok) throw new TemplateError('Could not make a template. Try again in a moment.');
  const lines = toLines(await res.json().catch(() => null));
  if (!lines) throw new TemplateError('Could not make a template. Try again in a moment.');
  return lines;
}
