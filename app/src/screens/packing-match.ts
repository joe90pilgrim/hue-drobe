// V7-07: the Match sheet, where a suggested line is swapped for a piece you own. Pure HTML builders, no state and no store,
// so packing.ts keeps the events. The copy is the spec's (docs/decisions/2026-11-23-v7-packing-and-icon-spec.md, section 4).
import { isClose, slotOf, type Candidate } from '../match';
import { itemSilhouette } from '../silhouettes';
import { colourName, type SavedItem } from '../wardrobe';
import { isMatched, type PackEntry } from '../trips';
import { ghostOf, lineName } from './packing-suggest';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const CLOSE_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const TICK = '<svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.7 3.7 7.3-7.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** What the sheet is showing: the line, how it is filtered, and what is chosen. */
export interface MatchView {
  line: PackEntry;
  scope: 'slot' | 'all';
  ranked: Candidate[];
  picked: string[];
  /** How many pieces the wardrobe has in the line's slot, for the chip. */
  slotCount: number;
  /** How many pieces the wardrobe has in all, for the chip. */
  allCount: number;
}

/** The slot's name as a chip label, such as "Tops". A line with no slot has no chip of its own. */
const SLOT_LABEL: Record<string, string> = { Top: 'Tops', Outer: 'Jackets', Bottom: 'Bottoms', Legs: 'Tights', Dress: 'Dresses', Shoes: 'Shoes', Hat: 'Hats' };

const quantityOf = (line: PackEntry) => line.quantity ?? 1;

/** The suggestion at the top of the sheet: ghost, name, group and colour, quantity chip. */
function lineSummary(line: PackEntry): string {
  const { name, quantity } = lineName(line);
  const colour = line.colour ? `<span class="p-match-dot" style="background:${line.colour}" aria-hidden="true"></span>${esc(colourName(line.colour))}` : '';
  const sub = [line.group ? esc(line.group) : 'Suggested', colour].filter(Boolean).join(' · ');
  return `
      <div class="p-match-line">
        <span class="p-sug-art" aria-hidden="true">${ghostOf(line)}</span>
        <span class="p-text"><span class="w-name">${esc(name)}</span><span class="w-sub p-match-sub">${sub}</span></span>
        ${quantity > 1 ? `<span class="p-sug-qty">× ${quantity}</span>` : ''}
      </div>`;
}

/** The sentence under the suggestion: whether anything is close, and what to do about it. */
export function matchHint(v: MatchView): string {
  const nothingClose = !v.ranked.some((c) => c.geminiPick || isClose(c.distance));
  if (!nothingClose) return 'Pick the piece you want to use. Closest colours come first.';
  if (!v.line.colour) return 'No colour was suggested, so pick the piece you want to use.';
  return 'Nothing in your wardrobe is close to this colour. Pick something similar, or leave it as a note to buy or borrow.';
}

/** The tiles: Gemini's picks first, then by colour. The first piece that is not a pick is tagged "Closest" when it really is close. */
export function matchGrid(v: MatchView): string {
  if (!v.ranked.length) return '<p class="help p-grid-empty">Nothing close in your wardrobe</p>';
  const closest = v.ranked.find((c) => !c.geminiPick);
  return v.ranked
    .map((c) => {
      const on = v.picked.includes(c.item.id);
      const tag = c.geminiPick ? "Gemini's pick" : c === closest && isClose(c.distance) ? 'Closest' : '';
      const status = c.status === 'on' ? 'On the list' : c.status === 'via' ? 'In an outfit' : '';
      const label = [c.item.name, tag, status].filter(Boolean).join(', ');
      return `
    <button type="button" class="p-pick p-match-tile${on ? ' on' : ''}" data-match-item="${c.item.id}" aria-pressed="${on}" aria-label="${esc(label)}">
      <span class="p-tile-ring" aria-hidden="true">${on ? TICK : ''}</span>
      <span class="p-tile-art" aria-hidden="true">${itemSilhouette(c.item, 'flat')}</span>
      <span class="w-name p-tile-name">${esc(c.item.name)}</span>
      ${tag ? `<span class="w-sub p-match-tag">${esc(tag)}</span>` : ''}
      ${status ? `<span class="w-sub p-pick-mark">${status}</span>` : ''}
    </button>`;
    })
    .join('');
}

/** The two filter chips: the line's own category (when it has one) and all clothes. */
export function matchChips(v: MatchView): string {
  const slot = slotOf(v.line);
  const chip = (scope: string, text: string) => `<button type="button" class="chip-btn" data-match-scope="${scope}" aria-pressed="${v.scope === scope}">${text}</button>`;
  return (slot && v.slotCount > 0 ? chip('slot', `${SLOT_LABEL[slot] ?? slot} · ${v.slotCount}`) : '') + chip('all', `All clothes · ${v.allCount}`);
}

