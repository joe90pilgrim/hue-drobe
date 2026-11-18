// V4-01: "Add from photo" on the Wardrobe screen. A photo of one garment goes to our server, which asks Gemini for the nearest
// shipped garment and its colour. The sheet then shows both in the usual pickers to check and change before anything is saved.
// The photo lives in a local variable for the length of the request and is never stored. Garments only, never people.
import { colourName, DEFAULT_NECKLINE, ensureItem, GARMENTS, loadItems, NECKLINES, saveItems, type GarmentId, type Neckline, type SavedItem } from '../wardrobe';
import { addFavourite, hasFavourite, loadFavourites, removeFavourite, saveFavourites, type Favourite } from '../favourites';
import { createColourChooser } from '../colour-chooser';
import { FALLBACK_COLOUR, FALLBACK_GARMENT, IdentifyError, identifyPhoto, type Suggestion } from '../identify';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain words for how sure Gemini was. */
const sure = (c: number) => (c >= 0.8 ? 'fairly sure' : c >= 0.5 ? 'not very sure' : 'unsure');

export interface PhotoAdd {
  /** The two buttons (take a photo, upload a photo). */
  buttons: HTMLElement;
  /** The sheet that opens once a photo is chosen. Append it to the screen. */
  sheet: HTMLDialogElement;
  /** Shows or hides the buttons (they belong to the Clothes tab). */
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** `onAdded` is called with the saved list and the item once the person confirms. */
export function createPhotoAdd(onAdded: (list: SavedItem[], item: SavedItem) => void): PhotoAdd {
  const buttons = document.createElement('div');
  buttons.className = 'w-photo-row';
  buttons.innerHTML = `
    <button type="button" class="secondary" data-photo="camera" title="Clothes only, never people. The photo is not kept.">Take photo</button>
    <button type="button" class="secondary" data-photo="upload" title="Clothes only, never people. The photo is not kept.">Upload photo</button>
    <input type="file" accept="image/*" capture="environment" hidden data-input="camera" aria-label="Take a photo of a garment">
    <input type="file" accept="image/*" hidden data-input="upload" aria-label="Upload a photo of a garment">`;

  const sheet = document.createElement('dialog');
  sheet.className = 'sheet w-addsheet';
  sheet.setAttribute('aria-labelledby', 'w-add-title');
  sheet.innerHTML = `
    <h2 id="w-add-title">Add from photo</h2>
    <p class="help" role="status" data-note></p>
    <div class="w-add-form" hidden>
      <div class="field"><span class="field-label" id="w-add-garment">Garment</span><div class="w-add-chips" role="radiogroup" aria-labelledby="w-add-garment"></div></div>
      <div class="field" data-f-neck hidden><span class="field-label" id="w-add-neck">Neckline</span><div class="seg" role="radiogroup" aria-labelledby="w-add-neck"></div></div>
      <div class="field" data-f-sheer hidden><span class="field-label" id="w-add-sheer">Tights</span><div class="seg" role="radiogroup" aria-labelledby="w-add-sheer"></div></div>
      <div class="field"><span class="field-label">Colour</span><div data-colour></div></div>
    </div>
    <div class="sheet-actions">
      <button type="button" class="primary" data-act="add" disabled>Add to wardrobe</button>
      <button type="button" class="secondary" data-act="cancel">Cancel</button>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => sheet.querySelector<T>(sel)!;
  const note = q('[data-note]');
  const form = q('.w-add-form');
  const garmentRow = q('.w-add-chips');
  const neckField = q('[data-f-neck]');
  const sheerField = q('[data-f-sheer]');
  const addBtn = q<HTMLButtonElement>('[data-act="add"]');

  let garment: GarmentId = FALLBACK_GARMENT;
  let neckline: Neckline = DEFAULT_NECKLINE;
  let sheer = false;
  let colour = FALLBACK_COLOUR;
  let favourites: Favourite[] = [];
  let job = 0; // a newer photo, or Cancel, makes an older answer stale

  const chooser = createColourChooser({
    input: (hex) => {
      colour = hex;
    },
    commit: () => {},
    toggleFavourite: () => {
      favourites = hasFavourite(favourites, colour) ? removeFavourite(favourites, colour) : addFavourite(favourites, colour, false);
      void saveFavourites(favourites);
      chooser.sync({ hex: colour, favourites });
    },
  });
  chooser.el.hidden = false;
  q('[data-colour]').append(chooser.el);

  const radio = (on: boolean, attrs: string, text: string) => `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" ${attrs}>${text}</button>`;
  const draw = () => {
    garmentRow.innerHTML = (Object.keys(GARMENTS) as GarmentId[])
      .map((g) => radio(g === garment, `class="chip-btn" data-garment="${g}"`, cap(GARMENTS[g].label)))
      .join('');
    neckField.hidden = garment !== 'tee';
    neckField.querySelector('.seg')!.innerHTML = (Object.keys(NECKLINES) as Neckline[]).map((n) => radio(n === neckline, `data-neck="${n}"`, NECKLINES[n].label)).join('');
    sheerField.hidden = garment !== 'tights';
    sheerField.querySelector('.seg')!.innerHTML = radio(!sheer, 'data-sheer="opaque"', 'Opaque') + radio(sheer, 'data-sheer="sheer"', 'Sheer');
  };

  const showForm = () => {
    draw();
    chooser.reset();
    chooser.sync({ hex: colour, favourites });
    form.hidden = false;
    addBtn.disabled = false;
  };

  /** Moves between the radios of a group with the arrow keys, as the Try on screen does. */
  sheet.addEventListener('keydown', (e) => {
    const group = (e.target as HTMLElement).closest('[role="radiogroup"]');
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!group || !step) return;
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = radios[(i + step + radios.length) % radios.length];
    next.click();
    (group.querySelector<HTMLElement>('[aria-checked="true"]') ?? next).focus();
  });

