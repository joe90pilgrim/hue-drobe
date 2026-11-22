import { itemKind, loadItems, type SavedItem } from '../wardrobe';
import { loadOutfits, resolveOutfit, type Outfit } from '../outfits';
import {
  datesError,
  deleteTrip,
  formatDates,
  hasEntry,
  loadTrips,
  newTrip,
  packedCount,
  saveTrips,
  setPacked,
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
    <div class="w-head"><h1 class="page-title">Packing</h1><button type="button" class="primary" id="p-new">New trip</button></div>
    <p class="help w-empty" id="p-empty" hidden>No trips yet. Tap New trip to start a packing list.</p>
    <div class="w-grid p-trips" id="p-trips"></div>
    <section class="p-detail" id="p-detail" hidden></section>
    <dialog class="sheet p-sheet" id="p-sheet" aria-labelledby="p-sheet-title"></dialog>
    <dialog class="sheet p-sheet" id="p-confirm" aria-labelledby="p-confirm-title"></dialog>`;

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
  let gone = false;

  const selectedTrip = () => trips.find((t) => t.id === selected);
  const save = () => void saveTrips(trips);

  /** The pieces an outfit is made of, as the saved items that are still in the wardrobe. */
  const piecesOf = (o: Outfit): SavedItem[] => {
    const look = resolveOutfit(o, items);
    return [look.dress, look.top, look.bottom, look.legs].filter((i): i is SavedItem => !!i);
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
    const outfit = outfits.find((o) => o.id === e.ref);
    if (!outfit) return goneRow(e, 'Outfit');
    return checkRow(e, esc(outfit.name), piecesText(outfit), piecesOf(outfit).map((i) => i.colour));
  };

  const checkRow = (e: PackEntry, name: string, sub: string, colours: string[]) => `
    <li class="p-row${e.packed ? ' packed' : ''}">
      <label class="p-check">
        <input type="checkbox" data-kind="${e.kind}" data-ref="${e.ref}"${e.packed ? ' checked' : ''}>
        ${swatches(colours)}
        <span class="p-text"><span class="w-name">${name}</span><span class="w-sub">${sub}</span></span>
      </label>
    </li>`;

  /** An entry whose clothes item or outfit was deleted. It stays until taken off the list. */
  const goneRow = (e: PackEntry, what: string) => `
    <li class="p-row p-gone">
      <span class="p-text"><span class="w-sub">${what} removed from your wardrobe</span></span>
      <button type="button" class="secondary" data-act="take-off" data-kind="${e.kind}" data-ref="${e.ref}">Take off</button>
    </li>`;

  const detailHtml = (t: Trip) => {
    const c = packedCount(t);
    const count = c.total ? `${c.packed} of ${c.total} packed` : 'Nothing on the list yet';
    const list = t.entries.length
      ? `<ul class="p-list" aria-label="Packing list">${t.entries.map(rowHtml).join('')}</ul>`
      : '<p class="help">Tap Add items and outfits to build the list.</p>';
    return `
      <div class="p-head">
        <h2 id="p-title">${esc(t.name)}</h2>
        <span class="d-sub">${esc(formatDates(t.starts, t.ends))}</span>
        <p class="p-count" id="p-count">${count}</p>
      </div>
      <button type="button" class="primary" data-act="add">Add items and outfits</button>
      ${list}
      <div class="d-pair">
        <button type="button" class="secondary" data-act="edit">Edit trip</button>
        <button type="button" class="secondary danger" data-act="delete">Delete trip</button>
      </div>`;
  };

  const draw = () => {
    if (selected && !selectedTrip()) selected = null;
    empty.hidden = trips.length > 0;
    tripsEl.innerHTML = trips
      .map((t) => {
        const c = packedCount(t);
        const on = t.id === selected;
        return `<button type="button" class="w-card${on ? ' on' : ''}" data-id="${t.id}" aria-pressed="${on}">
          <span class="w-card-text"><span class="w-name">${esc(t.name)}</span><span class="w-sub">${esc(formatDates(t.starts, t.ends))}</span><span class="w-sub">${c.total ? `${c.packed} of ${c.total} packed` : 'Nothing added yet'}</span></span>
        </button>`;
      })
      .join('');
    const t = selectedTrip();
    detail.hidden = !t;
    detail.innerHTML = t ? detailHtml(t) : '';
  };

  // --- Dialogs: the trip form, the add-to-list picker and the delete question ----------------------------------------

  const pick = (kind: PackEntry['kind'], id: string, name: string, sub: string, on: boolean, colours: string[]) => `
    <button type="button" class="p-pick${on ? ' on' : ''}" data-kind="${kind}" data-id="${id}" aria-pressed="${on}">
      ${swatches(colours)}
      <span class="p-text"><span class="w-name">${esc(name)}</span><span class="w-sub">${sub}</span></span>
      <span class="p-pick-mark">${on ? 'On the list' : 'Add'}</span>
    </button>`;

  const openPicker = () => {
    const t = selectedTrip();
    if (!t) return;
    const clothes = items.map((i) => pick('item', i.id, i.name, esc(itemKind(i)), hasEntry(t, 'item', i.id), [i.colour])).join('');
    const looks = outfits
      .map((o) => pick('outfit', o.id, o.name, piecesText(o), hasEntry(t, 'outfit', o.id), piecesOf(o).map((i) => i.colour)))
      .join('');
    sheet.innerHTML = `
      <div class="grab" aria-hidden="true"></div>
      <h2 id="p-sheet-title">Add to ${esc(t.name)}</h2>
      <p class="help">Tap to add a piece or an outfit, or to take it off. Packing ticks happen on the list.</p>
      <h3 class="p-group">Clothes</h3>
      ${clothes ? `<div class="p-picks">${clothes}</div>` : '<p class="help">No saved clothes yet.</p>'}
      <h3 class="p-group">Outfits</h3>
      ${looks ? `<div class="p-picks">${looks}</div>` : '<p class="help">No saved outfits yet.</p>'}
      <div class="sheet-actions"><button type="button" class="primary" data-act="done">Done</button></div>`;
    if (!sheet.open) sheet.showModal();
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
      </form>`;
    if (!sheet.open) sheet.showModal();
    sheet.querySelector<HTMLInputElement>('#p-f-name')?.focus();
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
    const id = (e.target as HTMLElement).closest<HTMLElement>('.w-card')?.dataset.id;
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
      case 'delete':
        askDelete(t);
        break;
      case 'take-off':
        trips = toggleEntry(trips, t.id, b.dataset.kind as PackEntry['kind'], b.dataset.ref!);
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
      trips = toggleEntry(trips, t.id, kind, id);
      save();
      draw();
      openPicker();
      sheet.querySelector<HTMLElement>(`.p-pick[data-kind="${kind}"][data-id="${id}"]`)?.focus();
      return;
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'done') sheet.close();
    if (act === 'cancel-form') sheet.close();
  });

  sheet.addEventListener('submit', (e) => {
    e.preventDefault();
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

  Promise.all([loadTrips(), loadItems(), loadOutfits()]).then(([loadedTrips, loadedItems, loadedOutfits]) => {
    if (gone) return;
    trips = loadedTrips;
    items = loadedItems;
    outfits = loadedOutfits;
    draw();
  });
  draw();

  return () => {
    gone = true;
    if (sheet.open) sheet.close();
    if (confirmDlg.open) confirmDlg.close();
  };
}
