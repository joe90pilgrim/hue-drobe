import { createViewer } from '../viewer';
import { kvGet, kvPut } from '../store';
import {
  SHOWN_FIRST,
  addFavourite,
  hasFavourite,
  loadFavourites,
  removeFavourite,
  saveFavourites,
  type Favourite,
} from '../favourites';
import {
  DEFAULT_NECKLINE,
  GARMENTS,
  NECKLINES,
  NECKLINE_KEY,
  ensureItem,
  hasNecklines,
  isNeckline,
  loadItems,
  meshName,
  meshesOf,
  saveItems,
  type GarmentId,
  type Neckline,
} from '../wardrobe';
import { loadOutfits, newOutfit, saveOutfits, type OutfitLook } from '../outfits';

interface Slot {
  name: string;
  options: string[]; // first option is the default
  garments: Record<string, string>; // option -> pack garment name
}
const SLOTS: Slot[] = [
  // The sweatshirt is an alternative top (MVP-05 scope), built over the trousers like the tee, so it shares the Top slot.
  { name: 'Top', options: ['T-shirt', 'Sweatshirt', 'None'], garments: { 'T-shirt': 'tee', Sweatshirt: 'sweatshirt' } },
  { name: 'Bottom', options: ['Trousers', 'None'], garments: { Trousers: 'trousers' } },
];

