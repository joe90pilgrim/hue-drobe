import { deleteItem, loadItems, renameItem, saveItems, wearItem, GARMENTS, type SavedItem } from '../wardrobe';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderWardrobe(el: HTMLElement): () => void {
  el.innerHTML = `
    <header class="header"><h1>Wardrobe</h1></header>
    <div class="card wardrobe">
      <p class="help" id="w-empty" hidden>Nothing saved yet. On the Dress screen, choose a garment and colour, then tap Save.</p>
      <ul class="w-list" id="w-list"></ul>
    </div>`;
  const list = el.querySelector<HTMLElement>('#w-list')!;
  const empty = el.querySelector<HTMLElement>('#w-empty')!;
  let items: SavedItem[] = [];
  let renaming: string | null = null;
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
                <span class="w-text"><span class="w-name">${esc(i.name)}</span><span class="w-sub">${GARMENTS[i.garment].option}</span></span>
              </button>
              <button type="button" data-act="rename" aria-label="Rename ${esc(i.name)}">Rename</button>
              <button type="button" data-act="delete" aria-label="Delete ${esc(i.name)}">Delete</button>
            </li>`,
      )
      .join('');
    list.querySelector<HTMLInputElement>('.w-name-input')?.focus();
  };

  const finishRename = (id: string, value: string) => {
    items = renameItem(items, id, value);
    renaming = null;
    void saveItems(items);
    draw();
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
        location.hash = '#/dress';
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

  loadItems().then((loaded) => {
    if (gone) return;
    items = loaded;
    draw();
  });
  return () => {
    gone = true;
  };
}
