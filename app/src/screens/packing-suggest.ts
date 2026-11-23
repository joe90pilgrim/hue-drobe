// V7-06: the "Suggest a list" sheet and the Suggested rows on a trip. Pure HTML builders, no state and no store, so
// packing.ts keeps the events. The copy is the spec's (docs/decisions/2026-11-23-v7-packing-and-icon-spec.md, section 6) and must
// match what `buildTemplateRequest` really sends: the trip name and dates, the season and palette only after the quiz, and the
// wardrobe as names, types and colours only when there is something saved.
import { silhouetteSvg } from '../silhouettes';
import type { SavedItem } from '../wardrobe';
import { formatDates, templateText, type PackEntry, type Trip } from '../trips';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Which garment a suggestion is drawn as when it has no `type`: from its group, else none (a dashed hanger). */
const GROUP_GARMENT: Record<string, string> = { tops: 'tee', bottoms: 'trousers', layers: 'sweatshirt', shoes: 'ankle_boots' };

/** A plain dashed hanger, for a suggestion with neither a type nor a known group. */
const GHOST_HANGER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" aria-hidden="true" focusable="false" data-shape="hanger" data-mode="ghost"><path d="M50 22 L50 14 Q50 6 58 6 Q66 6 66 13 M50 22 L8 56 L92 56 Z" fill="none" stroke="#7a7a7a" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"/></svg>';

/** The ghost silhouette of a suggested line: its type, else its group's garment, else a hanger; coloured by `colour` (neutral if missing). */
export function ghostOf(e: Pick<PackEntry, 'type' | 'group' | 'colour'>): string {
  const garment = e.type ?? GROUP_GARMENT[(e.group ?? '').trim().toLowerCase()];
  return garment ? silhouetteSvg({ garment, colour: e.colour ?? '', mode: 'ghost' }) : GHOST_HANGER;
}

/** The name a suggested line shows. A line Joe has edited shows his text; otherwise the label, with the quantity moved to a chip. */
export function lineName(e: PackEntry): { name: string; quantity: number } {
  const label = e.label;
  if (label && e.text === templateText({ label, quantity: e.quantity })) return { name: label, quantity: e.quantity ?? 1 };
  return { name: e.text ?? label ?? '', quantity: 1 };
}

/** How many of a line's matches are still in the wardrobe. */
export const liveMatches = (e: PackEntry, items: SavedItem[]) => (e.matches ?? []).filter((id) => items.some((i) => i.id === id)).length;

/** The lines Gemini matched to clothes that still exist. */
export const matchedLines = (lines: PackEntry[], items: SavedItem[]) => lines.filter((e) => liveMatches(e, items) > 0);

/** A suggested line: dashed row, ghost silhouette, name, quantity chip, a Match button (off until V7-07), Edit and Remove. */
export function suggestedRow(e: PackEntry, items: SavedItem[]): string {
  const { name, quantity } = lineName(e);
  const n = liveMatches(e, items);
  const sub = [e.group ? esc(e.group) : 'Suggested', n ? `<span class="p-sug-match">${n} in your wardrobe</span>` : ''].filter(Boolean).join(' · ');
  return `
    <li class="p-row p-sug${e.packed ? ' packed' : ''}">
      <label class="p-check">
        <input type="checkbox" data-kind="template" data-ref="${e.ref}"${e.packed ? ' checked' : ''}>
        <span class="p-sug-art" aria-hidden="true">${ghostOf(e)}</span>
        <span class="p-text"><span class="w-name">${esc(name)}</span><span class="w-sub">${sub}</span></span>
        ${quantity > 1 ? `<span class="p-sug-qty">× ${quantity}</span>` : ''}
      </label>
      <span class="p-sug-btns">
        <button type="button" class="secondary" data-act="match-line" data-ref="${e.ref}" disabled aria-label="Match ${esc(name)}">Match</button>
        <button type="button" class="secondary" data-act="edit-line" data-ref="${e.ref}" aria-label="Edit ${esc(name)}">Edit</button>
        <button type="button" class="secondary" data-act="remove-line" data-ref="${e.ref}" aria-label="Remove ${esc(name)}">Remove</button>
      </span>
    </li>`;
}

