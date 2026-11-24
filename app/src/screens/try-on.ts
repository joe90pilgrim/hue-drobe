import { createViewer, DEFAULT_HAIR_COLOUR } from '../viewer';
import { kvGet, kvPut } from '../store';
import { person } from '../person';
import {
  addFavourite,
  hasFavourite,
  loadFavourites,
  removeFavourite,
  saveFavourites,
  type Favourite,
} from '../favourites';
import {
  DEFAULT_NECKLINE,
  DRESS_OPTION,
  DRESS_SLOT,
  GARMENTS,
  HAT_MESHES,
  HAT_SLOT,
  OUTER_MESHES,
  OUTER_OPTION,
  OUTER_SLOT,
  SHOES_AS_MADE,
  SHOES_SLOT,
  SHOE_MESHES,
  bodyWithShoe,
  MID_TOPS,
  NECKLINES,
  NECKLINE_KEY,
  isUntuckedTop,
  SHEER_KEY,
  TIGHTS_BLOCKED_BY,
  TUCKS_INTO,
  UNDER_OPTION,
  UNDER_SLOT,
  ensureItem,
  VARIANT_TYPES,
  hasVariants,
  optionFor,
  typeVariantOf,
  layeredOk,
  necklinesUnder,
  overMeshName,
  hasNecklines,
  hasSheer,
  keepLayers,
  isNeckline,
  isTucked,
  loadItems,
  meshName,
  meshesOf,
  saveItems,
  type GarmentId,
  type Neckline,
  colourName,
} from '../wardrobe';
import { createColourChooser } from '../colour-chooser';
import { loadOutfits, newOutfit, saveOutfits, type OutfitLook } from '../outfits';

interface Slot {
  name: string;
  options: string[]; // first option is the default
  garments: Record<string, string>; // option -> pack garment name
}
/** V5-04: the person's hair. Always on the avatar when their pack has it; the row only sets its colour, which is saved under `hair` in the same `colours` map as the garments. */
const HAIR_SLOT = 'Hair';
/** The slots whose control is a small pill on the stage, not a row in the list (hair, V5-04: it has no garment to choose). */
const PILL_SLOTS: readonly string[] = [HAIR_SLOT];
const isPill = (name: string) => PILL_SLOTS.includes(name);

const SLOTS: Slot[] = [
  // V5-02: a hat (Joe, 23 Nov 2026: a cap and a beanie, for both people). Plain colour. Worn over the hair: the viewer then draws the hair with the faces
  // the hat covers removed. The row is hidden when the pack has no hat.
  { name: HAT_SLOT, options: ['None', GARMENTS.cap.option, GARMENTS.beanie.option], garments: { [GARMENTS.cap.option]: 'cap', [GARMENTS.beanie.option]: 'beanie' } },
  // V3.1-06: the blazer (Joe, 24 Nov 2026: worn with anything). A pack has only its own sex's blazer, so `garments` here is a placeholder: `garmentOf` and `apply` pick
  // whichever blazer mesh the pack loaded. While it is worn the viewer draws the tee and trousers as their `_under_blazer_*` files. Hidden when the pack has no blazer.
  { name: OUTER_SLOT, options: ['None', OUTER_OPTION], garments: { [OUTER_OPTION]: 'blazer_male' } },
  // The shift dress (V3-02) is in a woman's pack only; the row is hidden when the pack lacks it. It takes the place of the top and the bottom.
  { name: DRESS_SLOT, options: ['None', DRESS_OPTION], garments: { [DRESS_OPTION]: 'dress' } },
  // The sweatshirt is an alternative top (MVP-05 scope), built over the trousers like the tee, so it shares the Top slot.
  // The shirts (V3-03) are the same kind of top, untucked, in three sleeve lengths; the panel offers one once the pack has loaded and has it.
  {
    name: 'Top',
    options: ['T-shirt', 'Sweatshirt', GARMENTS.shirt_short.option, GARMENTS.shirt_mid.option, GARMENTS.shirt_long.option, 'None'],
    garments: { 'T-shirt': 'tee', Sweatshirt: 'sweatshirt', [GARMENTS.shirt_short.option]: 'shirt_short', [GARMENTS.shirt_mid.option]: 'shirt_mid', [GARMENTS.shirt_long.option]: 'shirt_long' },
  },
  // Shorts (V1.1-05) are the trousers cut at a 23 cm inseam, so the tops sit over them exactly as over the trousers.
  // The skirt (V3-01b) is in a woman's pack only; the panel offers it once the pack has loaded and has it. A tee worn over it is the tucked-in version.
  { name: 'Bottom', options: ['Trousers', 'Shorts', 'Skirt', 'None'], garments: { Trousers: 'trousers', Shorts: 'shorts', Skirt: 'skirt' } },
  // Tights (V2-04) are a layer under the shorts, so they have their own slot. Nothing by default; never with trousers.
  { name: 'Legs', options: ['None', 'Tights'], garments: { Tights: 'tights' } },
  // V3-05: a tee under the sweatshirt or a shirt. Shown only when this person's pack lists a combination that passed on their body.
  { name: UNDER_SLOT, options: ['None', UNDER_OPTION], garments: { [UNDER_OPTION]: 'tee' } },
  // V5-01: shoes. Each person's pack has only the ones built for them (Joe: trainers, monk straps, sandals; B: trainers, Oxfords, sandals, ankle boots), and the row
  // is hidden when the pack has none. The colour is a tint over the shoe's texture; white (the default) is the shoe as made.
  {
    name: SHOES_SLOT,
    options: ['None', GARMENTS.trainers.option, GARMENTS.oxfords.option, GARMENTS.monk_straps.option, GARMENTS.sandals.option, GARMENTS.ankle_boots.option],
    garments: { [GARMENTS.trainers.option]: 'trainers', [GARMENTS.oxfords.option]: 'oxfords', [GARMENTS.monk_straps.option]: 'monk_straps', [GARMENTS.sandals.option]: 'sandals', [GARMENTS.ankle_boots.option]: 'ankle_boots' },
  },
  // V5-04: hair colour (plain colour, chosen by Joe 23 Nov 2026). Hidden when the pack has no hair. Not part of a saved outfit.
  { name: HAIR_SLOT, options: [HAIR_SLOT], garments: { [HAIR_SLOT]: 'hair' } },
];

