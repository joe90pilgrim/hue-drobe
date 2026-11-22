// The built-in colour chooser (V1.2-05). It lives inside the change-a-piece panel, so the avatar stays in view and
// changes as a slider moves. It holds no garment logic: the screen gives it the current colour and hears about changes.
import { SHOWN_FIRST, type Favourite } from './favourites';
import { colourName } from './wardrobe';
import { hexToHsv, hsvToHex, normaliseHex, type Hsv } from './colour-maths';

export const BASICS = [
  { hex: '#ffffff', name: 'White' },
  { hex: '#f2ede3', name: 'Cream' },
  { hex: '#c8b89a', name: 'Beige' },
  { hex: '#8c8c8c', name: 'Mid grey' },
  { hex: '#1a1a1a', name: 'Black' },
  { hex: '#5b4636', name: 'Brown' },
];

const HEART =
  '<svg class="heart" width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg>';

export interface ChooserState {
  /** The colour now on the garment. */
  hex: string;
  favourites: Favourite[];
}

export interface ChooserHandlers {
  /** The colour changed (a slider is moving, or a code or tile was used): apply it to the avatar now. */
  input(hex: string): void;
  /** The change is finished (slider released, code typed, tile tapped): save it. */
  commit(): void;
  toggleFavourite(): void;
}

const SLIDERS = [
  { key: 'h', label: 'Colour', hint: '', min: 0, max: 359 },
  { key: 's', label: 'Strength', hint: 'greyer to richer', min: 0, max: 100 },
  { key: 'v', label: 'Lightness', hint: 'darker to lighter', min: 0, max: 100 },
] as const;

