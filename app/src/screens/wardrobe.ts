import { deleteItem, itemKind, loadItems, renameItem, saveItems, wearItem, type SavedItem } from '../wardrobe';
import {
  autoOutfitName,
  deleteOutfit,
  loadOutfits,
  renameOutfit,
  resolveOutfit,
  saveOutfits,
  wearOutfit,
  type Outfit,
} from '../outfits';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A swatch for an outfit slot: the item's colour, or an outlined empty square when the slot is empty. */
const slotSwatch = (item?: SavedItem) =>
  item ? `<span class="w-swatch" style="background:${item.colour}"></span>` : `<span class="w-swatch o-empty"></span>`;

export function renderWardrobe(el: HTMLElement): () => void {
  el.innerHTML = `
    <h1 class="page-title">Wardrobe</h1>
    <div class="card wardrobe">
      <h2 class="w-heading">Clothes</h2>
      <p class="help" id="w-empty" hidden>Nothing saved yet. On the Try on screen, choose a garment and colour, then tap Save.</p>
      <ul class="w-list" id="w-list"></ul>
    </div>
    <div class="card wardrobe">
      <h2 class="w-heading">Outfits</h2>
      <p class="help" id="o-empty" hidden>No outfits yet. On the Try on screen, put a look together and tap Save outfit.</p>
      <ul class="w-list" id="o-list"></ul>
    </div>`;
  const list = el.querySelector<HTMLElement>('#w-list')!;
  const empty = el.querySelector<HTMLElement>('#w-empty')!;
  const outfitList = el.querySelector<HTMLElement>('#o-list')!;
  const outfitEmpty = el.querySelector<HTMLElement>('#o-empty')!;
  let items: SavedItem[] = [];
  let renaming: string | null = null;
  let outfits: Outfit[] = [];
  let renamingOutfit: string | null = null;
  let gone = false;

  const draw = () => {
    empty.hidden = items.length > 0;
    list.innerHTML = items
      .map((i) =>
        renaming === i.id
          ? `<li class="w-item" data-id="${i.id}">
              <span class="w-swatch" style="background:${i.colour}"></span>
              <input class="w-name-input" aria-label="Name" value="${esc(i.name)}" maxlength="40">
              <button type="button" data-act="done">Done</button>
            </li>`
          : `<li class="w-item" data-id="${i.id}">
              <button type="button" class="w-wear" data-act="wear" aria-label="Wear ${esc(i.name)}">
                <span class="w-swatch" style="background:${i.colour}"></span>
                <span class="w-text"><span class="w-name">${esc(i.name)}</span><span class="w-sub">${itemKind(i)}</span></span>
              </button>
              <button type="button" data-act="rename" aria-label="Rename ${esc(i.name)}">Rename</button>
              <button type="button" data-act="delete" aria-label="Delete ${esc(i.name)}">Delete</button>
            </li>`,
      )
      .join('');
    list.querySelector<HTMLInputElement>('.w-name-input')?.focus();
    drawOutfits();
  };

  /** Outfits are drawn from the current items, so a slot whose item was deleted shows as empty. */
  const drawOutfits = () => {
    outfitEmpty.hidden = outfits.length > 0;
    outfitList.innerHTML = outfits
      .map((o) => {
        const look = resolveOutfit(o, items);
        if (renamingOutfit === o.id)
          return `<li class="w-item" data-oid="${o.id}">
              <span class="o-swatches">${slotSwatch(look.top)}${slotSwatch(look.bottom)}</span>
              <input class="w-name-input o-name-input" aria-label="Outfit name" value="${esc(o.name)}" maxlength="40">
              <button type="button" data-oact="done">Done</button>
            </li>`;
        const sub =`Top: ${look.top ? esc(look.top.name) : 'empty'}, Bottom: ${look.bottom ? esc(look.bottom.name) : 'empty'}`;
        return `<li class="w-item" data-oid="${o.id}">
              <button type="button" class="w-wear" data-oact="wear" aria-label="Wear outfit ${esc(o.name)}">
                <span class="o-swatches">${slotSwatch(look.top)}${slotSwatch(look.bottom)}</span>
                <span class="w-text"><span class="w-name">${esc(o.name)}</span><span class="w-sub">${sub}</span></span>
              </button>
              <button type="button" data-oact="rename" aria-label="Rename outfit ${esc(o.name)}">Rename</button>
              <button type="button" data-oact="delete" aria-label="Delete outfit ${esc(o.name)}">Delete</button>
            </li>`;
      })
      .join('');
    outfitList.querySelector<HTMLInputElement>('.o-name-input')?.focus();
  };

  const finishRename = (id: string, value: string) => {
    items = renameItem(items, id, value);
    renaming = null;
    void saveItems(items);
    draw();
  };

  const finishOutfitRename = (id: string, value: string) => {
    const o = outfits.find((x) => x.id === id);
    if (!o) return;
    outfits = renameOutfit(outfits, id, value, autoOutfitName(resolveOutfit(o, items)));
    renamingOutfit = null;
    void saveOutfits(outfits);
    drawOutfits();
  };

  list.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    const id = b?.closest<HTMLElement>('[data-id]')?.dataset.id;
    if (!b || !id) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    switch (b.dataset.act) {
      case 'wear':
        await wearItem(item);
        location.hash = '#/try-on';
        break;
      case 'rename':
        renaming = id;
        draw();
        break;
      case 'done':
        finishRename(id, list.querySelector<HTMLInputElement>('.w-name-input')!.value);
        break;
      case 'delete':
        items = deleteItem(items, id);
        void saveItems(items);
        draw();
        break;
    }
  });
  list.addEventListener('keydown', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('w-name-input') || renaming === null) return;
    if (e.key === 'Enter') finishRename(renaming, input.value);
    if (e.key === 'Escape') {
      renaming = null;
      draw();
    }
  });

  outfitList.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-oact]');
    const id = b?.closest<HTMLElement>('[data-oid]')?.dataset.oid;
    if (!b || !id) return;
    const outfit = outfits.find((o) => o.id === id);
    if (!outfit) return;
    switch (b.dataset.oact) {
      case 'wear':
        await wearOutfit(outfit, items);
        location.hash = '#/try-on';
        break;
      case 'rename':
        renamingOutfit = id;
        drawOutfits();
        break;
      case 'done':
        finishOutfitRename(id, outfitList.querySelector<HTMLInputElement>('.o-name-input')!.value);
        break;
      case 'delete':
        outfits = deleteOutfit(outfits, id);
        void saveOutfits(outfits);
        drawOutfits();
        break;
    }
  });
  outfitList.addEventListener('keydown', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('o-name-input') || renamingOutfit === null) return;
    if (e.key === 'Enter') finishOutfitRename(renamingOutfit, input.value);
    if (e.key === 'Escape') {
      renamingOutfit = null;
      drawOutfits();
    }
  });

  Promise.all([loadItems(), loadOutfits()]).then(([loadedItems, loadedOutfits]) => {
    if (gone) return;
    items = loadedItems;
    outfits = loadedOutfits;
    draw();
  });
  return () => {
    gone = true;
  };
}