  sheet.addEventListener('click', async (e) => {
    if (e.target === sheet) return sheet.close(); // a tap on the scrim
    const t = e.target as HTMLElement;
    const g = t.closest<HTMLElement>('[data-garment]')?.dataset.garment;
    const n = t.closest<HTMLElement>('[data-neck]')?.dataset.neck;
    const s = t.closest<HTMLElement>('[data-sheer]')?.dataset.sheer;
    if (g && g in GARMENTS) {
      garment = g as GarmentId;
      draw();
      garmentRow.querySelector<HTMLElement>(`[data-garment="${g}"]`)?.focus();
    } else if (n && n in NECKLINES) {
      neckline = n as Neckline;
      draw();
      neckField.querySelector<HTMLElement>(`[data-neck="${n}"]`)?.focus();
    } else if (s) {
      sheer = s === 'sheer';
      draw();
      sheerField.querySelector<HTMLElement>(`[data-sheer="${s}"]`)?.focus();
    }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'cancel') sheet.close();
    if (act === 'add') {
      addBtn.disabled = true;
      const items = await loadItems();
      const r = ensureItem(items, garment, colour, Date.now(), neckline, sheer); // one item per garment, colour and variant
      if (r.list !== items) await saveItems(r.list);
      sheet.close();
      onAdded(r.list, r.item);
    }
  });
  sheet.addEventListener('close', () => {
    job++; // forget any answer still on its way
    form.hidden = true;
    addBtn.disabled = true;
  });

  const apply = (s: Suggestion | null, message: string) => {
    if (s) {
      garment = s.garment;
      neckline = s.neckline;
      sheer = s.sheer;
      colour = s.colour;
    } else {
      garment = FALLBACK_GARMENT;
      neckline = DEFAULT_NECKLINE;
      sheer = false;
      colour = FALLBACK_COLOUR;
    }
    note.textContent = message;
    showForm();
  };

  async function start(file: File) {
    const mine = ++job;
    loadFavourites().then((f) => {
      favourites = f;
      if (!form.hidden && mine === job) chooser.sync({ hex: colour, favourites });
    });
    form.hidden = true;
    addBtn.disabled = true;
    note.textContent = 'Reading your photo… Clothes only, never people; the photo is not kept.';
    if (!sheet.open) sheet.showModal();
    try {
      const s = await identifyPhoto(file);
      if (mine !== job) return;
      apply(
        s,
        s.matched
          ? `Looks like ${colourName(s.colour).toLowerCase()} ${GARMENTS[s.garment].label} (${sure(s.confidence)}). Check it, and change anything that is wrong.`
          : 'No garment here looks near enough to ours. Choose the nearest one by hand, and check the colour.',
      );
    } catch (e) {
      if (mine !== job) return;
      apply(null, e instanceof IdentifyError ? e.message : 'Could not read that photo. Choose the garment by hand.');
    }
  }

  buttons.addEventListener('click', (e) => {
    const kind = (e.target as HTMLElement).closest<HTMLElement>('[data-photo]')?.dataset.photo;
    if (kind) buttons.querySelector<HTMLInputElement>(`[data-input="${kind}"]`)!.click();
  });
  buttons.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the photo is not kept in the page; the same one can be chosen again
    if (file) void start(file);
  });

  return {
    buttons,
    sheet,
    setVisible: (v) => {
      buttons.hidden = !v;
    },
    dispose: () => {
      job++;
      if (sheet.open) sheet.close();
    },
  };
}