export function createColourChooser(handlers: ChooserHandlers) {
  const el = document.createElement('div');
  el.className = 'chooser';
  el.hidden = true;
  el.innerHTML = `
    <div class="chooser-top">
      <span class="cur-swatch chooser-swatch" role="img" aria-label="Chosen colour"></span>
      <span class="cur-text"><span class="cur-name"></span><span class="cur-hex"></span></span>
      <button type="button" class="heart-btn fav-btn" aria-pressed="false" aria-label="Save colour to favourites">${HEART}</button>
    </div>
    <div class="field">
      <span class="field-label">Favourites</span>
      <p class="help fav-empty">Tap the heart to keep a colour here.</p>
      <div class="fav-row" role="group" aria-label="Favourite colours"></div>
      <div class="fav-foot">
        <span class="legend" hidden><span class="legend-dot"></span>From your colour palette</span>
        <button type="button" class="link-btn" data-more hidden></button>
      </div>
    </div>
    <div class="field">
      <span class="field-label">Basics</span>
      <div class="fav-row" role="group" aria-label="Basic colours">${BASICS.map(
        (b) => `<button type="button" class="fav-tile" data-hex="${b.hex}" aria-pressed="false" aria-label="${b.name}" style="background:${b.hex}"></button>`,
      ).join('')}</div>
    </div>
    <div class="field">
      <button type="button" class="fine-toggle" aria-expanded="false" aria-controls="fine-tune">Fine-tune colour<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></button>
      <div class="fine" id="fine-tune" hidden>
        <label class="code-field"><span class="field-label">Colour code</span>
          <input type="text" class="code" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off">
        </label>
        <div class="sliders">${SLIDERS.map(
          (s) => `<label class="slider"><span class="slider-text"><span class="slider-name">${s.label}</span>${s.hint ? `<span class="slider-hint">${s.hint}</span>` : ''}</span>
          <input type="range" min="${s.min}" max="${s.max}" step="1" data-k="${s.key}"></label>`,
        ).join('')}</div>
      </div>
    </div>`;

  const swatch = el.querySelector<HTMLElement>('.chooser-swatch')!;
  const code = el.querySelector<HTMLInputElement>('.code')!;
  const favBtn = el.querySelector<HTMLButtonElement>('.fav-btn')!;
  const favRow = el.querySelector<HTMLElement>('[aria-label="Favourite colours"]')!;
  const favEmpty = el.querySelector<HTMLElement>('.fav-empty')!;
  const legend = el.querySelector<HTMLElement>('.legend')!;
  const curName = el.querySelector<HTMLElement>('.cur-name')!;
  const curHex = el.querySelector<HTMLElement>('.cur-hex')!;
  const fineBtn = el.querySelector<HTMLButtonElement>('.fine-toggle')!;
  const fine = el.querySelector<HTMLElement>('.fine')!;
  const moreBtn = el.querySelector<HTMLButtonElement>('[data-more]')!;
  const basicTiles = [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Basic colours"] [data-hex]')];
  const range = {
    h: el.querySelector<HTMLInputElement>('[data-k="h"]')!,
    s: el.querySelector<HTMLInputElement>('[data-k="s"]')!,
    v: el.querySelector<HTMLInputElement>('[data-k="v"]')!,
  };

  let hex = '#000000';
  let hsv: Hsv = { h: 0, s: 0, v: 0 }; // the sliders' own values; kept while they still make `hex`, so the hue does not jump at grey or black
  let favourites: Favourite[] = [];
  let showAll = false;
  let drawnKey = '';

  const paintTracks = () => {
    range.h.style.background = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
    range.s.style.background = `linear-gradient(to right, ${hsvToHex(hsv.h, 0, hsv.v)}, ${hsvToHex(hsv.h, 100, hsv.v)})`;
    range.v.style.background = `linear-gradient(to right, #000000, ${hsvToHex(hsv.h, hsv.s, 100)})`;
  };

  const tileHtml = (f: Favourite) =>
    `<button type="button" class="fav-tile" data-hex="${f.hex}" aria-pressed="false" aria-label="${f.hex}${f.fromPalette ? ', from your palette' : ''}" style="background:${f.hex}">${f.fromPalette ? '<span class="palette-dot"></span>' : ''}</button>`;

  /** Redraws the favourite tiles only when the list changes; otherwise only the ring moves, so a focused tile keeps focus. */
  const drawFavs = () => {
    const shown = showAll ? favourites : favourites.slice(0, SHOWN_FIRST);
    const key = shown.map((f) => f.hex + (f.fromPalette ? 'p' : '')).join(',') + (showAll ? '+' : '');
    if (key !== drawnKey) {
      const active = document.activeElement as HTMLElement | null;
      const keep = active && favRow.contains(active) ? active.dataset.hex : undefined;
      favRow.innerHTML = shown.map(tileHtml).join('');
      drawnKey = key;
      if (keep) favRow.querySelector<HTMLElement>(`[data-hex="${keep}"]`)?.focus();
    }
    favEmpty.hidden = favourites.length > 0;
    legend.hidden = !shown.some((f) => f.fromPalette);
    moreBtn.hidden = favourites.length <= SHOWN_FIRST;
    moreBtn.textContent = showAll ? 'Show fewer' : 'Show all';
    moreBtn.setAttribute('aria-expanded', String(showAll));
    for (const t of [...favRow.querySelectorAll<HTMLButtonElement>('[data-hex]'), ...basicTiles]) {
      const on = t.dataset.hex === hex;
      t.classList.toggle('on', on);
      t.setAttribute('aria-pressed', String(on));
    }
  };

  const draw = () => {
    swatch.style.background = hex;
    swatch.setAttribute('aria-label', `Chosen colour ${hex}`);
    curName.textContent = colourName(hex);
    curHex.textContent = hex.toUpperCase();
    if (document.activeElement !== code) code.value = hex.toUpperCase();
    for (const k of ['h', 's', 'v'] as const) if (+range[k].value !== hsv[k]) range[k].value = String(hsv[k]);
    paintTracks();
    favBtn.setAttribute('aria-pressed', String(favourites.some((f) => f.hex === hex)));
    drawFavs();
  };

  /** Takes a colour from outside the sliders (a code, a tile, or the screen) and re-reads the sliders from it. */
  const useHex = (next: string) => {
    hex = next;
    hsv = hexToHsv(next);
  };

  for (const k of ['h', 's', 'v'] as const) {
    range[k].addEventListener('input', () => {
      hsv = { ...hsv, [k]: +range[k].value };
      hex = hsvToHex(hsv.h, hsv.s, hsv.v);
      draw();
      handlers.input(hex);
    });
    range[k].addEventListener('change', () => handlers.commit());
  }
  code.addEventListener('input', () => {
    const next = normaliseHex(code.value);
    if (!next || next === hex) return;
    useHex(next);
    draw();
    handlers.input(next);
    handlers.commit();
  });
  code.addEventListener('blur', draw); // a half-typed code goes back to the real one
  el.addEventListener('click', (e) => {
    const next = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-hex]')?.dataset.hex;
    if (!next) return;
    useHex(next);
    draw();
    handlers.input(next);
    handlers.commit();
  });
  favBtn.addEventListener('click', () => handlers.toggleFavourite());
  fineBtn.addEventListener('click', () => {
    const open = fine.hidden;
    fine.hidden = !open;
    fineBtn.setAttribute('aria-expanded', String(open));
  });
  moreBtn.addEventListener('click', () => {
    showAll = !showAll;
    draw();
  });

  return {
    el,
    /** Closes Fine-tune; called each time the colour page opens. */
    reset() {
      fine.hidden = true;
      fineBtn.setAttribute('aria-expanded', 'false');
    },
    /** Brings the chooser up to date with the colour on the garment and the favourites list. */
    sync(state: ChooserState) {
      favourites = state.favourites;
      const next = state.hex.toLowerCase();
      if (next !== hex) useHex(next);
      draw();
    },
  };
}
