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
            <div class="fav-row" role="group" aria-label="${s.name} favourite colours" data-favs="${s.name}"></div>
            <div class="slot-controls">
              <button aria-label="Previous ${s.name.toLowerCase()}" ${s.options.length < 2 ? 'disabled' : ''}>&lsaquo;</button>
              <input type="color" class="swatch" aria-label="${s.name} colour" value="${DEFAULT_COLOUR}">
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
  let colours: Record<string, string> = {}; // pack garment name -> sRGB hex, only for garments Joe has picked
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
    for (const [opt, g] of Object.entries(slot.garments)) viewer.setGarment(g, outfit[slot.name] === opt);
    const g = garmentOf(slot);
    const picker = pickerOf(slot);
    picker.disabled = !g; // "None" and garments not yet in the pack have no colour to pick
    picker.value = (g && colours[g]) || DEFAULT_COLOUR;
    renderFavs();
  };
  SLOTS.forEach(apply);
  let gone = false;
  Promise.all([
    kvGet<Record<string, string>>('outfit', {}),
    kvGet<Record<string, string>>('colours', {}),
    loadFavourites(),
  ]).then(([saved, savedColours, favs]) => {
    if (gone) return;
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

    const picker = pickerOf(s);
    picker.addEventListener('input', () => {
      const g = garmentOf(s);
      if (!g) return;
      colours[g] = picker.value;
      viewer.setColour(g, picker.value); // applies straight away
      renderFavs();
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
  return () => {
    gone = true;
    viewer.dispose();
  };
}