/** The pack mesh behind each hat option, to offer a hat only when this person's pack has it. */
const HAT_OF: Record<string, string> = { [GARMENTS.cap.option]: 'cap', [GARMENTS.beanie.option]: 'beanie' };

/** The pack mesh behind each shoe option, to offer a shoe only when this person's pack has it. */
const SHOE_OF: Record<string, string> = Object.fromEntries(SLOTS.find((s) => s.name === SHOES_SLOT)!.options.filter((o) => o !== 'None').map((o) => [o, SLOTS.find((s) => s.name === SHOES_SLOT)!.garments[o]]));

/** The pack mesh behind each shirt option (V3-03), to offer a shirt only when this person's pack has it. */
const SHIRT_MESH: Record<string, string> = Object.fromEntries(
  (['shirt_short', 'shirt_mid', 'shirt_long'] as const).map((g) => [GARMENTS[g].option, g]),
);

/** The garments' base colour (`colour_srgb` in pack/fit_config.json), shown until Joe picks one. */
const DEFAULT_COLOUR = '#d6d6d6';

/** "None" is what is stored (and what older backups hold); the person sees "Nothing". */
const optionLabel = (opt: string) => (opt === 'None' ? 'Nothing' : opt);

const HEART =
  '<svg class="heart" width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg>';
const CHEVRON =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"></path></svg>';
const PLUS =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
const TICK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';

/** Arrow keys move the choice along a radio group, as a native radio group does. */
function bindRadioKeys(group: HTMLElement) {
  group.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = radios[(i + step + radios.length) % radios.length];
    next.click();
    next.focus();
  });
}