/** The "Suggested" section: its heading and rows. Empty text when there are no lines. */
export const suggestedSection = (lines: PackEntry[], items: SavedItem[]) =>
  lines.length ? `<h3 class="p-group">Suggested <span class="p-sug-count">${lines.length}</span></h3><ul class="p-list" aria-label="Suggestions">${lines.map((e) => suggestedRow(e, items)).join('')}</ul>` : '';

/** The green banner above the rows when Gemini matched some of them. The Review button waits for V7-08. */
export function matchBanner(lines: PackEntry[], items: SavedItem[]): string {
  const n = matchedLines(lines, items).length;
  if (!n) return '';
  return `<div class="p-sug-banner" id="p-sug-banner"><span>Gemini matched ${n} ${n === 1 ? 'suggestion' : 'suggestions'} to clothes you own</span><button type="button" class="secondary" data-act="review-matches" disabled>Review</button></div>`;
}

export type SuggestStep = { step: 'confirm' } | { step: 'loading' } | { step: 'error'; message: string } | { step: 'done'; added: number; matched: number };

const CLOSE_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

/** What leaves the phone, worded from what the request really holds. */
export function sentText(hasSeason: boolean, hasClothes: boolean): string {
  const parts = ['The trip name and dates'];
  if (hasSeason) parts.push('your colour season and palette');
  if (hasClothes) parts.push('a list of your clothes: names, types and colours');
  if (parts.length === 1) return `${parts[0]}.`;
  const last = parts.pop()!;
  return `${parts.join(', ')}, and ${last}.`;
}

/** The "Suggest a packing list" sheet, in its four steps (confirm, loading, error, done). */
export function suggestSheet(t: Trip, hasSeason: boolean, hasClothes: boolean, s: SuggestStep): string {
  const head = (title: string) => `
      <div class="grab" aria-hidden="true"></div>
      <div class="p-sheet-head">
        <h2 id="p-sheet-title">${title}</h2>
        <button type="button" class="p-close" data-act="close" aria-label="Close">${CLOSE_X}</button>
      </div>`;
  if (s.step === 'loading') {
    return `${head('Asking Gemini…')}
      <div class="p-sug-wait" role="status"><span class="p-sug-spin" aria-hidden="true"></span><span>Asking Gemini…</span></div>
      <div class="p-sug-skel" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="sheet-actions"><button type="button" class="secondary" data-act="suggest-cancel">Cancel</button></div>`;
  }
  if (s.step === 'done') {
    return `${head(`${s.added} ${s.added === 1 ? 'suggestion' : 'suggestions'} added`)}
      ${s.matched ? `<p class="help">Gemini matched ${s.matched} of them to clothes you own. Want to swap those in?</p>` : ''}
      <div class="sheet-actions">
        ${s.matched ? '<button type="button" class="secondary" data-act="review-matches" disabled>Review matches</button>' : ''}
        <button type="button" class="primary" data-act="suggest-done">See the list</button>
      </div>`;
  }
  if (s.step === 'error') {
    return `${head('Suggest a packing list')}
      <p class="help" role="alert" id="p-sug-error">${esc(s.message)}</p>
      <div class="sheet-actions">
        <button type="button" class="primary" data-act="suggest-ask">Try again</button>
        <button type="button" class="secondary" data-act="suggest-cancel">Cancel</button>
      </div>`;
  }
  return `${head('Suggest a packing list')}
      <p>Gemini suggests pieces for ${esc(t.name)}, ${esc(formatDates(t.starts, t.ends))}${hasSeason ? ', in colours from your palette' : ''}.</p>
      <div class="p-sug-info">
        <h3>Sent to Gemini</h3>
        <p id="p-sug-sent">${sentText(hasSeason, hasClothes)}</p>
        <h3>Stays on your phone</h3>
        <p id="p-sug-stays">Your photos and measurements. Gemini sees your clothes as names, types and colours, never as pictures.</p>
      </div>
      <p class="help">New suggestions replace the ones already on this trip. Clothes and outfits you added are never touched.</p>
      <div class="sheet-actions">
        <button type="button" class="primary" data-act="suggest-ask">Ask Gemini</button>
        <button type="button" class="secondary" data-act="suggest-cancel">Cancel</button>
      </div>`;
}
