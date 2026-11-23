import { GARMENTS, deleteItem, itemKind, loadItems, renameItem, saveItems, wearItem, type SavedItem } from '../wardrobe';
import {
  autoOutfitName,
  deleteOutfit,
  loadOutfits,
  renameOutfit,
  resolveOutfit,
  saveOutfits,
  wearOutfit,
  type Outfit,
  type OutfitLook,
} from '../outfits';
import { createPhotoAdd } from './wardrobe-photo';
import { flatLaySvg, silhouetteSvg, type FlatPiece } from '../silhouettes';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The filter chips and the closet's bays, in closet order (V3-16). A garment's group is its slot, so a new garment type sorts itself
 * into Tops or Bottoms. `storage` is how the group is kept: things that hang go on a `rail`; hats and shoes (V5) will sit on a `shelf`.
 */
const GROUPS: readonly { slot: 'Top' | 'Dress' | 'Bottom' | 'Legs' | 'Shoes'; label: string; storage: 'rail' | 'shelf' }[] = [
  { slot: 'Top', label: 'Tops', storage: 'rail' },
  { slot: 'Dress', label: 'Dresses', storage: 'rail' },
  { slot: 'Bottom', label: 'Bottoms', storage: 'rail' },
  { slot: 'Legs', label: 'Tights', storage: 'rail' },
  { slot: 'Shoes', label: 'Shoes', storage: 'shelf' },
];
type Filter = 'all' | (typeof GROUPS)[number]['slot'];

const silhouetteOf = (i: SavedItem, mode: 'hang' | 'shelf' | 'flat') =>
  silhouetteSvg({ garment: i.garment, neckline: i.neckline, sheer: i.sheer, colour: i.colour, mode });

type Selection = { kind: 'item' | 'outfit'; id: string } | null;

/**
 * The flat-lay of an outfit (V3-17): the silhouettes of its pieces, stacked head to toe. A piece the outfit has but that was deleted
 * is a dashed outline in its place; a piece the outfit never had is left out. An outfit with nothing in it shows a dashed top and bottom.
 */
const flatLay = (o: Outfit, look: OutfitLook) => {
  const piece = (slot: FlatPiece['slot'], id: string | undefined, item: SavedItem | undefined): FlatPiece[] =>
    id ? [{ slot, item: item && { garment: item.garment, neckline: item.neckline, sheer: item.sheer, colour: item.colour } }] : [];
  const pieces = [
    ...(o.dress ? piece('dress', o.dress, look.dress) : [...piece('top', o.top, look.top), ...piece('bottom', o.bottom, look.bottom)]),
    ...piece('legs', o.legs, look.legs),
    ...piece('shoes', o.shoes, look.shoes),
  ];
  return flatLaySvg(pieces.length ? pieces : [{ slot: 'top' }, { slot: 'bottom' }]);
};