export function renderTryOn(el: HTMLElement): () => void {
  el.innerHTML = `
    <div class="try-on">
      <div class="stage" id="stage">
        <p class="stage-status" role="status"></p>
        ${PILL_SLOTS.map(
          (n) => `<button type="button" class="wear-row stage-pill hair-pill" data-box="${n}" data-row="${n}" aria-haspopup="dialog" hidden>
          <span class="wear-swatch" data-row-swatch="${n}"></span>
          <span class="wear-text"><span class="slot-label">${n}</span><span class="wear-name" data-slot="${n}"></span></span>
        </button>`,
        ).join('')}
        <span class="stage-hint" hidden>${matchMedia('(pointer: coarse)').matches ? 'Drag to turn · pinch to zoom' : 'Drag to turn · scroll to zoom'}</span>
      </div>
      <section class="panel" aria-labelledby="wearing-title">
        <h2 class="panel-title" id="wearing-title">What you're wearing</h2>
        <button type="button" class="primary outfit-save" id="save-outfit">Save outfit</button>
        ${SLOTS.filter((s) => !isPill(s.name)).map(
          (s) => `<div class="slot" data-box="${s.name}">
            <button type="button" class="wear-row" data-row="${s.name}" aria-haspopup="dialog">
              <span class="wear-swatch" data-row-swatch="${s.name}"></span>
              <span class="wear-text"><span class="slot-label">${s.name}</span><span class="wear-name" data-slot="${s.name}"></span></span>
              <span class="wear-change" aria-hidden="true">Change ›</span>
            </button>
          </div>`,
        ).join('')}
      </section>
      <div class="editor" id="editor" role="dialog" aria-modal="false" aria-labelledby="editor-title" tabindex="-1" hidden>
        <div class="grab" aria-hidden="true"></div>
        <div class="editor-head">
          <h2 id="editor-title"></h2>
          <button type="button" class="editor-back" hidden>${CHEVRON}<span class="editor-back-text"></span></button>
          <button type="button" class="editor-done">Done</button>
        </div>
        <div class="ed-controls">
        <div class="field">
          <span class="field-label" id="lbl-garment">Garment</span>
          <div class="chip-fade"><div class="chips" role="radiogroup" aria-labelledby="lbl-garment" data-garment></div></div>
        </div>
        <div class="field" data-variant-field hidden>
          <span class="field-label" id="lbl-variant">Sleeves</span>
          <div class="seg" role="radiogroup" aria-labelledby="lbl-variant" data-variants></div>
        </div>
        <p class="help layer-note" data-layer-note hidden>Tights go under shorts, not trousers. Change your bottom to shorts or nothing to wear them.</p>
        <div class="field" data-sheer-field hidden>
          <span class="field-label" id="lbl-sheer">Sheerness</span>
          <div class="seg" role="radiogroup" aria-labelledby="lbl-sheer" data-sheers><button type="button" role="radio" aria-checked="false" tabindex="-1" data-sheer="opaque">Opaque</button><button type="button" role="radio" aria-checked="false" tabindex="-1" data-sheer="sheer">Sheer</button></div>
        </div>
        <div class="field" data-neck-field hidden>
          <span class="field-label" id="lbl-neck">Neckline</span>
          <div class="seg" role="radiogroup" aria-labelledby="lbl-neck" data-necklines>${(Object.keys(NECKLINES) as Neckline[])
            .map((n) => `<button type="button" role="radio" aria-checked="false" tabindex="-1" data-neckline="${n}">${NECKLINES[n].label}</button>`)
            .join('')}</div>
        </div>
        <div class="field">
          <span class="field-label" id="lbl-colour">Colour</span>
          <div class="colour-row">
            <button type="button" class="colour-open choose" aria-haspopup="true">
              <span class="cur-swatch" role="img" aria-hidden="true"></span>
              <span class="cur-text"><span class="cur-name"></span><span class="cur-hex"></span></span>
              <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
            </button>
            <button type="button" class="heart-btn fav-btn" aria-pressed="false" aria-label="Save colour to favourites">${HEART}</button>
          </div>
        </div>
        <button type="button" class="secondary add-wardrobe"></button>
        </div>
      </div>
    </div>`;

  const tryOn = el.querySelector<HTMLElement>('.try-on')!;
  const stage = el.querySelector<HTMLElement>('#stage')!;
  const hint = stage.querySelector<HTMLElement>('.stage-hint')!;
  const status = stage.querySelector<HTMLElement>('.stage-status')!;
  const outfitBtn = el.querySelector<HTMLButtonElement>('#save-outfit')!;
  const editor = el.querySelector<HTMLElement>('#editor')!;
  const editorTitle = editor.querySelector<HTMLElement>('#editor-title')!;
  const garmentGroup = editor.querySelector<HTMLElement>('[data-garment]')!;
  const neckField = editor.querySelector<HTMLElement>('[data-neck-field]')!;
  const neckGroup = editor.querySelector<HTMLElement>('[data-necklines]')!;
  const variantField = editor.querySelector<HTMLElement>('[data-variant-field]')!;
  const variantGroup = editor.querySelector<HTMLElement>('[data-variants]')!;
  const variantLabel = editor.querySelector<HTMLElement>('#lbl-variant')!;
  const lastVariant: Record<string, string> = {}; // type -> the variant last used this session
  const sheerField = editor.querySelector<HTMLElement>('[data-sheer-field]')!;
  const sheerGroup = editor.querySelector<HTMLElement>('[data-sheers]')!;
  const layerNote = editor.querySelector<HTMLElement>('[data-layer-note]')!;
  const curSwatch = editor.querySelector<HTMLElement>('.cur-swatch')!;
  const controls = editor.querySelector<HTMLElement>('.ed-controls')!;
  const chooseBtn = editor.querySelector<HTMLButtonElement>('.choose')!;
  const backBtn = editor.querySelector<HTMLButtonElement>('.editor-back')!;
  const backText = backBtn.querySelector<HTMLElement>('.editor-back-text')!;
  const favBtn = editor.querySelector<HTMLButtonElement>('.fav-btn')!;
  const curName = editor.querySelector<HTMLElement>('.cur-name')!;
  const curHex = editor.querySelector<HTMLElement>('.cur-hex')!;
  const addBtn = editor.querySelector<HTMLButtonElement>('.add-wardrobe')!;
  const laptop = matchMedia('(min-width: 900px)');
  // Moving a slider changes the avatar at once; the colour is saved when the slider is released or the chooser closes.
  const chooser = createColourChooser({
    input: (hex) => setColour(hex),
    commit: () => void kvPut('colours', { ...colours }),
    toggleFavourite: () => toggleFavourite(),
  });
  editor.append(chooser.el);
  let dragged = false; // the turn hint goes away after the first drag
  const viewer = createViewer(stage, (msg) => {
    status.textContent = msg ?? '';
    status.hidden = msg === null;
    hint.hidden = msg !== null || dragged;
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.buttons > 0 && !dragged) {
      dragged = true;
      hint.hidden = true;
    }
  });

  const outfit: Record<string, string> = Object.fromEntries(SLOTS.map((s) => [s.name, s.options[0]]));
  const colours: Record<string, string> = {}; // pack garment name -> sRGB hex, only for garments Joe has picked
  let neckline: Neckline = DEFAULT_NECKLINE; // the tee's neckline (V1.1-04); the colour belongs to the tee, whichever neckline it has
  let sheer = false; // the tights' sheerness (V2-04); like the neckline, the colour belongs to the tights either way
  let favourites: Favourite[] = []; // shared by every slot
  let editing: Slot | null = null; // the slot whose controls are open
  let chooserOpen = false; // the colour chooser replaces the slot's controls inside the panel
  let lastRow: HTMLButtonElement | null = null; // gets the focus back when the controls close
  let packReady = false; // the pack and its list of passing layer combinations have loaded
  // Which meshes this person's pack had last time, so the Dress, Outer, Hat, Shoes and Hair rows show at once on a return visit instead of after the download (V7-09). Convenience only.
  const SEEN_KEY = `huedrobe-pack-seen-${person()}`;
  let seen: Set<string> | undefined;
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as string[]); } catch { seen = undefined; }
  const rowHas = (m: string) => (packReady || !seen ? viewer.has(m) : seen.has(m));
  let savedKey: string | null = null; // the garment, colour and neckline last added to the wardrobe
  /** A skirt is offered only when this person's pack has one (a man's does not). Known once the pack has loaded. */
  const offered = (opt: string) =>
    (opt !== TUCKS_INTO || viewer.has('skirt')) &&
    (opt !== DRESS_OPTION || viewer.has('dress')) &&
    (!(opt in SHOE_OF) || viewer.has(SHOE_OF[opt])) &&
    (!(opt in HAT_OF) || viewer.has(HAT_OF[opt])) &&
    (opt !== OUTER_OPTION || !!outerMesh()) &&
    !(opt.startsWith('Shirt') && !viewer.has(SHIRT_MESH[opt] ?? ''));
  /** Why an option cannot be chosen right now (a layer it never goes with), or null when it can. */
  const blockedNote = (slot: string, opt: string): string | null => {
    if (slot === 'Legs' && opt === 'Tights' && outfit.Bottom === TIGHTS_BLOCKED_BY)
      return 'Tights go under shorts, not trousers. Change your bottom to shorts or nothing to wear them.';
    if (slot === 'Top' && isUntuckedTop(opt) && outfit.Bottom === TUCKS_INTO)
      return `A ${opt === 'Sweatshirt' ? 'sweatshirt' : 'shirt'} isn't tucked in, so it can't go with a skirt. Change your bottom to trousers, shorts or nothing to wear it.`;
    if (slot === UNDER_SLOT && opt === UNDER_OPTION && necklinesUnder(viewer.layers(), outfit.Top).length === 0)
      return 'A T-shirt goes under a sweatshirt or a shirt that has been built over it for you. Choose one of those for your top first.';
    if (slot === 'Bottom' && opt === TUCKS_INTO && isUntuckedTop(outfit.Top))
      return `A skirt goes with a T-shirt or nothing on top. Change your top from the ${outfit.Top === 'Sweatshirt' ? 'sweatshirt' : 'shirt'} to wear a skirt.`;
    return null;
  };
  /** The blazer mesh this person's pack has (a man's blazer or a woman's), once the pack has loaded. */
  const outerMesh = () => OUTER_MESHES.find((m) => viewer.has(m));
  const garmentOf = (slot: Slot) => (slot.name === OUTER_SLOT ? (outfit[OUTER_SLOT] === OUTER_OPTION ? outerMesh() ?? '' : '') : slot.garments[outfit[slot.name]]);
  const colourOf = (slot: Slot) => ((garmentOf(slot) && colours[garmentOf(slot)]) || (slot.name === SHOES_SLOT ? SHOES_AS_MADE : slot.name === HAIR_SLOT ? DEFAULT_HAIR_COLOUR : DEFAULT_COLOUR)).toLowerCase();
  const itemKey = (slot: Slot) =>
    `${garmentOf(slot)}|${colourOf(slot)}|${hasNecklines(garmentOf(slot) as GarmentId) ? neckline : ''}|${hasSheer(garmentOf(slot) as GarmentId) ? sheer : ''}`;
  const rowOf = (slot: Slot) => el.querySelector<HTMLButtonElement>(`[data-row="${slot.name}"]`)!;
  /** The row's name: "T-shirt, crew neck", "Trousers" or "Nothing". */
  const nameOf = (slot: Slot) => {
    const g = garmentOf(slot) as GarmentId | undefined;
    if (!g) return 'Nothing';
    if (slot.name === HAIR_SLOT) return colourName(colourOf(slot)); // "Dark brown"
    if (hasSheer(g)) return `${outfit[slot.name]}, ${sheer ? 'sheer' : 'opaque'}`;
    return hasNecklines(g) ? `${outfit[slot.name]}, ${NECKLINES[neckline].words}` : outfit[slot.name];
  };

  const renderRows = () => {
    for (const s of SLOTS) {
      const g = garmentOf(s);
      el.querySelector(`[data-slot="${s.name}"]`)!.textContent = nameOf(s);
      const sw = el.querySelector<HTMLElement>(`[data-row-swatch="${s.name}"]`)!;
      sw.classList.toggle('o-empty', !g);
      sw.style.background = g ? colourOf(s) : '';
    }
    el.querySelector<HTMLElement>(`[data-box="${DRESS_SLOT}"]`)!.hidden = !rowHas('dress'); // a man's pack has no dress
    el.querySelector<HTMLElement>(`[data-box="${OUTER_SLOT}"]`)!.hidden = !OUTER_MESHES.some(rowHas) && outfit[OUTER_SLOT] === 'None'; // a pack built before blazers has none
    el.querySelector<HTMLElement>(`[data-box="${HAT_SLOT}"]`)!.hidden = !HAT_MESHES.some((m) => rowHas(m)) && outfit[HAT_SLOT] === 'None'; // a pack built before hats has none
    el.querySelector<HTMLElement>(`[data-box="${SHOES_SLOT}"]`)!.hidden = !Object.values(SHOE_OF).some((m) => rowHas(m)) && outfit[SHOES_SLOT] === 'None'; // a pack built before shoes has none
    el.querySelector<HTMLElement>(`[data-box="${UNDER_SLOT}"]`)!.hidden = !(outfit[UNDER_SLOT] === UNDER_OPTION || necklinesUnder(viewer.layers(), outfit.Top).length > 0); // shown with a top that can go over a tee
    el.querySelector<HTMLElement>(`[data-box="${HAIR_SLOT}"]`)!.hidden = !rowHas('hair'); // a pack built before hair has none
    outfitBtn.disabled = !SLOTS.some((s) => s.name !== HAIR_SLOT && garmentOf(s)); // an outfit needs at least one garment on the avatar
  };

  /** Brings every control in the open panel up to date with the current outfit. */
  const syncEditor = () => {
    const s = editing;
    if (!s) return;
    const g = garmentOf(s) as GarmentId | undefined;
    const current = colourOf(s);
    garmentGroup.closest<HTMLElement>('.field')!.hidden = s.name === HAIR_SLOT; // hair has one style each: nothing to choose, only the colour
    // A layer that never goes with what is worn (tights under trousers, a sweatshirt with a skirt) is greyed out, with a note saying why.
    let note: string | null = null;
    const cur = typeVariantOf(outfit[s.name]);
    if (cur.variant) lastVariant[cur.type] = cur.variant;
    for (const b of garmentGroup.querySelectorAll<HTMLButtonElement>('[data-opt]')) {
      const on = b.dataset.opt === cur.type;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      const why = blockedNote(s.name, optionFor(b.dataset.opt!, lastVariant[b.dataset.opt!] ?? null) ?? b.dataset.opt!);
      b.disabled = why !== null;
      note ??= why;
    }
    variantField.hidden = !hasVariants(cur.type);
    if (hasVariants(cur.type)) {
      variantLabel.textContent = VARIANT_TYPES[cur.type].label;
      variantGroup.innerHTML = VARIANT_TYPES[cur.type].variants
        .map((v) => ({ v, opt: optionFor(cur.type, v.name)! }))
        .filter(({ opt }) => offered(opt))
        .map(({ v, opt }) => {
          const on = v.name === cur.variant;
          return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-variant="${v.name}"${blockedNote(s.name, opt) ? ' disabled' : ''}>${v.name}</button>`;
        })
        .join('');
    }
    layerNote.textContent = note ?? '';
    layerNote.hidden = note === null;
    sheerField.hidden = !g || !hasSheer(g);
    for (const b of sheerGroup.querySelectorAll<HTMLButtonElement>('[data-sheer]')) {
      const on = (b.dataset.sheer === 'sheer') === sheer;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    neckField.hidden = !g || !hasNecklines(g);
    for (const b of neckGroup.querySelectorAll<HTMLButtonElement>('[data-neckline]')) {
      const on = b.dataset.neckline === neckline;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.disabled = s.name === UNDER_SLOT && !necklinesUnder(viewer.layers(), outfit.Top).includes(b.dataset.neckline as Neckline); // only the necklines that passed over this top on this body
    }
    curSwatch.classList.toggle('o-empty', !g);
    curSwatch.style.background = g ? current : '';
    curName.textContent = g ? colourName(current) : 'Nothing worn';
    curHex.textContent = g ? current.toUpperCase() : '';
    chooseBtn.setAttribute('aria-label', g ? `Colour, ${colourName(current)}, ${current}` : 'Colour, nothing is worn');
    chooseBtn.disabled = !g; // "Nothing" and garments not yet in the pack have no colour to pick
    chooser.sync({ hex: current, favourites });
    favBtn.disabled = !g;
    favBtn.setAttribute('aria-pressed', String(hasFavourite(favourites, current)));
    addBtn.hidden = !g || !(g in GARMENTS);
    const saved = !!g && savedKey === itemKey(s);
    addBtn.innerHTML = saved ? `${TICK}In your wardrobe` : `${PLUS}Add to wardrobe`;
    addBtn.classList.toggle('done', saved);
  };

  /** Shows exactly one mesh per slot: the chosen garment, with the chosen neckline if it has them, tucked in when a skirt is worn (V3-01b). */
  const apply = (slot: Slot) => {
    if (slot.name === HAIR_SLOT) return; // the viewer always draws the hair
    if (slot.name === OUTER_SLOT) {
      for (const m of OUTER_MESHES) viewer.setGarment(m, outfit[OUTER_SLOT] === OUTER_OPTION && m === outerMesh());
      return;
    }
    const tucked = isTucked(outfit);
    const layered = layeredOk(viewer.layers(), outfit, neckline); // V3-05: the tee under a sweatshirt or shirt, which is then the version built over the tee
    if (slot.name === UNDER_SLOT) {
      if (layered) for (const mesh of meshesOf('tee')) viewer.setGarment(mesh, mesh === meshName('tee', neckline)); // after the Top slot, so it shows the tee
      return;
    }
    for (const [opt, id] of Object.entries(slot.garments)) {
      const shown = meshName(id as GarmentId, neckline, tucked);
      for (const mesh of new Set([...meshesOf(id as GarmentId), ...meshesOf(id as GarmentId, true)])) viewer.setGarment(mesh, outfit[slot.name] === opt && mesh === shown && !(layered && opt in MID_TOPS));
      if (opt in MID_TOPS) viewer.setGarment(overMeshName(id), layered && outfit[slot.name] === opt);
    }
  };
  const refresh = () => {
    if (packReady && outfit[UNDER_SLOT] === UNDER_OPTION && !layeredOk(viewer.layers(), outfit, neckline)) {
      const fits = necklinesUnder(viewer.layers(), outfit.Top);
      if (fits.length) neckline = fits[0]; // the tee under keeps to a neckline that passed on this body
      else outfit[UNDER_SLOT] = 'None';
    }
    SLOTS.forEach(apply);
    const dressOn = outfit[DRESS_SLOT] === DRESS_OPTION && viewer.has('dress') && viewer.has('body_dress');
    // While the dress or a shoe is worn, the body with the parts under it removed is drawn instead (V5-01: one file per shoe, and per shoe with the dress).
    const shoe = SHOE_OF[outfit[SHOES_SLOT]];
    const shoeBody = shoe && viewer.has(bodyWithShoe(shoe)) ? shoe : undefined;
    const bodyName = shoeBody
      ? dressOn && viewer.has(bodyWithShoe(shoeBody, true)) ? bodyWithShoe(shoeBody, true) : dressOn ? 'body_dress' : bodyWithShoe(shoeBody)
      : dressOn ? 'body_dress' : 'body';
    for (const b of ['body', 'body_dress', ...SHOE_MESHES.filter((m) => m.startsWith('body_'))]) viewer.setGarment(b, b === bodyName);
    viewer.setSheer('tights', sheer);
    renderRows();
    syncEditor();
  };
  refresh();

  // --- The panel for one slot: a bottom sheet under the stage on a phone, in place of the row on a laptop. ---
  const place = () => {
    const s = editing;
    for (const slot of SLOTS) if (!isPill(slot.name)) rowOf(slot).hidden = false; // a pill is shown or hidden by renderRows, by whether the pack has that item
    if (!s) {
      tryOn.classList.remove('sheet-open');
      return;
    }
    if (laptop.matches) {
      tryOn.classList.remove('sheet-open');
      if (isPill(s.name)) {
        outfitBtn.closest('.panel')!.append(editor); // a pill is on the stage, so its panel goes at the foot of the list
      } else {
        el.querySelector(`[data-box="${s.name}"]`)!.append(editor);
        rowOf(s).hidden = true;
      }
    } else {
      tryOn.classList.add('sheet-open');
      stage.after(editor);
    }
  };
  const buildGarments = (s: Slot) => {
    // One chip per garment type (the three shirts are one "Shirt" chip), "Nothing" first so it never scrolls out of reach.
    const types = [...new Set(s.options.filter(offered).map((o) => typeVariantOf(o).type))].sort((a, b) => Number(b === 'None') - Number(a === 'None'));
    garmentGroup.innerHTML = types
      .map((t) => `<button type="button" role="radio" aria-checked="false" tabindex="-1" data-opt="${t}">${optionLabel(t)}</button>`)
      .join('');
  };
  const openEditor = (s: Slot, row: HTMLButtonElement) => {
    if (editing === s) return;
    if (!editing) history.pushState({ hueEditor: true }, ''); // so the back gesture closes the panel instead of leaving the screen
    editing = s;
    lastRow = row;
    editorTitle.textContent = s.name;
    buildGarments(s);
    place();
    editor.hidden = false;
    syncEditor();
    const first = editor.querySelector<HTMLElement>('[data-opt][aria-checked="true"]');
    first?.scrollIntoView({ block: 'nearest', inline: 'center' });
    (first ?? editor).focus();
  };
  /** Swaps between the slot's controls and the colour chooser. */
  const showChooser = (open: boolean) => {
    if (!editing || chooserOpen === open) return;
    if (!open) void kvPut('colours', { ...colours });
    chooserOpen = open;
    controls.hidden = open;
    chooser.el.hidden = !open;
    if (open) chooser.reset();
    editorTitle.hidden = open;
    backBtn.hidden = !open;
    backText.textContent = `${editing.name} colour`;
    backBtn.setAttribute('aria-label', `Back to the ${editing.name.toLowerCase()}`);
    syncEditor();
    (open ? backBtn : chooseBtn).focus();
  };
  const hideEditor = () => {
    if (!editing) return;
    if (chooserOpen) {
      void kvPut('colours', { ...colours });
      chooserOpen = false;
      controls.hidden = false;
      chooser.el.hidden = true;
      editorTitle.hidden = false;
      backBtn.hidden = true;
    }
    editing = null;
    editor.hidden = true;
    place();
    lastRow?.focus();
  };
  const requestClose = () => {
    if (!editing) return;
    if (history.state?.hueEditor) history.back(); // the popstate handler closes it
    else hideEditor();
  };
  const onPop = () => hideEditor();
  window.addEventListener('popstate', onPop);
  const onLayout = () => place();
  laptop.addEventListener('change', onLayout);

  for (const s of SLOTS)
    rowOf(s).addEventListener('click', () => {
      if (isPill(s.name) && editing && editing !== s) return requestClose(); // the pill is on the stage, so while another panel is open a tap on it just closes that panel
      openEditor(s, rowOf(s));
    });
  editor.querySelector('.editor-done')!.addEventListener('click', requestClose);
  backBtn.addEventListener('click', () => showChooser(false));
  chooseBtn.addEventListener('click', () => showChooser(true));
  editor.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key !== 'Escape') return;
    if (chooserOpen) showChooser(false);
    else requestClose();
  });
  // A tap on the stage closes the sheet on a phone; a drag to turn the avatar does not.
  let down: { x: number; y: number } | null = null;
  stage.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  stage.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.stage-pill')) return; // a pill is inside the stage: it opens its own panel, it does not close one
    if (!tryOn.classList.contains('sheet-open')) return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    requestClose();
  });

  bindRadioKeys(garmentGroup);
  bindRadioKeys(neckGroup);
  bindRadioKeys(variantGroup);
  bindRadioKeys(sheerGroup);
  garmentGroup.addEventListener('click', (e) => {
    const type = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-opt]')?.dataset.opt;
    const s = editing;
    if (!s || !type) return;
    if (typeVariantOf(outfit[s.name]).type === type) return;
    const opt = optionFor(type, lastVariant[type] ?? null);
    if (!opt || opt === outfit[s.name]) return;
    // Putting trousers on takes the tights off (they are never worn together); the Legs panel greys tights out instead.
    Object.assign(outfit, keepLayers({ ...outfit, [s.name]: opt }, s.name));
    refresh();
    void kvPut('outfit', { ...outfit });
  });
  variantGroup.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-variant]')?.dataset.variant;
    const s = editing;
    if (!s || !v) return;
    const opt = optionFor(typeVariantOf(outfit[s.name]).type, v);
    if (!opt || opt === outfit[s.name]) return;
    Object.assign(outfit, keepLayers({ ...outfit, [s.name]: opt }, s.name));
    refresh();
    void kvPut('outfit', { ...outfit });
  });
  sheerGroup.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-sheer]')?.dataset.sheer;
    if (!v || (v === 'sheer') === sheer) return;
    sheer = v === 'sheer';
    refresh();
    void kvPut(SHEER_KEY, sheer);
  });
  neckGroup.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-neckline]')?.dataset.neckline;
    if (!isNeckline(n) || n === neckline) return;
    neckline = n;
    refresh();
    void kvPut(NECKLINE_KEY, neckline);
  });

  /** Applies a colour to the garment in the open slot, on the avatar, the rows and the panel. */
  function setColour(hex: string) {
    const g = editing && garmentOf(editing);
    if (!g) return;
    colours[g] = hex;
    viewer.setColour(g, hex); // applies straight away
    renderRows();
    syncEditor();
  }
  function toggleFavourite() {
    if (!editing) return;
    const hex = colourOf(editing);
    favourites = hasFavourite(favourites, hex) ? removeFavourite(favourites, hex) : addFavourite(favourites, hex, false);
    void saveFavourites(favourites);
    syncEditor();
  }
  favBtn.addEventListener('click', toggleFavourite);
  addBtn.addEventListener('click', async () => {
    const s = editing;
    const g = s && (garmentOf(s) as GarmentId | undefined);
    if (!s || !g || !(g in GARMENTS)) return;
    const key = itemKey(s);
    const items = await loadItems();
    const r = ensureItem(items, g, colourOf(s), Date.now(), neckline, sheer); // one item per garment, colour and (for a tee) neckline or (for tights) sheerness
    if (r.list !== items) await saveItems(r.list);
    savedKey = key;
    syncEditor();
  });

  let gone = false;
  Promise.all([
    kvGet<Record<string, string>>('outfit', {}),
    kvGet<Record<string, string>>('colours', {}),
    loadFavourites(),
    kvGet<unknown>(NECKLINE_KEY, DEFAULT_NECKLINE),
    kvGet<unknown>(SHEER_KEY, false),
  ]).then(([saved, savedColours, favs, savedNeckline, savedSheer]) => {
    if (gone) return;
    loadedSaved = true;
    if (isNeckline(savedNeckline)) neckline = savedNeckline;
    sheer = savedSheer === true;
    for (const s of SLOTS) if (saved[s.name] && s.options.includes(saved[s.name])) outfit[s.name] = saved[s.name];
    Object.assign(outfit, keepLayers(outfit));
    for (const [g, hex] of Object.entries(savedColours)) {
      if (/^#[0-9a-f]{6}$/i.test(hex)) {
        colours[g] = hex;
        viewer.setColour(g, hex);
      }
    }
    favourites = favs;
    dropMissingSkirt();
    refresh();
  });

  // The pack may load before or after the saved outfit: once both are in, a skirt this person's pack lacks is not worn (kept in memory only; the next change saves).
  let loadedSaved = false;
  const dropMissingSkirt = () => {
    if (loadedSaved && packReady && outfit.Bottom === TUCKS_INTO && !viewer.has('skirt')) outfit.Bottom = 'Trousers';
    if (loadedSaved && packReady && outfit[DRESS_SLOT] === DRESS_OPTION && !viewer.has('dress')) outfit[DRESS_SLOT] = 'None';
    if (loadedSaved && packReady && outfit[HAT_SLOT] !== 'None' && !viewer.has(HAT_OF[outfit[HAT_SLOT]] ?? '')) outfit[HAT_SLOT] = 'None'; // a hat this person's pack lacks is not worn
    if (loadedSaved && packReady && outfit[OUTER_SLOT] === OUTER_OPTION && !outerMesh()) outfit[OUTER_SLOT] = 'None'; // a blazer this person's pack lacks is not worn
    if (loadedSaved && packReady && outfit[SHOES_SLOT] !== 'None' && !viewer.has(SHOE_OF[outfit[SHOES_SLOT]] ?? '')) outfit[SHOES_SLOT] = 'None'; // a shoe this person's pack lacks is not worn
  };
  void viewer.ready.then(() => {
    packReady = true;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(['dress', 'hair', ...HAT_MESHES, ...SHOE_MESHES, ...OUTER_MESHES].filter((m) => viewer.has(m)))); } catch { /* private window */ }
    if (gone) return;
    dropMissingSkirt();
    refresh();
  });

  // Saves the look as shown: each garment on the avatar in its colour, added to the library if new.
  outfitBtn.addEventListener('click', async () => {
    let items = await loadItems();
    const look: OutfitLook = {};
    for (const s of SLOTS) {
      const g = garmentOf(s) as GarmentId | undefined;
      if (!g || s.name === UNDER_SLOT || s.name === HAIR_SLOT) continue; // the tee under a top is not part of a saved outfit yet (a saved outfit has no field for it)
      const r = ensureItem(items, g, colourOf(s), Date.now(), neckline, sheer);
      items = r.list;
      if (s.name === 'Top') look.top = r.item;
      else if (s.name === DRESS_SLOT) look.dress = r.item;
      else if (s.name === 'Legs') look.legs = r.item;
      else if (s.name === SHOES_SLOT) look.shoes = r.item;
      else if (s.name === HAT_SLOT) look.hat = r.item;
      else if (s.name === OUTER_SLOT) look.outer = r.item;
      else look.bottom = r.item;
    }
    if (!look.top && !look.bottom && !look.legs && !look.dress && !look.shoes && !look.hat && !look.outer) return;
    await saveItems(items);
    await saveOutfits([...(await loadOutfits()), newOutfit(look)]);
    outfitBtn.textContent = 'Outfit saved';
    setTimeout(() => (outfitBtn.textContent = 'Save outfit'), 1500);
  });
  return () => {
    gone = true;
    window.removeEventListener('popstate', onPop);
    laptop.removeEventListener('change', onLayout);
    viewer.dispose();
  };
}
