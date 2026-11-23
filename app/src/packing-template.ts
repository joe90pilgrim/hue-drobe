// V6-01: asks our own server's /api/packing-template (which calls Gemini) for a packing-list template.
// What leaves the phone: the trip name, the two dates and, only if the colour quiz is complete, the season name and its
// palette as hex colours. No photos, no measurements, no wardrobe contents, and no key in the app (decision of 18 Nov 2026,
// amended 23 Nov 2026).
import { kvGet } from './store';
import { scoreQuiz } from './quiz/quiz';
import { QUIZ_KEY, isComplete } from './screens/quiz';
import type { TemplateLine, Trip } from './trips';

export interface TemplateRequest {
  name: string;
  starts: string;
  ends: string;
  season?: { name: string; palette: string[] };
}

/** The most lines kept from an answer (the server sends at most this many). */
const MAX_LINES = 60;

/** The season and palette for a finished quiz, or undefined when the quiz is missing or not complete. */
export function seasonFromAnswers(answers: unknown): TemplateRequest['season'] {
  if (!isComplete(answers)) return undefined;
  const { season } = scoreQuiz(answers);
  return { name: season.name, palette: [...season.palette] };
}

/** The request for a trip. The season is added only when there is one, so without the quiz neither key is sent. */
export function buildTemplateRequest(trip: Pick<Trip, 'name' | 'starts' | 'ends'>, season?: TemplateRequest['season']): TemplateRequest {
  // The server refuses markup and control characters in a name, so they are taken out here rather than failing the request.
  const name = trip.name.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim() || 'Trip';
  const req: TemplateRequest = { name, starts: trip.starts, ends: trip.ends };
  if (season) req.season = season;
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