export function renderWardrobe(el: HTMLElement): () => void {
  el.innerHTML = `
    <div class="w-head"><h1 class="page-title">Wardrobe</h1><div id="w-photo-slot"></div></div>
    <div class="seg w-tabs" role="tablist" aria-label="Wardrobe">
      <button type="button" role="tab" id="tab-clothes" aria-controls="w-view" aria-selected="true"></button>
      <button type="button" role="tab" id="tab-outfits" aria-controls="w-view" aria-selected="false"></button>
    </div>
    <div class="w-chips" role="group" aria-label="Show" id="w-chips"></div>
    <div class="w-layout" id="w-view" role="tabpanel">
      <div class="w-body">
        <p class="w-tip" id="w-tip" hidden>Select an outfit to try it on, rename it or delete it. The panel opens on the right, as it does for clothes.</p>
        <p class="help w-empty" id="w-empty" hidden></p>
        <div class="w-grid" id="w-grid"></div>
      </div>
      <aside class="w-panel" id="w-panel" hidden></aside>
    </div>
    <dialog class="sheet w-sheet" id="w-sheet" aria-labelledby="w-title"></dialog>
    <dialog class="sheet w-confirm" id="w-confirm" aria-labelledby="w-confirm-title"></dialog>`;

  const $ = <T extends HTMLElement>(id: string) => el.querySelector<T>('#' + id)!;
  const tabClothes = $('tab-clothes');
  const tabOutfits = $('tab-outfits');
  const chips = $('w-chips');
  const grid = $('w-grid');
  const empty = $('w-empty');
  const tip = $('w-tip');
  const panel = $('w-panel');
  const sheet = $<HTMLDialogElement>('w-sheet');
  const confirmDlg = $<HTMLDialogElement>('w-confirm');
  const wide = window.matchMedia('(min-width: 900px)');
  // V4-01: add a garment from a photo. The photo is sent for matching and never stored.
  const photoAdd = createPhotoAdd((list, item) => {
    items = list;
    tab = 'clothes';
    filter = 'all';
    select({ kind: 'item', id: item.id });
  });
  $('w-photo-slot').replaceWith(photoAdd.buttons);
  el.append(photoAdd.sheet);

  let items: SavedItem[] = [];
  let outfits: Outfit[] = [];
  let tab: 'clothes' | 'outfits' = 'clothes';
  let filter: Filter = 'all';
  let sel: Selection = null;
  let renaming = false;
  let gone = false;

  const slotOf = (i: SavedItem) => GARMENTS[i.garment].slot;
  const selectedItem = () => (sel?.kind === 'item' ? items.find((i) => i.id === sel!.id) : undefined);
  const selectedOutfit = () => (sel?.kind === 'outfit' ? outfits.find((o) => o.id === sel!.id) : undefined);
  const nameOf = () => selectedItem()?.name ?? selectedOutfit()?.name ?? '';

  /** The pieces an outfit is made of, as words: "Navy tee, Brown trousers". A deleted piece reads "top deleted". */
  const piecesOf = (o: Outfit) => {
    const look = resolveOutfit(o, items);
    const parts: string[] = [];
    if (o.dress) parts.push(look.dress ? look.dress.name : 'dress deleted');
    if (o.top) parts.push(look.top ? look.top.name : 'top deleted');
    if (o.bottom) parts.push(look.bottom ? look.bottom.name : 'bottom deleted');
    if (o.legs) parts.push(look.legs ? look.legs.name : 'tights deleted');
    if (o.shoes) parts.push(look.shoes ? look.shoes.name : 'shoes deleted');
    return parts.map(esc).join(', ');
  };

  /**
   * The second line of an outfit card. While the name is still the automatic list of pieces it would repeat the name, so it
   * says how many items there are; with a custom name or a deleted piece it keeps the list.
   */
  const subOf = (o: Outfit) => {
    const look = resolveOutfit(o, items);
    const count = [o.dress, o.top, o.bottom, o.legs, o.shoes].filter(Boolean).length;
    const gone = (o.dress && !look.dress) || (o.top && !look.top) || (o.bottom && !look.bottom) || (o.legs && !look.legs) || (o.shoes && !look.shoes);
    return !gone && o.name === autoOutfitName(look) ? `${count} item${count === 1 ? '' : 's'}` : piecesOf(o);
  };

  // --- The grid -------------------------------------------------------------------------------------------------

  const drawChips = () => {
    chips.hidden = tab !== 'clothes';
    photoAdd.setVisible(tab === 'clothes');
    const count = (f: Filter) => (f === 'all' ? items.length : items.filter((i) => slotOf(i) === f).length);
    const all: { f: Filter; label: string }[] = [{ f: 'all', label: 'All' }, ...GROUPS.map((g) => ({ f: g.slot as Filter, label: g.label }))];
    chips.innerHTML = all
      .map(({ f, label }) => `<button type="button" class="chip-btn" data-filter="${f}" aria-pressed="${filter === f}">${label}${f === 'all' ? '' : ` · ${count(f)}`}</button>`)
      .join('');
  };

  const drawGrid = () => {
    tabClothes.textContent = `Clothes · ${items.length}`;
    tabOutfits.textContent = `Outfits · ${outfits.length}`;
    tabClothes.setAttribute('aria-selected', String(tab === 'clothes'));
    tabOutfits.setAttribute('aria-selected', String(tab === 'outfits'));
    tabClothes.tabIndex = tab === 'clothes' ? 0 : -1;
    tabOutfits.tabIndex = tab === 'outfits' ? 0 : -1;
    drawChips();
    tip.hidden = tab !== 'outfits';
    const shown = wide.matches;
    const on = (kind: 'item' | 'outfit', id: string) => shown && sel?.kind === kind && sel.id === id;
    if (tab === 'clothes') {
      const list = filter === 'all' ? items : items.filter((i) => slotOf(i) === filter);
      empty.hidden = list.length > 0;
      empty.textContent =
        items.length === 0 ? 'Nothing here yet. On Try on, change a piece and tap Add to wardrobe.' : `No ${GROUPS.find((g) => g.slot === filter)?.label.toLowerCase() ?? 'clothes'} yet.`;
      grid.classList.add('closet');
      const card = (i: SavedItem, mode: 'hang' | 'shelf') => `<button type="button" class="w-card${on('item', i.id) ? ' on' : ''}" data-kind="item" data-id="${i.id}" aria-pressed="${on('item', i.id)}">
            <span class="c-art">${silhouetteOf(i, mode)}</span>
            <span class="w-card-text"><span class="w-name">${esc(i.name)}</span><span class="w-sub">${esc(itemKind(i))}</span></span>
          </button>`;
      // One bay per group that has items. "All" is one rail per group; a chosen chip shows only that group, wrapped into rows.
      grid.innerHTML = GROUPS.map((g) => {
        const mine = list.filter((i) => slotOf(i) === g.slot);
        if (!mine.length) return '';
        const mode = g.storage === 'shelf' ? 'shelf' : 'hang';
        return `<section class="c-bay c-${g.storage}" aria-label="${g.label}">
          <h2 class="c-bay-h">${g.label}<span> · ${mine.length}</span></h2>
          <div class="c-row${filter === 'all' ? ' slide' : ''}">${mine.map((i) => card(i, mode)).join('')}</div>
        </section>`;
      }).join('');
    } else {
      grid.classList.remove('closet');
      empty.hidden = outfits.length > 0;
      empty.textContent = 'No outfits yet. On Try on, put a look together and tap Save outfit.';
      grid.innerHTML = outfits
        .map((o) => {
          const look = resolveOutfit(o, items);
          return `<button type="button" class="w-card${on('outfit', o.id) ? ' on' : ''}" data-kind="outfit" data-id="${o.id}" aria-pressed="${on('outfit', o.id)}">
            <span class="o-flat">${flatLay(o, look)}</span>
            <span class="w-card-text"><span class="w-name">${esc(o.name)}</span><span class="w-sub">${subOf(o)}</span></span>
          </button>`;
        })
        .join('');
    }
  };

  // --- The sheet (phone) or panel (laptop) for the chosen card -------------------------------------------------------

  const detailHtml = () => {
    const item = selectedItem();
    const outfit = selectedOutfit();
    if (!item && !outfit) return '';
    const look = outfit ? resolveOutfit(outfit, items) : undefined;
    const art = item
      ? `<span class="d-swatch d-sil">${silhouetteOf(item, 'hang')}</span>`
      : `<span class="d-swatch o-flat">${flatLay(outfit!, look!)}</span>`;
    const sub = item ? esc(itemKind(item)) : subOf(outfit!);
    const head = renaming
      ? `<div class="d-text"><label class="field-label" for="w-rename">Name</label>
           <input id="w-rename" class="w-name-input" value="${esc(nameOf())}" maxlength="40" autocomplete="off"></div>`
      : `<div class="d-text"><h2 id="w-title">${esc(nameOf())}</h2><span class="d-sub">${sub}</span></div>`;
    const actions = renaming
      ? `<div class="d-pair"><button type="button" class="secondary" data-act="cancel-rename">Cancel</button><button type="button" class="primary" data-act="save-rename">Done</button></div>`
      : `<button type="button" class="primary d-try" data-act="try">Try it on</button>
         <div class="d-pair"><button type="button" class="secondary" data-act="rename">Rename</button><button type="button" class="secondary danger" data-act="delete">Delete</button></div>`;
    const hint = item && !renaming ? '<p class="d-hint">Delete asks you to confirm first. Outfits that use this piece will show a gap where it was.</p>' : '';
    return `<div class="grab" aria-hidden="true"></div><div class="d-head">${art}${head}</div>${actions}${hint}`;
  };

  const drawDetail = () => {
    const html = detailHtml();
    const useSheet = !wide.matches;
    panel.hidden = useSheet || !html;
    panel.setAttribute('aria-label', nameOf());
    if (useSheet) {
      sheet.innerHTML = html;
      if (html && !sheet.open) sheet.showModal();
      if (!html && sheet.open) sheet.close();
      panel.innerHTML = '';
    } else {
      if (sheet.open) sheet.close();
      panel.innerHTML = html;
    }
    const root = useSheet ? sheet : panel;
    if (renaming) {
      const input = root.querySelector<HTMLInputElement>('#w-rename');
      input?.focus();
      input?.select();
    }
  };

  const select = (next: Selection) => {
    sel = next;
    renaming = false;
    drawGrid();
    drawDetail();
  };

  const finishRename = (value: string) => {
    if (sel?.kind === 'item') {
      items = renameItem(items, sel.id, value);
      void saveItems(items);
    } else if (sel?.kind === 'outfit') {
      const o = selectedOutfit();
      if (o) {
        outfits = renameOutfit(outfits, o.id, value, autoOutfitName(resolveOutfit(o, items)));
        void saveOutfits(outfits);
      }
    }
    renaming = false;
    drawGrid();
    drawDetail();
    (wide.matches ? panel : sheet).querySelector<HTMLElement>('[data-act="rename"]')?.focus();
  };

  const askDelete = () => {
    const isItem = sel?.kind === 'item';
    confirmDlg.innerHTML = `
      <h2 id="w-confirm-title">Delete ${esc(nameOf())}?</h2>
      <p class="help">${isItem ? 'Outfits that use it will show a gap where it was.' : 'The clothes in it stay in your wardrobe.'}</p>
      <div class="sheet-actions">
        <button type="button" class="primary" data-act="confirm-delete">Delete</button>
        <button type="button" class="secondary" data-act="cancel-delete">Cancel</button>
      </div>`;
    confirmDlg.showModal();
  };

  const doDelete = () => {
    if (sel?.kind === 'item') {
      items = deleteItem(items, sel.id);
      void saveItems(items);
    } else if (sel?.kind === 'outfit') {
      outfits = deleteOutfit(outfits, sel.id);
      void saveOutfits(outfits);
    }
    confirmDlg.close();
    select(null);
  };

  const tryOn = async () => {
    const item = selectedItem();
    const outfit = selectedOutfit();
    if (item) await wearItem(item);
    else if (outfit) await wearOutfit(outfit, items);
    else return;
    location.hash = '#/try-on';
  };

  const onAction = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'try':
        void tryOn();
        break;
      case 'rename':
        renaming = true;
        drawDetail();
        break;
      case 'save-rename':
        finishRename((b.closest('.w-sheet, .w-panel')!.querySelector<HTMLInputElement>('#w-rename'))!.value);
        break;
      case 'cancel-rename':
        renaming = false;
        drawDetail();
        break;
      case 'delete':
        askDelete();
        break;
    }
  };
  const onRenameKey = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (input.id !== 'w-rename') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      finishRename(input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault(); // cancel the rename, not the whole sheet
      renaming = false;
      drawDetail();
      (wide.matches ? panel : sheet).querySelector<HTMLElement>('[data-act="rename"]')?.focus();
    }
  };
  panel.addEventListener('click', onAction);
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close(); // a tap on the scrim
    else onAction(e);
  });
  sheet.addEventListener('close', () => {
    if (confirmDlg.open) return;
    if (sel && !wide.matches) {
      sel = null;
      renaming = false;
      drawGrid();
    }
  });
  panel.addEventListener('keydown', onRenameKey);
  sheet.addEventListener('keydown', onRenameKey);
  confirmDlg.addEventListener('click', (e) => {
    if (e.target === confirmDlg) return confirmDlg.close();
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'confirm-delete') doDelete();
    if (act === 'cancel-delete') confirmDlg.close();
  });

  // --- Tabs, chips and cards ------------------------------------------------------------------------------------------

  const setTab = (t: 'clothes' | 'outfits') => {
    tab = t;
    select(null);
  };
  tabClothes.addEventListener('click', () => setTab('clothes'));
  tabOutfits.addEventListener('click', () => setTab('outfits'));
  el.querySelector('.w-tabs')!.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    setTab(tab === 'clothes' ? 'outfits' : 'clothes');
    (tab === 'clothes' ? tabClothes : tabOutfits).focus();
  });
  chips.addEventListener('click', (e) => {
    const f = (e.target as HTMLElement).closest<HTMLElement>('[data-filter]')?.dataset.filter as Filter | undefined;
    if (!f) return;
    filter = f;
    select(null);
    chips.querySelector<HTMLElement>(`[data-filter="${f}"]`)?.focus();
  });
  grid.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.w-card');
    if (!card) return;
    const next = { kind: card.dataset.kind as 'item' | 'outfit', id: card.dataset.id! };
    // On a laptop, tapping the chosen card again closes the panel.
    select(wide.matches && sel?.kind === next.kind && sel.id === next.id ? null : next);
    if (!wide.matches) return;
    grid.querySelector<HTMLElement>(`.w-card[data-id="${next.id}"]`)?.focus();
  });
  // Crossing the laptop/phone breakpoint swaps between the panel and the sheet.
  const onResize = () => select(null);
  wide.addEventListener('change', onResize);

  Promise.all([loadItems(), loadOutfits()]).then(([loadedItems, loadedOutfits]) => {
    if (gone) return;
    items = loadedItems;
    outfits = loadedOutfits;
    drawGrid();
  });
  drawGrid();
  return () => {
    gone = true;
    photoAdd.dispose();
    wide.removeEventListener('change', onResize);
    if (sheet.open) sheet.close();
    if (confirmDlg.open) confirmDlg.close();
  };
}