/** The footer: a note, the main button and the three small ones. `onList` is the picked pieces already on the list by hand. */
export function matchFoot(v: MatchView): string {
  const n = v.picked.length;
  const left = quantityOf(v.line) - n;
  const first = v.ranked.find((c) => c.item.id === v.picked[0])?.item.name ?? '';
  const nothingClose = !v.ranked.some((c) => c.geminiPick || isClose(c.distance));
  const allOnList = n > 0 && v.picked.every((id) => v.ranked.find((c) => c.item.id === id)?.status === 'on');
  const note = allOnList && left < 1 ? 'Already on your list, so this suggestion is marked Matched.' : n > 0 && left > 0 ? `${left} more stays on your suggestions.` : '';
  const main = n === 0 ? 'Choose a piece' : n === 1 ? `Use ${esc(first)}` : `Use ${n} pieces`;
  return `
      <p class="msg p-match-note" id="p-match-note" role="status">${note}</p>
      <button type="button" class="primary" data-act="match-use"${n === 0 ? ' disabled' : ''}>${main}</button>
      <div class="p-match-small">
        <button type="button" class="secondary" data-act="match-later">${nothingClose && n === 0 ? 'Keep as a suggestion' : 'Not now'}</button>
        <button type="button" class="secondary" data-act="match-edit">Edit</button>
        <button type="button" class="secondary" data-act="match-remove">Remove</button>
      </div>`;
}

/** One row of the Review sheet: the suggestion, and the piece Gemini picked for it. */
export interface ReviewRow {
  line: PackEntry;
  item: SavedItem;
}

/**
 * The rows of the Review sheet (V7-08): one per line with a match that is still in the wardrobe. A line with several picks
 * uses the first that no earlier row has taken; if they are all taken, its first one (a piece two lines share is added once).
 */
export function reviewRows(lines: PackEntry[], items: SavedItem[]): ReviewRow[] {
  const taken = new Set<string>();
  const rows: ReviewRow[] = [];
  for (const line of lines) {
    if (isMatched(line)) continue;
    const live = (line.matches ?? []).flatMap((id) => items.filter((i) => i.id === id));
    const item = live.find((i) => !taken.has(i.id)) ?? live[0];
    if (!item) continue;
    taken.add(item.id);
    rows.push({ line, item });
  }
  return rows;
}

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The rows, each a tickable button. `off` holds the refs of the lines that are not ticked. */
export function reviewList(rows: ReviewRow[], off: Set<string>): string {
  return rows
    .map(({ line, item }) => {
      const on = !off.has(line.ref);
      const { name, quantity } = lineName(line);
      const label = `${name}${quantity > 1 ? ` × ${quantity}` : ''} to ${item.name}`;
      return `
    <li><button type="button" class="p-review-row${on ? ' on' : ''}" data-review-line="${line.ref}" aria-pressed="${on}" aria-label="${esc(label)}">
      <span class="p-tile-ring" aria-hidden="true">${on ? TICK : ''}</span>
      <span class="p-sug-art" aria-hidden="true">${ghostOf(line)}</span>
      <span class="p-text"><span class="w-sub">Suggested</span><span class="w-name">${esc(name)}${quantity > 1 ? ` × ${quantity}` : ''}</span></span>
      <span class="p-review-arrow" aria-hidden="true">${ARROW}</span>
      <span class="p-sug-art" aria-hidden="true">${itemSilhouette(item, 'flat')}</span>
      <span class="p-text"><span class="w-sub">Your piece</span><span class="w-name">${esc(item.name)}</span></span>
    </button></li>`;
    })
    .join('');
}

/** The footer of the Review sheet: "Match N", or a disabled "Tick at least one", and "Not now". */
export function reviewFoot(n: number): string {
  return `
      <button type="button" class="primary" data-act="review-apply"${n === 0 ? ' disabled' : ''}>${n === 0 ? 'Tick at least one' : `Match ${n}`}</button>
      <button type="button" class="secondary" data-act="review-later">Not now</button>`;
}

/** The whole Review sheet. The list and footer are redrawn on their own as rows are ticked. */
export function reviewSheet(rows: ReviewRow[], off: Set<string>): string {
  return `
      <div class="p-sheet-head">
        <h2 id="p-sheet-title">Review matches</h2>
        <button type="button" class="p-close" data-act="close" aria-label="Close">${CLOSE_X}</button>
      </div>
      <p class="help">Gemini matched these suggestions to clothes you own. Untick any you want to leave as suggestions.</p>
      <ul class="p-review" id="p-review-list">${reviewList(rows, off)}</ul>
      <div class="p-pick-foot p-match-foot" id="p-review-foot">${reviewFoot(rows.length - off.size)}</div>`;
}

/** The whole Match sheet. The grid, chips and footer are redrawn on their own as pieces are picked, so the sheet keeps its scroll. */
export function matchSheet(v: MatchView): string {
  return `
      <div class="p-sheet-head">
        <h2 id="p-sheet-title">Match to your clothes</h2>
        <button type="button" class="p-close" data-act="close" aria-label="Close">${CLOSE_X}</button>
      </div>
      ${lineSummary(v.line)}
      <p class="help" id="p-match-hint">${matchHint(v)}</p>
      <div class="w-chips" id="p-match-chips" role="group" aria-label="Show">${matchChips(v)}</div>
      <div class="p-grid p-grid-3" id="p-match-grid">${matchGrid(v)}</div>
      <div class="p-pick-foot p-match-foot" id="p-match-foot">${matchFoot(v)}</div>`;
}