/** The garments' base colour (`colour_srgb` in pack/fit_config.json), shown until Joe picks one. */
const DEFAULT_COLOUR = '#d6d6d6';

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
            ${
              Object.values(s.garments).some((g) => hasNecklines(g as GarmentId))
                ? `<div class="neckline-row" role="group" aria-label="Neckline" data-necklines hidden>${(Object.keys(NECKLINES) as Neckline[])
                    .map((n) => `<button type="button" class="neckline-btn" data-neckline="${n}" aria-pressed="false">${NECKLINES[n].label}</button>`)
                    .join('')}</div>`
                : ''
            }
            <div class="fav-row" role="group" aria-label="${s.name} favourite colours" data-favs="${s.name}"></div>
            <div class="slot-controls">
              <button aria-label="Previous ${s.name.toLowerCase()}" ${s.options.length < 2 ? 'disabled' : ''}>&lsaquo;</button>
              <input type="color" class="swatch" aria-label="${s.name} colour" value="${DEFAULT_COLOUR}">
              <button aria-label="Next ${s.name.toLowerCase()}" ${s.options.length < 2 ? 'disabled' : ''}>&rsaquo;</button>
            </div>
            <button type="button" class="slot-save" data-save="${s.name}">Save</button>
          </div>`,
        ).join('')}
        <button type="button" class="slot-save outfit-save" id="save-outfit">Save outfit</button>
      </div>
    </div>`;

  const stage = el.querySelector<HTMLElement>('#stage')!;
  const hint = stage.querySelector<HTMLElement>('.stage-hint')!;
  const outfitBtn = el.querySelector<HTMLButtonElement>('#save-outfit')!;
  const viewer = createViewer(stage, (msg) => {
    hint.textContent = msg ?? '';
    hint.hidden = msg === null;
  });

  const outfit: Record<string, string> = Object.fromEntries(SLOTS.map((s) => [s.name, s.options[0]]));
  let colours: Record<string, string> = {}; // pack garment name -> sRGB hex, only for garments Joe has picked
  let neckline: Neckline = DEFAULT_NECKLINE; // the tee's neckline (V1.1-04); the colour belongs to the tee, whichever neckline it has
  let favourites: Favourite[] = []; // shared by every slot
  let editing = false; // while true, tapping a favourite removes it instead of applying it
  let showAll = false; // while false, only the first SHOWN_FIRST favourites are drawn
  const garmentOf = (slot: Slot) => slot.garments[outfit[slot.name]];
  const pickerOf = (slot: Slot) => el.querySelector<HTMLInputElement>(`[aria-label="${slot.name} colour"]`)!;
  const favRowOf = (slot: Slot) => el.querySelector<HTMLElement>(`[data-favs="${slot.name}"]`)!;

  /** Draws each slot's favourites above its free picker. The star saves or removes the colour the picker shows. */
  const renderFavs = () => {
    // Edit mode has a Done button only while there are favourites, so it must not outlive the last one.
    if (!favourites.length) editing = false;
    for (const s of SLOTS) {
      const g = garmentOf(s);
      const row = favRowOf(s);
      const current = pickerOf(s).value.toLowerCase();
      const isFav = hasFavourite(favourites, current);
      const shown = showAll ? favourites : favourites.slice(0, SHOWN_FIRST);
      const more =
        favourites.length > SHOWN_FIRST
          ? `<button type="button" class="fav-text" data-more>${showAll ? 'Fewer' : `More (${favourites.length - SHOWN_FIRST})`}</button>`
          : '';
      const edit = favourites.length ? `<button type="button" class="fav-text" data-edit>${editing ? 'Done' : 'Edit'}</button>` : '';
      row.classList.toggle('editing', editing);
      row.innerHTML = `
        <button type="button" class="fav-tile fav-star" data-star aria-pressed="${isFav}" aria-label="Save this colour to favourites" title="${isFav ? 'Remove this colour from favourites' : 'Save this colour to favourites'}" ${!g || editing ? 'disabled' : ''}>${isFav ? '&#9733;' : '&#9734;'}</button>
        ${shown
          .map(
            (f) => `<button type="button" class="fav-tile${f.hex === current ? ' on' : ''}" data-hex="${f.hex}" aria-label="${f.hex}${f.fromPalette ? ', from your palette' : ''}" title="${f.hex}${f.fromPalette ? ' (from your palette)' : ''}" style="background:${f.hex}" ${!g ? 'disabled' : ''}>${f.fromPalette ? '<span class="palette-dot"></span>' : ''}</button>`,
          )
          .join('')}
        ${more}${edit}`;
    }
  };

  const apply = (slot: Slot) => {
    el.querySelector(`[data-slot="${slot.name}"]`)!.textContent = outfit[slot.name];
    // Show exactly one mesh: the chosen garment, with the chosen neckline if it has them.
    for (const [opt, id] of Object.entries(slot.garments)) {
      const shown = meshName(id as GarmentId, neckline);
      for (const mesh of meshesOf(id as GarmentId)) viewer.setGarment(mesh, outfit[slot.name] === opt && mesh === shown);
    }
    const g = garmentOf(slot);
    const necks = el.querySelector<HTMLElement>(`[data-slot="${slot.name}"] ~ [data-necklines]`);
    if (necks) {
      necks.hidden = !g || !hasNecklines(g as GarmentId);
      for (const b of necks.querySelectorAll<HTMLButtonElement>('[data-neckline]')) b.setAttribute('aria-pressed', String(b.dataset.neckline === neckline));
    }
    const picker = pickerOf(slot);
    picker.disabled = !g;
    el.querySelector<HTMLButtonElement>(`[data-save="${slot.name}"]`)!.disabled = !g; // "None" and garments not yet in the pack have no colour to pick
    picker.value = (g && colours[g]) || DEFAULT_COLOUR;
    outfitBtn.disabled = !SLOTS.some((s) => garmentOf(s)); // an outfit needs at least one garment on the avatar
    renderFavs();
  };
  SLOTS.forEach(apply);
  let gone = false;
  Promise.all([
    kvGet<Record<string, string>>('outfit', {}),
    kvGet<Record<string, string>>('colours', {}),
    loadFavourites(),
    kvGet<unknown>(NECKLINE_KEY, DEFAULT_NECKLINE),
  ]).then(([saved, savedColours, favs, savedNeckline]) => {
    if (gone) return;
    if (isNeckline(savedNeckline)) neckline = savedNeckline;
    for (const s of SLOTS) if (saved[s.name] && s.options.includes(saved[s.name])) outfit[s.name] = saved[s.name];
    for (const [g, hex] of Object.entries(savedColours)) {
      if (/^#[0-9a-f]{6}$/i.test(hex)) {
        colours[g] = hex;
        viewer.setColour(g, hex);
      }
    }
    favourites = favs;
    SLOTS.forEach(apply);
  });
  for (const s of SLOTS) {
    const step = (d: number) => () => {
      const i = s.options.indexOf(outfit[s.name]);
      outfit[s.name] = s.options[(i + d + s.options.length) % s.options.length];
      apply(s);
      void kvPut('outfit', { ...outfit });
    };
    el.querySelector(`[aria-label="Previous ${s.name.toLowerCase()}"]`)!.addEventListener('click', step(-1));
    el.querySelector(`[aria-label="Next ${s.name.toLowerCase()}"]`)!.addEventListener('click', step(1));

    el.querySelector(`[data-slot="${s.name}"] ~ [data-necklines]`)?.addEventListener('click', (e) => {
      const n = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-neckline]')?.dataset.neckline;
      if (!isNeckline(n) || n === neckline) return;
      neckline = n;
      apply(s);
      void kvPut(NECKLINE_KEY, neckline);
    });

    const picker = pickerOf(s);
    picker.addEventListener('input', () => {
      const g = garmentOf(s);
      if (!g) return;
      colours[g] = picker.value;
      viewer.setColour(g, picker.value); // applies straight away
      renderFavs();
    });
    el.querySelector<HTMLButtonElement>(`[data-save="${s.name}"]`)!.addEventListener('click', async (e) => {
      const g = garmentOf(s) as GarmentId | undefined;
      if (!g || !(g in GARMENTS)) return;
      const btn = e.currentTarget as HTMLButtonElement;
      const items = await loadItems();
      const r = ensureItem(items, g, picker.value, Date.now(), neckline); // one item per garment, colour and (for a tee) neckline
      if (r.list !== items) await saveItems(r.list);
      btn.textContent = 'Saved';
      setTimeout(() => (btn.textContent = 'Save'), 1500);
    });
    picker.addEventListener('change', () => void kvPut('colours', { ...colours }));

    favRowOf(s).addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      if (b.hasAttribute('data-more')) {
        showAll = !showAll;
        renderFavs();
        return;
      }
      if (b.hasAttribute('data-edit')) {
        editing = !editing;
        renderFavs();
        return;
      }
      if (b.hasAttribute('data-star')) {
        const hex = picker.value.toLowerCase();
        favourites = hasFavourite(favourites, hex) ? removeFavourite(favourites, hex) : addFavourite(favourites, hex, false);
        void saveFavourites(favourites);
        renderFavs();
        return;
      }
      const hex = b.dataset.hex;
      if (!hex) return;
      if (editing) {
        favourites = removeFavourite(favourites, hex);
        void saveFavourites(favourites);
        renderFavs();
        return;
      }
      const g = garmentOf(s);
      if (!g) return;
      colours[g] = hex;
      viewer.setColour(g, hex);
      picker.value = hex;
      void kvPut('colours', { ...colours });
      renderFavs();
    });
  }
  // Saves the look as shown: each garment on the avatar in the colour the picker shows, added to the library if new.
  outfitBtn.addEventListener('click', async () => {
    let items = await loadItems();
    const look: OutfitLook = {};
    for (const s of SLOTS) {
      const g = garmentOf(s) as GarmentId | undefined;
      if (!g) continue;
      const r = ensureItem(items, g, pickerOf(s).value, Date.now(), neckline);
      items = r.list;
      if (s.name === 'Top') look.top = r.item;
      else look.bottom = r.item;
    }
    if (!look.top && !look.bottom) return;
    await saveItems(items);
    await saveOutfits([...(await loadOutfits()), newOutfit(look)]);
    outfitBtn.textContent = 'Outfit saved';
    setTimeout(() => (outfitBtn.textContent = 'Save outfit'), 1500);
  });
  return () => {
    gone = true;
    viewer.dispose();
  };
}
