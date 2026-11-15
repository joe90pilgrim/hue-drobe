import { createViewer } from '../viewer';

interface Slot {
  name: string;
  options: string[]; // first option is the default
  garments: Record<string, string>; // option -> pack garment name
}
const SLOTS: Slot[] = [
  { name: 'Layer', options: ['Sweatshirt'], garments: {} }, // sweatshirt arrives with MVP-07
  { name: 'Top', options: ['T-shirt', 'None'], garments: { 'T-shirt': 'tee' } },
  { name: 'Bottom', options: ['Trousers', 'None'], garments: { Trousers: 'trousers' } },
];

const DB = 'huedrobe';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function loadOutfit(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const q = db.transaction('kv').objectStore('kv').get('outfit');
      q.onsuccess = () => resolve((q.result as Record<string, string>) ?? {});
      q.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}
async function saveOutfit(outfit: Record<string, string>): Promise<void> {
  try {
    const db = await openDb();
    db.transaction('kv', 'readwrite').objectStore('kv').put(outfit, 'outfit');
  } catch {
    /* storage unavailable: outfit just isn't remembered */
  }
}

export function renderDress(el: HTMLElement): () => void {
  el.innerHTML = `
    <header class="header"><h1>Dress</h1></header>
    <div class="dress">
      <div class="stage" id="stage">
        <span class="stage-hint"></span>
      </div>
      <div class="rail" aria-label="Outfit slots">
        ${SLOTS.map(
          (s) => `<div class="slot">
            <div class="slot-label">${s.name}</div>
            <div class="slot-item" data-slot="${s.name}">${s.options[0]}</div>
            <div class="slot-controls">
              <button aria-label="Previous ${s.name.toLowerCase()}" ${s.options.length < 2 ? 'disabled' : ''}>&lsaquo;</button>
              <span class="swatch"></span>
              <button aria-label="Next ${s.name.toLowerCase()}" ${s.options.length < 2 ? 'disabled' : ''}>&rsaquo;</button>
            </div>
          </div>`,
        ).join('')}
      </div>
    </div>`;

  const stage = el.querySelector<HTMLElement>('#stage')!;
  const hint = stage.querySelector<HTMLElement>('.stage-hint')!;
  const viewer = createViewer(stage, (msg) => {
    hint.textContent = msg ?? '';
    hint.hidden = msg === null;
  });

  const outfit: Record<string, string> = Object.fromEntries(SLOTS.map((s) => [s.name, s.options[0]]));
  const apply = (slot: Slot) => {
    el.querySelector(`[data-slot="${slot.name}"]`)!.textContent = outfit[slot.name];
    for (const [opt, g] of Object.entries(slot.garments)) viewer.setGarment(g, outfit[slot.name] === opt);
  };
  SLOTS.forEach(apply);
  let gone = false;
  loadOutfit().then((saved) => {
    if (gone) return;
    for (const s of SLOTS) if (saved[s.name] && s.options.includes(saved[s.name])) outfit[s.name] = saved[s.name];
    SLOTS.forEach(apply);
  });
  for (const s of SLOTS) {
    const step = (d: number) => () => {
      const i = s.options.indexOf(outfit[s.name]);
      outfit[s.name] = s.options[(i + d + s.options.length) % s.options.length];
      apply(s);
      void saveOutfit({ ...outfit });
    };
    el.querySelector(`[aria-label="Previous ${s.name.toLowerCase()}"]`)!.addEventListener('click', step(-1));
    el.querySelector(`[aria-label="Next ${s.name.toLowerCase()}"]`)!.addEventListener('click', step(1));
  }
  return () => {
    gone = true;
    viewer.dispose();
  };
}
