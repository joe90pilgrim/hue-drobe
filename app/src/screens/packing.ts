import { itemKind, loadItems, type SavedItem } from '../wardrobe';
import { loadOutfits, resolveOutfit, type Outfit } from '../outfits';
import { itemSilhouette } from '../silhouettes';
import { TemplateError, buildTemplateRequest, fetchTemplate, loadSeason } from '../packing-template';
import {
  addOutfit,
  backfillOutfitPieces,
  datesError,
  deleteTrip,
  editTemplateLine,
  formatDates,
  hasEntry,
  loadTrips,
  matchesSearch,
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

/** One small square per colour, beside the name. Decorative: the name and pieces say what it is. */
const swatches = (colours: string[]) =>
  `<span class="p-swatches" aria-hidden="true">${colours.map((c) => `<span class="p-swatch" style="background:${c}"></span>`).join('')}</span>`;

/** Packing lists (V4-03). A trip has a name and dates; its list holds saved clothes and saved outfits to tick off. */
export function renderPacking(el: HTMLElement): () => void {
  el.innerHTML = `
    <div class="p-page">
    <div class="w-head"><h1 class="page-title">Packing</h1><button type="button" class="primary" id="p-new">New trip</button></div>
    <p class="help w-empty" id="p-empty" hidden>No trips yet. Tap New trip to start a packing list.</p>
    <div class="p-trips" id="p-trips"></div>
    <section class="p-detail" id="p-detail" hidden></section>
    <dialog class="sheet p-sheet" id="p-sheet" aria-labelledby="p-sheet-title"></dialog>
    <dialog class="sheet p-sheet" id="p-confirm" aria-labelledby="p-confirm-title"></dialog>
    </div>`;

  const $ = <T extends HTMLElement>(id: string) => el.querySelector<T>('#' + id)!;
  const empty = $('p-empty');
  const tripsEl = $('p-trips');
  const detail = $('p-detail');
  const sheet = $<HTMLDialogElement>('p-sheet');
  const confirmDlg = $<HTMLDialogElement>('p-confirm');

  let trips: Trip[] = [];
  let items: SavedItem[] = [];
  let outfits: Outfit[] = [];
  let selected: string | null = null;
  /** The trip the form is editing, or null for a new trip. */
  let editing: string | null = null;
  /** The template line the edit form is changing. */
  let editingLine: string | null = null;
  /** The trip a template is being made for, and the last failure (with its trip), shown in place of the lines. */
  let making: string | null = null;
  let templateError: { trip: string; message: string } | null = null;
  let gone = false;

  const selectedTrip = () => trips.find((t) => t.id === selected);
  const save = () => void saveTrips(trips);

  /** The pieces an outfit is made of, as the saved items that are still in the wardrobe. */
  const piecesOf = (o: Outfit): SavedItem[] => {
    const look = resolveOutfit(o, items);
    return [look.hat, look.dress, look.top, look.bottom, look.legs, look.shoes].filter((i): i is SavedItem => !!i);
  };

  /** What an outfit is made of, as words: "Navy tee, Brown trousers". */
  const piecesText = (o: Outfit) => piecesOf(o).map((i) => esc(i.name)).join(', ');

  // --- The list of trips and the chosen trip's checklist -------------------------------------------------------------

  const rowHtml = (e: PackEntry) => {
    if (e.kind === 'item') {
      const item = items.find((i) => i.id === e.ref);
      if (!item) return goneRow(e, 'Clothes item');
      return checkRow(e, esc(item.name), esc(itemKind(item)), [item.colour]);
    }
    if (e.kind === 'template') return templateRow(e);
    const outfit = outfits.find((o) => o.id === e.ref);
    if (!outfit) return goneRow(e, 'Outfit');
    return lookRow(esc(outfit.name), piecesText(outfit), piecesOf(outfit).map((i) => i.colour));
  };

  /** A planned look: shown on the trip but not ticked. Its garments are the rows that are ticked. */
  const lookRow = (name: string, sub: string, colours: string[]) => `
    <li class="p-row p-look">
      <span class="p-check">
        ${swatches(colours)}
        <span class="p-text"><span class="w-name">${name}</span><span class="w-sub">Planned look${sub ? `: ${sub}` : ''}</span></span>
      </span>
    </li>`;

  const checkRow = (e: PackEntry, name: string, sub: string, colours: string[]) => `
    <li class="p-row${e.packed ? ' packed' : ''}">
      <label class="p-check">
        <input type="checkbox" data-kind="${e.kind}" data-ref="${e.ref}"${e.packed ? ' checked' : ''}>
        ${swatches(colours)}
        <span class="p-text"><span class="w-name">${name}</span><span class="w-sub">${sub}</span></span>
      </label>
    </li>`;

  /** A line from the packing template: plain text with a tick, which can be edited or removed. */
  const templateRow = (e: PackEntry) => `
    <li class="p-row${e.packed ? ' packed' : ''}">
      <label class="p-check">
        <input type="checkbox" data-kind="template" data-ref="${e.ref}"${e.packed ? ' checked' : ''}>
        <span class="p-text"><span class="w-name">${esc(e.text ?? '')}</span><span class="w-sub">${e.group ? esc(e.group) : 'From your template'}</span></span>
      </label>
      <button type="button" class="secondary" data-act="edit-line" data-ref="${e.ref}" aria-label="Edit ${esc(e.text ?? '')}">Edit</button>
      <button type="button" class="secondary" data-act="remove-line" data-ref="${e.ref}" aria-label="Remove ${esc(e.text ?? '')}">Remove</button>
    </li>`;

  /** An entry whose clothes item or outfit was deleted. It stays until taken off the list. */
  const goneRow = (e: PackEntry, what: string) => `
    <li class="p-row p-gone">
      <span class="p-text"><span class="w-sub">${what} removed from your wardrobe</span></span>
      <button type="button" class="secondary" data-act="take-off" data-kind="${e.kind}" data-ref="${e.ref}">Take off</button>
    </li>`;

  /** Whether the colour quiz was finished, read when the screen opens, so the note says what is sent. */
  let hasSeason = false;

  const detailHtml = (t: Trip) => {
    const seasonNote = hasSeason ? ', and your colour season and palette' : '';
    const c = packedCount(t);
    const count = c.total ? `${c.packed} of ${c.total} packed` : 'Nothing on the list yet';
    const pct = c.total ? Math.round((c.packed / c.total) * 100) : 0;
    const list = t.entries.length
      ? `<ul class="p-list" aria-label="Packing list">${t.entries.map(rowHtml).join('')}</ul>`
      : '<p class="help">Tap Add items and outfits, or Make me a template, to build the list.</p>';
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
          <button type="button" class="secondary" data-act="make-template"${making ? ' disabled' : ''}>${making === t.id ? 'Making a template…' : 'Make me a template'}</button>
        </div>
      </div>
      <p class="help" id="p-tpl-note">Sends the trip name and dates${seasonNote} to Gemini to suggest a list. It replaces the template lines on this trip and never touches clothes or outfits you added.</p>
      <p class="help" id="p-tpl-status" role="status">${templateError?.trip === t.id ? esc(templateError.message) : ''}</p>
      ${list}`;
  };

  const draw = () => {
    if (selected && !selectedTrip()) selected = null;
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

  const pick = (kind: PackEntry['kind'], id: string, name: string, sub: string, on: boolean, colours: string[], viaOutfit = false) => `
    <button type="button" class="p-pick${on ? ' on' : ''}" data-kind="${kind}" data-id="${id}" aria-pressed="${on}">
      ${swatches(colours)}
      <span class="p-text"><span class="w-name">${esc(name)}</span><span class="w-sub">${sub}</span></span>
      <span class="p-pick-mark">${on ? 'On the list' : viaOutfit ? 'In an outfit' : 'Add'}</span>
    </button>`;

  /** True when the item was added by hand, as opposed to only being there for an outfit. */
  const ownEntry = (t: Trip, id: string) => !!t.entries.find((e) => e.kind === 'item' && e.ref === id)?.own;

  /** The picker's search text. Cleared each time the picker opens. */
  let pickQuery = '';

  /** Redraws the two lists in the picker. The search box is not rebuilt, so its text and focus stay put. */
  const drawPicks = () => {
    const t = selectedTrip();
    const clothesEl = sheet.querySelector<HTMLElement>('#p-pick-clothes');
    const looksEl = sheet.querySelector<HTMLElement>('#p-pick-looks');
    if (!t || !clothesEl || !looksEl) return;
    const shownItems = items.filter((i) => matchesSearch(pickQuery, [i.name, itemKind(i)]));
    const shownOutfits = outfits.filter((o) => matchesSearch(pickQuery, [o.name, ...piecesOf(o).map((i) => i.name)]));
    clothesEl.innerHTML = shownItems.length
      ? `<div class="p-picks">${shownItems.map((i) => pick('item', i.id, i.name, esc(itemKind(i)), ownEntry(t, i.id), [i.colour], hasEntry(t, 'item', i.id))).join('')}</div>`
      : `<p class="help">${items.length === 0 ? 'No saved clothes yet.' : 'No clothes match your search.'}</p>`;
    looksEl.innerHTML = shownOutfits.length
      ? `<div class="p-picks">${shownOutfits.map((o) => pick('outfit', o.id, o.name, piecesText(o), hasEntry(t, 'outfit', o.id), piecesOf(o).map((i) => i.colour))).join('')}</div>`
      : `<p class="help">${outfits.length === 0 ? 'No saved outfits yet.' : 'No outfits match your search.'}</p>`;
  };

  const openPicker = () => {
    const t = selectedTrip();
    if (!t) return;
    pickQuery = '';
    sheet.innerHTML = `
      <div class="grab" aria-hidden="true"></div>
      <h2 id="p-sheet-title">Add to ${esc(t.name)}</h2>
      <p class="help">Tap to add a piece or an outfit, or to take it off. An outfit adds its pieces too. Packing ticks happen on the list.</p>
      <label class="field-label" for="p-pick-search">Search</label>
      <input id="p-pick-search" class="w-name-input" type="search" autocomplete="off" placeholder="Search clothes and outfits">
      <h3 class="p-group">Clothes</h3>
      <div id="p-pick-clothes"></div>
      <h3 class="p-group">Outfits</h3>
      <div id="p-pick-looks"></div>
      <div class="sheet-actions"><button type="button" class="primary" data-act="done">Done</button></div>`;
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

  /** Asks the server for a template and swaps it in for the trip's template lines. A failure leaves the trip as it was. */
  const makeTemplate = async (t: Trip) => {
    if (making) return;
    making = t.id;
    templateError = null;
    draw();
    try {
      const lines = await fetchTemplate(buildTemplateRequest(t, await loadSeason()));
      if (gone) return;
      trips = replaceTemplate(trips, t.id, lines);
      save();
    } catch (e) {
      if (gone) return;
      templateError = { trip: t.id, message: e instanceof TemplateError ? e.message : 'Could not make a template. Try again in a moment.' };
    } finally {
      making = null;
      if (!gone) {
        draw();
        detail.querySelector<HTMLButtonElement>('[data-act="make-template"]')?.focus();
      }
    }
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
    selected = id;
    draw();
    detail.scrollIntoView({ block: 'start' });
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
        void makeTemplate(t);
        break;
      case 'edit-line':
        openLineForm(t, b.dataset.ref!);
        break;
      case 'remove-line':
        trips = removeEntry(trips, t.id, 'template', b.dataset.ref!);
        save();
        draw();
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
    const pickBtn = target.closest<HTMLButtonElement>('.p-pick');
    const t = selectedTrip();
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
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'done') sheet.close();
    if (act === 'cancel-form') sheet.close();
    if (act === 'delete-trip') {
      const open = selectedTrip();
      sheet.close();
      if (open) askDelete(open);
    }
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
    draw();
  });
  draw();

  return () => {
    gone = true;
    if (sheet.open) sheet.close();
    if (confirmDlg.open) confirmDlg.close();
  };
}
