import { GARMENTS, itemKind, loadItems, type SavedItem } from '../wardrobe';
import { loadOutfits, resolveOutfit, type Outfit } from '../outfits';
import { flatLayOf, itemSilhouette } from '../silhouettes';
import { matchBanner, matchedLines, suggestedSection, suggestSheet, type SuggestStep } from './packing-suggest';
import { matchChips, matchFoot, matchGrid, matchHint, matchSheet, reviewFoot, reviewList, reviewRows, reviewSheet, type MatchView } from './packing-match';
import { preselected, rankCandidates, slotOf as lineSlotOf } from '../match';
import { TemplateError, buildTemplateRequest, fetchTemplate, loadSeason } from '../packing-template';
import {
  addOutfit,
  backfillOutfitPieces,
  datesError,
  deleteTrip,
  editTemplateLine,
  formatDates,
  hasEntry,
  inOutfitOnly,
  loadTrips,
  isMatched,
  matchesSearch,
  matchLine,
  matchMany,
  newTrip,
  packedCount,
  peekItems,
  removeEntry,
  removeOutfit,
  replaceTemplate,
  saveTrips,
  setPacked,
  TEMPLATE_TEXT_MAX,
  todayIso,
  toggleEntry,
  updateTrip,
  type PackEntry,
  type Trip,
} from '../trips';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The trip last looked at. Kept for as long as the app is open, so coming back from another tab opens the same trip. */
let lastSelected: string | null = null;

/** Packing lists (V4-03). A trip has a name and dates; its list holds saved clothes and saved outfits to tick off. */
export function renderPacking(el: HTMLElement): () => void {
  el.innerHTML = `
    <div class="p-page">
    <div class="w-head"><h1 class="page-title">Packing</h1></div>
    <button type="button" class="primary p-new" id="p-new">New trip</button>
    <p class="help w-empty" id="p-empty" hidden>No trips yet. Tap New trip to start a packing list.</p>
    <div class="p-trips" id="p-trips"></div>
    <section class="p-detail" id="p-detail" hidden></section>
    <dialog class="sheet p-sheet" id="p-sheet" aria-labelledby="p-sheet-title"></dialog>
    <dialog class="sheet p-sheet" id="p-confirm" aria-labelledby="p-confirm-title"></dialog>
    <div class="p-toast" id="p-toast" role="status" aria-live="polite" hidden></div>
    </div>`;

  const $ = <T extends HTMLElement>(id: string) => el.querySelector<T>('#' + id)!;
  const empty = $('p-empty');
  const tripsEl = $('p-trips');
  const detail = $('p-detail');
  const sheet = $<HTMLDialogElement>('p-sheet');
  const confirmDlg = $<HTMLDialogElement>('p-confirm');
  const toast = $('p-toast');

  let trips: Trip[] = [];
  let items: SavedItem[] = [];
  let outfits: Outfit[] = [];
  let selected: string | null = lastSelected;
  /** False until the saved trips are read, so a remembered trip is not dropped by the first, empty draw. */
  let loaded = false;
  /** The trip the form is editing, or null for a new trip. */
  let editing: string | null = null;
  /** The template line the edit form is changing. */
  let editingLine: string | null = null;
  /** The trip a template is being made for, and the last failure (with its trip), shown in place of the lines. */
  let making: string | null = null;
  let templateError: { trip: string; message: string } | null = null;
  let gone = false;
  /** The Match sheet's state: the suggestion, how the pieces are filtered and which are chosen. Null when it is not open. */
  let matching: { ref: string; scope: 'slot' | 'all'; picked: string[] } | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** How long Undo stays on the toast after a bulk match (V7-08). */
  const UNDO_MS = 8000;
  /** The trip as it was just before the bulk match, and as the match left it. In memory only; null when there is nothing to undo. */
  let undoMatch: { before: Trip; after: Trip } | null = null;
  /** The Review sheet's state: the lines that are unticked. Null when it is not open. */
  let reviewing: { off: Set<string> } | null = null;

  /** A short dark message at the foot of the page, for a few seconds. */
  const showToast = (text: string, undo = false) => {
    if (!undo) undoMatch = null;
    toast.innerHTML = undo ? `<span id="p-toast-text"></span><button type="button" class="p-toast-undo" data-act="undo-match">Undo</button>` : '<span id="p-toast-text"></span>';
    toast.querySelector('#p-toast-text')!.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, undo ? UNDO_MS : 4000);
  };
  function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    undoMatch = null;
  }

  const selectedTrip = () => trips.find((t) => t.id === selected);
  /** Every save but the match itself ends the undo, so Undo never throws away a later edit. */
  const save = () => {
    if (undoMatch && trips.find((t) => t.id === undoMatch!.after.id) !== undoMatch.after) hideToast();
    void saveTrips(trips);
  };

  /** The pieces an outfit is made of, as the saved items that are still in the wardrobe. */
  const piecesOf = (o: Outfit): SavedItem[] => {
    const look = resolveOutfit(o, items);
    return [look.hat, look.dress, look.top, look.outer, look.bottom, look.legs, look.shoes].filter((i): i is SavedItem => !!i);
  };

  // --- The list of trips and the chosen trip's checklist -------------------------------------------------------------

  /** One clothes item as a tile: its silhouette, name, type and a tick ring. The whole tile is the button (V7-03). */
  const tileHtml = (e: PackEntry) => {
    const item = items.find((i) => i.id === e.ref);
    if (!item) return goneTile(e, 'Clothes item');
    const kind = itemKind(item);
    const label = `${item.name}, ${kind}, ${e.packed ? 'packed. Tap to unpack' : 'not packed. Tap to pack'}`;
    return `
    <li class="p-tile-li">
      <button type="button" class="p-tile${e.packed ? ' packed' : ''}" data-act="toggle" data-kind="item" data-ref="${e.ref}" aria-pressed="${!!e.packed}" aria-label="${esc(label)}">
        <span class="p-tile-ring" aria-hidden="true">${e.packed ? '<svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.7 3.7 7.3-7.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
        <span class="p-tile-art" aria-hidden="true">${itemSilhouette(item, 'flat')}</span>
        <span class="w-name p-tile-name">${esc(item.name)}</span>
        <span class="w-sub">${esc(kind)}</span>
      </button>
    </li>`;
  };

  /** A planned look: the flat-lay card from the Outfits tab, shown on the trip but not ticked. Its garments are the tiles that are ticked. */
  const lookCard = (e: PackEntry, t: Trip) => {
    const outfit = outfits.find((o) => o.id === e.ref);
    if (!outfit) return goneTile(e, 'Outfit');
    const pieces = piecesOf(outfit);
    const done = pieces.filter((i) => t.entries.some((x) => x.kind === 'item' && x.ref === i.id && x.packed)).length;
    return `
    <li class="p-look">
      <span class="o-flat p-look-art">${flatLayOf(outfit, resolveOutfit(outfit, items))}</span>
      <span class="w-name p-look-name">${esc(outfit.name)}</span>
      <span class="w-sub">${done} of ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'} packed</span>
    </li>`;
  };

  /** An entry whose clothes item or outfit was deleted: a dashed tile. It stays until taken off the list. */
  const goneTile = (e: PackEntry, what: string) => `
    <li class="p-tile-li p-gone-li">
      <span class="p-gone">
        <span class="w-sub">${what} removed from your wardrobe</span>
        <button type="button" class="secondary" data-act="take-off" data-kind="${e.kind}" data-ref="${e.ref}">Take off</button>
      </span>
    </li>`;

  /** Whether the Packed section is open. Kept in memory only, so it is closed again next time the screen opens. */
  let packedOpen = false;

  /** Whether the colour quiz was finished, read when the screen opens, so the note says what is sent. */
  let hasSeason = false;

  const detailHtml = (t: Trip) => {
    const c = packedCount(t);
    const count = c.total ? `${c.packed} of ${c.total} packed` : 'Nothing on the list yet';
    const pct = c.total ? Math.round((c.packed / c.total) * 100) : 0;
    const itemEntries = t.entries.filter((e) => e.kind === 'item');
    const toPack = itemEntries.filter((e) => !e.packed || !items.some((i) => i.id === e.ref));
    const packed = itemEntries.filter((e) => e.packed && items.some((i) => i.id === e.ref));
    const looks = t.entries.filter((e) => e.kind === 'outfit');
    const lines = t.entries.filter((e) => e.kind === 'template');
    const list = t.entries.length
      ? `${packed.length ? `<button type="button" class="p-packed-btn" data-act="toggle-packed" aria-expanded="${packedOpen}">Packed ${packed.length}<span class="p-chev" aria-hidden="true"></span></button>${packedOpen ? `<ul class="p-tray p-tray-packed" aria-label="Packed">${packed.map(tileHtml).join('')}</ul>` : ''}` : ''}
        ${looks.length ? `<h3 class="p-group">Outfits</h3><ul class="p-looks" aria-label="Outfits">${looks.map((e) => lookCard(e, t)).join('')}</ul>` : ''}
        ${toPack.length ? `<h3 class="p-group">To pack</h3><ul class="p-tray" aria-label="To pack">${toPack.map(tileHtml).join('')}</ul>` : ''}
        ${lines.length ? `${matchBanner(lines, items)}${suggestedSection(lines, items)}` : ''}`
      : '<p class="help">Tap Add items and outfits, or Suggest a list, to build the list.</p>';
    return `
      <div class="p-summary">
        <div class="p-head">
          <div class="p-summary-top">
            <h2 id="p-title">${esc(t.name)}</h2>
            <button type="button" class="secondary p-edit" data-act="edit">Edit trip</button>
          </div>
          <span class="d-sub">${esc(formatDates(t.starts, t.ends))}</span>
          <p class="p-count" id="p-count">${count}</p>
          <span class="p-bar" aria-hidden="true"><span class="p-bar-fill" style="width:${pct}%"></span></span>
        </div>
        <div class="p-actions">
          <button type="button" class="primary" data-act="add">Add items and outfits</button>
          <button type="button" class="secondary" data-act="make-template"${making ? ' disabled' : ''}>${making === t.id ? 'Asking Gemini…' : 'Suggest a list <span aria-hidden="true">✦</span>'}</button>
        </div>
      </div>
      <p class="help" id="p-tpl-status" role="status">${templateError?.trip === t.id ? esc(templateError.message) : ''}</p>
      ${list}`;
  };

  const draw = () => {
    if (loaded && selected && !selectedTrip()) selected = null;
    if (loaded) lastSelected = selected;
    empty.hidden = trips.length > 0;
    tripsEl.innerHTML = trips
      .map((t) => {
        const c = packedCount(t);
        const on = t.id === selected;
        const peek = peekItems(t, items);
        const pct = c.total ? Math.round((c.packed / c.total) * 100) : 0;
        const circles = peek.length
          ? `<span class="p-trip-peek" aria-hidden="true">${peek.map((i) => `<span class="p-trip-circle">${itemSilhouette(i, 'flat')}</span>`).join('')}</span>`
          : '';
        const bar = c.total ? `<span class="p-bar" aria-hidden="true"><span class="p-bar-fill" style="width:${pct}%"></span></span>` : '';
        return `<button type="button" class="p-trip${on ? ' on' : ''}" data-id="${t.id}" aria-pressed="${on}">
          <span class="p-trip-ring" aria-hidden="true"></span>
          <span class="p-trip-name">${esc(t.name)}</span>
          <span class="p-trip-sub">${esc(formatDates(t.starts, t.ends))}</span>
          ${circles}${bar}
          <span class="p-trip-sub">${c.total ? `${c.packed} of ${c.total} packed` : 'Nothing added yet'}</span>
        </button>`;
      })
      .join('');
    const t = selectedTrip();
    detail.hidden = !t;
    detail.innerHTML = t ? detailHtml(t) : '';
  };

  // --- Dialogs: the trip form, the add-to-list picker and the delete question ----------------------------------------

  /** True when the item was added by hand, as opposed to only being there for an outfit. */
  const ownEntry = (t: Trip, id: string) => !!t.entries.find((e) => e.kind === 'item' && e.ref === id)?.own;

  const TICK = '<svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.7 3.7 7.3-7.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** One tile in the add sheet: art, name, state line and a tick badge. `state` is 'on' (own), 'via' (an outfit holds it) or 'off'. */
  const pickTile = (kind: PackEntry['kind'], id: string, art: string, name: string, state: 'on' | 'via' | 'off', artClass = 'p-tile-art') => {
    const mark = state === 'on' ? 'On the list' : state === 'via' ? 'In an outfit' : 'Add';
    return `
    <button type="button" class="p-pick${state === 'on' ? ' on' : state === 'via' ? ' via' : ''}" data-kind="${kind}" data-id="${id}" aria-pressed="${state === 'on'}" aria-label="${esc(`${name}, ${mark}`)}">
      <span class="p-tile-ring" aria-hidden="true">${state === 'off' ? '' : TICK}</span>
      <span class="${artClass}" aria-hidden="true">${art}</span>
      <span class="w-name p-tile-name">${esc(name)}</span>
      <span class="w-sub p-pick-mark">${mark}</span>
    </button>`;
  };

  /** The picker's tab, filter and search text. Reset each time the picker opens. */
  let pickTab: 'clothes' | 'outfits' = 'clothes';
  let pickFilter = 'all';
  let pickQuery = '';

  const slotOf = (i: SavedItem) => GARMENTS[i.garment].slot;
  const SLOTS: { slot: string; label: string }[] = [
    { slot: 'Top', label: 'Tops' },
    { slot: 'Outer', label: 'Jackets' },
    { slot: 'Dress', label: 'Dresses' },
    { slot: 'Bottom', label: 'Bottoms' },
    { slot: 'Legs', label: 'Tights' },
    { slot: 'Shoes', label: 'Shoes' },
    { slot: 'Hat', label: 'Hats' },
  ];

  /** Redraws everything in the sheet except the search box, so its text and focus stay put. */
  const drawPicks = () => {
    const t = selectedTrip();
    const grid = sheet.querySelector<HTMLElement>('#p-pick-grid');
    if (!t || !grid) return;
    const clothes = pickTab === 'clothes';
    const tabC = sheet.querySelector<HTMLElement>('#p-tab-clothes')!;
    const tabO = sheet.querySelector<HTMLElement>('#p-tab-outfits')!;
    tabC.textContent = `Clothes · ${items.length}`;
    tabO.textContent = `Outfits · ${outfits.length}`;
    tabC.setAttribute('aria-selected', String(clothes));
    tabO.setAttribute('aria-selected', String(!clothes));
    const chips = sheet.querySelector<HTMLElement>('#p-pick-chips')!;
    chips.hidden = !clothes;
    const count = (f: string) => (f === 'all' ? items.length : items.filter((i) => slotOf(i) === f).length);
    chips.innerHTML = [{ slot: 'all', label: 'All' }, ...SLOTS.filter((g) => count(g.slot) > 0)]
      .map((g) => `<button type="button" class="chip-btn" data-filter="${g.slot}" aria-pressed="${pickFilter === g.slot}">${g.label}${g.slot === 'all' ? '' : ` · ${count(g.slot)}`}</button>`)
      .join('');
    if (clothes) {
      const shown = items.filter((i) => (pickFilter === 'all' || slotOf(i) === pickFilter) && matchesSearch(pickQuery, [i.name, itemKind(i)]));
      grid.className = 'p-grid p-grid-3';
      grid.innerHTML = shown.length
        ? shown.map((i) => pickTile('item', i.id, itemSilhouette(i, 'flat'), i.name, ownEntry(t, i.id) ? 'on' : inOutfitOnly(t, i.id) ? 'via' : 'off')).join('')
        : `<p class="help p-grid-empty">${items.length === 0 ? 'No saved clothes yet.' : 'Nothing matches'}</p>`;
    } else {
      const shown = outfits.filter((o) => matchesSearch(pickQuery, [o.name, ...piecesOf(o).map((i) => i.name)]));
      grid.className = 'p-grid p-grid-2';
      grid.innerHTML = shown.length
        ? shown.map((o) => pickTile('outfit', o.id, flatLayOf(o, resolveOutfit(o, items)), o.name, hasEntry(t, 'outfit', o.id) ? 'on' : 'off', 'o-flat p-pick-flat')).join('')
        : `<p class="help p-grid-empty">${outfits.length === 0 ? 'No saved outfits yet.' : 'Nothing matches'}</p>`;
    }
    const done = sheet.querySelector<HTMLElement>('#p-pick-done');
    if (done) done.textContent = `Done · ${t.entries.length} on the list`;
  };

  const openPicker = () => {
    const t = selectedTrip();
    if (!t) return;
    pickQuery = '';
    pickTab = 'clothes';
    pickFilter = 'all';
    sheet.innerHTML = `
      <div class="grab" aria-hidden="true"></div>
      <div class="p-sheet-head">
        <h2 id="p-sheet-title">Add to ${esc(t.name)}</h2>
        <button type="button" class="p-close" data-act="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="seg w-tabs p-pick-tabs" role="tablist" aria-label="Add from">
        <button type="button" role="tab" id="p-tab-clothes" data-tab="clothes" aria-selected="true"></button>
        <button type="button" role="tab" id="p-tab-outfits" data-tab="outfits" aria-selected="false"></button>
      </div>
      <label class="field-label" for="p-pick-search">Search</label>
      <input id="p-pick-search" class="w-name-input" type="search" autocomplete="off" placeholder="Search clothes and outfits">
      <div class="w-chips" id="p-pick-chips" role="group" aria-label="Show"></div>
      <div id="p-pick-grid" role="tabpanel"></div>
      <div class="p-pick-foot"><button type="button" class="primary" id="p-pick-done" data-act="done">Done</button></div>`;
    if (!sheet.open) sheet.showModal();
    drawPicks();
  };

  const openForm = (t: Trip | null) => {
    editing = t?.id ?? null;
    sheet.innerHTML = `
      <form class="p-form" id="p-form" novalidate>
        <h2 id="p-sheet-title">${t ? 'Edit trip' : 'New trip'}</h2>
        <label class="field-label" for="p-f-name">Name</label>
        <input id="p-f-name" class="w-name-input" maxlength="40" autocomplete="off" placeholder="Lisbon weekend" value="${esc(t?.name ?? '')}">
        <label class="field-label" for="p-f-start">Starts</label>
        <input id="p-f-start" class="w-name-input" type="date" required value="${t?.starts ?? todayIso()}">
        <label class="field-label" for="p-f-end">Ends</label>
        <input id="p-f-end" class="w-name-input" type="date" required value="${t?.ends ?? todayIso()}">
        <p class="help" id="p-f-error" role="status"></p>
        <div class="sheet-actions">
          <button type="submit" class="primary">Save trip</button>
          <button type="button" class="secondary" data-act="cancel-form">Cancel</button>
        </div>
        ${t ? '<button type="button" class="p-delete" data-act="delete-trip">Delete trip</button>' : ''}
      </form>`;
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLInputElement>('#p-f-name')?.focus();
  };

  const openLineForm = (t: Trip, ref: string) => {
    const line = t.entries.find((e) => e.kind === 'template' && e.ref === ref);
    if (!line) return;
    editingLine = ref;
    sheet.innerHTML = `
      <form class="p-form" id="p-line-form" novalidate>
        <h2 id="p-sheet-title">Edit line</h2>
        <label class="field-label" for="p-l-text">Text</label>
        <input id="p-l-text" class="w-name-input" maxlength="${TEMPLATE_TEXT_MAX}" autocomplete="off" value="${esc(line.text ?? '')}">
        <p class="help" id="p-l-error" role="status"></p>
        <div class="sheet-actions">
          <button type="submit" class="primary">Save line</button>
          <button type="button" class="secondary" data-act="cancel-form">Cancel</button>
        </div>
      </form>`;
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLInputElement>('#p-l-text')?.focus();
  };

  /** Which step the Suggest sheet is on. `suggestRun` changes whenever the sheet is cancelled or closed, so a late answer is dropped. */
  let suggestRun = 0;
  const showSuggest = (t: Trip, step: SuggestStep) => {
    sheet.innerHTML = suggestSheet(t, hasSeason, items.length > 0, step);
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLElement>('[data-act="suggest-ask"], [data-act="suggest-done"], [data-act="suggest-cancel"]')?.focus();
  };

  /** Asks the server for suggestions and swaps them in for the trip's suggested lines. A failure leaves the trip as it was. */
  const makeTemplate = async (t: Trip) => {
    if (making) return;
    const run = ++suggestRun;
    making = t.id;
    templateError = null;
    draw();
    showSuggest(t, { step: 'loading' });
    try {
      const lines = await fetchTemplate(buildTemplateRequest(t, await loadSeason(), await loadItems()));
      if (gone) return;
      trips = replaceTemplate(trips, t.id, lines);
      save();
      if (run === suggestRun && sheet.open) {
        const added = trips.find((x) => x.id === t.id)?.entries.filter((e) => e.kind === 'template') ?? [];
        showSuggest(t, { step: 'done', added: added.length, matched: matchedLines(added, items).length });
      }
    } catch (e) {
      if (gone) return;
      templateError = { trip: t.id, message: e instanceof TemplateError ? e.message : 'Could not make a template. Try again in a moment.' };
      if (run === suggestRun && sheet.open) showSuggest(t, { step: 'error', message: templateError.message });
    } finally {
      making = null;
      if (!gone) draw();
    }
  };

  /** Opens the Suggest sheet at its first step. Nothing is sent until Ask Gemini is pressed. */
  const openSuggest = async (t: Trip) => {
    // Read the quiz now, so the sheet describes exactly what the request will hold.
    hasSeason = !!(await loadSeason());
    if (!gone) showSuggest(t, { step: 'confirm' });
  };

  // --- The Match sheet (V7-07) -------------------------------------------------------------------------------------

  /** What the Match sheet shows right now, or null when its suggestion has gone. */
  const matchView = (): MatchView | null => {
    const t = selectedTrip();
    const line = t?.entries.find((e) => e.kind === 'template' && e.ref === matching?.ref);
    if (!t || !line || !matching) return null;
    const slot = lineSlotOf(line);
    return {
      line,
      scope: matching.scope,
      ranked: rankCandidates(line, items, t, matching.scope),
      picked: matching.picked,
      slotCount: slot ? items.filter((i) => GARMENTS[i.garment].slot === slot).length : items.length,
      allCount: items.length,
    };
  };

  const openMatch = (t: Trip, ref: string) => {
    const line = t.entries.find((e) => e.kind === 'template' && e.ref === ref);
    if (!line) return;
    matching = { ref, scope: 'slot', picked: preselected(rankCandidates(line, items, t, 'slot'), line.quantity ?? 1) };
    sheet.innerHTML = matchSheet(matchView()!);
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLElement>('.p-match-tile, [data-act="match-later"]')?.focus();
  };

  /** Redraws the parts of the Match sheet that change as pieces are chosen, so the sheet keeps its scroll. */
  const drawMatch = () => {
    const v = matchView();
    if (!v) return;
    sheet.querySelector<HTMLElement>('#p-match-hint')!.textContent = matchHint(v);
    sheet.querySelector<HTMLElement>('#p-match-chips')!.innerHTML = matchChips(v);
    sheet.querySelector<HTMLElement>('#p-match-grid')!.innerHTML = matchGrid(v);
    sheet.querySelector<HTMLElement>('#p-match-foot')!.innerHTML = matchFoot(v);
  };

  /** Chooses or drops a piece. One needed: the piece replaces the choice. More: up to the quantity, the oldest choice making way. */
  const pickMatch = (id: string) => {
    const v = matchView();
    if (!matching || !v) return;
    const max = v.line.quantity ?? 1;
    matching.picked = matching.picked.includes(id) ? matching.picked.filter((x) => x !== id) : [...matching.picked, id].slice(-max);
    drawMatch();
    sheet.querySelector<HTMLElement>(`[data-match-item="${id}"]`)?.focus();
  };

  const useMatch = (t: Trip) => {
    if (!matching || !matchView() || !matching.picked.length) return;
    const ref = matching.ref;
    const ids = matching.picked;
    const names = ids.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean);
    trips = trips.map((x) => (x.id === t.id ? matchLine(x, ref, ids) : x));
    save();
    matching = null;
    sheet.close();
    draw();
    showToast(`Matched to ${names.length === 1 ? names[0] : names.length === 2 ? names.join(' and ') : `${names.length} pieces`}`);
    (detail.querySelector<HTMLElement>(`.p-tile[data-ref="${ids[0]}"]`) ?? detail.querySelector<HTMLElement>('.p-sug [data-act="match-line"]'))?.focus();
  };

  // --- Review matches in bulk, with Undo (V7-08) --------------------------------------------------------------------

  const reviewRowsNow = (t: Trip) => reviewRows(t.entries.filter((e) => e.kind === 'template'), items);

  const openReview = (t: Trip) => {
    const rows = reviewRowsNow(t);
    if (!rows.length) return;
    reviewing = { off: new Set() };
    sheet.innerHTML = reviewSheet(rows, reviewing.off);
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLElement>('.p-review-row')?.focus();
  };

  const toggleReview = (t: Trip, ref: string) => {
    if (!reviewing) return;
    reviewing.off.has(ref) ? reviewing.off.delete(ref) : reviewing.off.add(ref);
    const rows = reviewRowsNow(t);
    sheet.querySelector<HTMLElement>('#p-review-list')!.innerHTML = reviewList(rows, reviewing.off);
    sheet.querySelector<HTMLElement>('#p-review-foot')!.innerHTML = reviewFoot(rows.filter((r) => !reviewing!.off.has(r.line.ref)).length);
    sheet.querySelector<HTMLElement>(`[data-review-line="${ref}"]`)?.focus();
  };

  /** Swaps in every ticked pair in one change, keeping the trip as it was so Undo can put it back. */
  const applyReview = (t: Trip) => {
    if (!reviewing) return;
    const pairs = reviewRowsNow(t)
      .filter((r) => !reviewing!.off.has(r.line.ref))
      .map((r) => ({ line: r.line.ref, item: r.item.id }));
    if (!pairs.length) return;
    const after = matchMany(t, pairs);
    if (after === t) return;
    trips = trips.map((x) => (x.id === t.id ? after : x));
    save();
    reviewing = null;
    sheet.close();
    draw();
    const left = after.entries.filter((e) => e.kind === 'template' && !isMatched(e)).length;
    const n = pairs.length;
    showToast(`Matched ${n} ${n === 1 ? 'suggestion' : 'suggestions'} to your clothes. ${left} ${left === 1 ? 'suggestion' : 'suggestions'} left.`, true);
    undoMatch = { before: t, after };
    detail.querySelector<HTMLElement>('.p-tile, [data-act="make-template"]')?.focus();
  };

  /** Puts the trip back exactly as it was before the bulk match. Only while the toast is up and the trip is untouched since. */
  const undoReview = () => {
    const u = undoMatch;
    if (!u) return;
    hideToast();
    if (trips.find((t) => t.id === u.after.id) !== u.after) return;
    trips = trips.map((t) => (t.id === u.after.id ? u.before : t));
    save();
    draw();
    detail.querySelector<HTMLElement>('[data-act="review-matches"], [data-act="make-template"]')?.focus();
  };

  const askDelete = (t: Trip) => {
    confirmDlg.innerHTML = `
      <h2 id="p-confirm-title">Delete ${esc(t.name)}?</h2>
      <p class="help">Its packing list goes. Your saved clothes and outfits stay.</p>
      <div class="sheet-actions">
        <button type="button" class="primary" data-act="confirm-delete">Delete</button>
        <button type="button" class="secondary" data-act="cancel-delete">Cancel</button>
      </div>`;
    confirmDlg.showModal();
  };

  // --- Events ------------------------------------------------------------------------------------------------------

  $('p-new').addEventListener('click', () => openForm(null));

  tripsEl.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('.p-trip')?.dataset.id;
    if (!id) return;
    if (selected !== id) hideToast();
    selected = id;
    draw();
  });

  detail.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    const t = selectedTrip();
    if (!b || !t) return;
    switch (b.dataset.act) {
      case 'add':
        openPicker();
        break;
      case 'edit':
        openForm(t);
        break;
      case 'make-template':
        void openSuggest(t);
        break;
      case 'match-line':
        openMatch(t, b.dataset.ref!);
        break;
      case 'review-matches':
        openReview(t);
        break;
      case 'edit-line':
        openLineForm(t, b.dataset.ref!);
        break;
      case 'remove-line':
        trips = removeEntry(trips, t.id, 'template', b.dataset.ref!);
        save();
        draw();
        break;
      case 'toggle': {
        const kind = b.dataset.kind as PackEntry['kind'];
        const ref = b.dataset.ref!;
        trips = setPacked(trips, t.id, kind, ref, b.getAttribute('aria-pressed') !== 'true');
        save();
        draw();
        // The tile may have moved between sections; keep focus on it, or on the Packed button if that section is closed.
        (detail.querySelector<HTMLElement>(`.p-tile[data-ref="${ref}"]`) ?? detail.querySelector<HTMLElement>('[data-act="toggle-packed"]') ?? detail.querySelector<HTMLElement>('.p-tile'))?.focus();
        break;
      }
      case 'toggle-packed':
        packedOpen = !packedOpen;
        draw();
        detail.querySelector<HTMLElement>('[data-act="toggle-packed"]')?.focus();
        break;
      case 'take-off':
        trips = b.dataset.kind === 'outfit' ? removeOutfit(trips, t.id, b.dataset.ref!) : removeEntry(trips, t.id, 'item', b.dataset.ref!);
        save();
        draw();
        break;
    }
  });

  // Ticking a box keeps focus on it, so the list can be worked from the keyboard.
  detail.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    const t = selectedTrip();
    if (!t || box.type !== 'checkbox') return;
    const kind = box.dataset.kind as PackEntry['kind'];
    const ref = box.dataset.ref!;
    trips = setPacked(trips, t.id, kind, ref, box.checked);
    save();
    draw();
    detail.querySelector<HTMLInputElement>(`input[data-kind="${kind}"][data-ref="${ref}"]`)?.focus();
  });

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) return sheet.close(); // a tap on the scrim
    const target = e.target as HTMLElement;
    const t = selectedTrip();
    const reviewRow = target.closest<HTMLElement>('[data-review-line]');
    if (reviewRow && reviewing && t) return toggleReview(t, reviewRow.dataset.reviewLine!);
    const matchTile = target.closest<HTMLElement>('[data-match-item]');
    if (matchTile && matching) return pickMatch(matchTile.dataset.matchItem!);
    const scopeBtn = target.closest<HTMLElement>('[data-match-scope]');
    if (scopeBtn && matching) {
      matching.scope = scopeBtn.dataset.matchScope as 'slot' | 'all';
      drawMatch();
      sheet.querySelector<HTMLElement>(`[data-match-scope="${matching.scope}"]`)?.focus();
      return;
    }
    const pickBtn = target.closest<HTMLButtonElement>('.p-pick[data-kind]');
    if (pickBtn && t) {
      const kind = pickBtn.dataset.kind as PackEntry['kind'];
      const id = pickBtn.dataset.id!;
      if (kind === 'item') trips = toggleEntry(trips, t.id, id);
      else if (hasEntry(t, 'outfit', id)) trips = removeOutfit(trips, t.id, id);
      else {
        const outfit = outfits.find((o) => o.id === id);
        trips = addOutfit(trips, t.id, id, outfit ? piecesOf(outfit).map((i) => i.id) : []);
      }
      save();
      draw();
      drawPicks();
      sheet.querySelector<HTMLElement>(`.p-pick[data-kind="${kind}"][data-id="${id}"]`)?.focus();
      return;
    }
    const tab = target.closest<HTMLElement>('[data-tab]')?.dataset.tab;
    if (tab) {
      pickTab = tab as 'clothes' | 'outfits';
      drawPicks();
      sheet.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.focus();
      return;
    }
    const filterBtn = target.closest<HTMLElement>('#p-pick-chips [data-filter]');
    if (filterBtn) {
      pickFilter = filterBtn.dataset.filter!;
      drawPicks();
      sheet.querySelector<HTMLElement>(`#p-pick-chips [data-filter="${pickFilter}"]`)?.focus();
      return;
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'review-matches' && t) return openReview(t);
    if (act === 'review-apply' && t) return applyReview(t);
    if (act === 'review-later') return sheet.close();
    if (act === 'match-use' && t) return useMatch(t);
    if (act === 'match-later') return sheet.close();
    if (act === 'match-edit' && t && matching) {
      const ref = matching.ref;
      matching = null;
      return openLineForm(t, ref);
    }
    if (act === 'match-remove' && t && matching) {
      trips = removeEntry(trips, t.id, 'template', matching.ref);
      save();
      sheet.close();
      return draw();
    }
    if (act === 'suggest-ask') {
      const open = selectedTrip();
      if (open) void makeTemplate(open);
      return;
    }
    if (act === 'suggest-cancel' || act === 'suggest-done') {
      suggestRun++;
      sheet.close();
      detail.querySelector<HTMLButtonElement>('[data-act="make-template"]')?.focus();
      return;
    }
    if (act === 'done' || act === 'close') {
      suggestRun++;
      sheet.close();
    }
    if (act === 'cancel-form') sheet.close();
    if (act === 'delete-trip') {
      const open = selectedTrip();
      sheet.close();
      if (open) askDelete(open);
    }
  });

  // Any way of closing the sheet (X, scrim, Escape) drops an answer still on its way, so it cannot land in a different sheet.
  sheet.addEventListener('close', () => {
    suggestRun++;
    matching = null;
    reviewing = null;
  });

  toast.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="undo-match"]')) undoReview();
  });

  sheet.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.id !== 'p-pick-search') return;
    pickQuery = input.value;
    drawPicks();
  });

  sheet.addEventListener('submit', (e) => {
    e.preventDefault();
    if ((e.target as HTMLElement).id === 'p-line-form') {
      const text = sheet.querySelector<HTMLInputElement>('#p-l-text')?.value ?? '';
      const t = selectedTrip();
      if (!text.trim()) {
        const msg = sheet.querySelector<HTMLElement>('#p-l-error');
        if (msg) msg.textContent = 'Enter some text, or remove the line instead.';
        return;
      }
      if (t && editingLine) {
        trips = editTemplateLine(trips, t.id, editingLine, text);
        save();
      }
      editingLine = null;
      sheet.close();
      draw();
      return;
    }
    const name = (sheet.querySelector<HTMLInputElement>('#p-f-name')?.value ?? '').trim();
    const starts = sheet.querySelector<HTMLInputElement>('#p-f-start')?.value ?? '';
    const ends = sheet.querySelector<HTMLInputElement>('#p-f-end')?.value ?? '';
    const error = datesError(starts, ends);
    const msg = sheet.querySelector<HTMLElement>('#p-f-error');
    if (error) {
      if (msg) msg.textContent = error;
      return;
    }
    if (editing) {
      trips = updateTrip(trips, editing, name, starts, ends);
      selected = editing;
    } else {
      const t = newTrip(name, starts, ends);
      trips = [...trips, t];
      selected = t.id;
    }
    save();
    sheet.close();
    draw();
  });

  confirmDlg.addEventListener('click', (e) => {
    if (e.target === confirmDlg) return confirmDlg.close();
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'cancel-delete') confirmDlg.close();
    if (act === 'confirm-delete' && selected) {
      trips = deleteTrip(trips, selected);
      selected = null;
      save();
      confirmDlg.close();
      draw();
    }
  });

  loadSeason().then((s) => {
    hasSeason = !!s;
    if (!gone) draw();
  });

  Promise.all([loadTrips(), loadItems(), loadOutfits()]).then(([loadedTrips, loadedItems, loadedOutfits]) => {
    if (gone) return;
    items = loadedItems;
    outfits = loadedOutfits;
    // Trips saved before V4-04 hold outfits with no garments; add them once (no change, no save, after that).
    trips = backfillOutfitPieces(loadedTrips, (id) => {
      const o = outfits.find((x) => x.id === id);
      return o ? piecesOf(o).map((i) => i.id) : [];
    });
    if (trips !== loadedTrips) save();
    loaded = true;
    draw();
  });
  draw();

  return () => {
    gone = true;
    clearTimeout(toastTimer);
    if (sheet.open) sheet.close();
    if (confirmDlg.open) confirmDlg.close();
  };
}
