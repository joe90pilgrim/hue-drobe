// V4-01: "Add from photo" on the Wardrobe screen. A photo of one garment goes to our server, which asks Gemini for the nearest
// shipped garment and its colour. The sheet then shows both in the usual pickers to check and change before anything is saved.
// The photo lives in a local variable for the length of the request and is never stored. Garments only; never photos of Joe, Beth
// or anyone they know (a retailer's model in a cropped product image is allowed: V4-00 as amended on 22 Nov 2026).
// V4-02: "Add from screenshot" shares the sheet. The screenshot is shown on the device with a crop box, and only the crop is sent.
import { colourName, DEFAULT_NECKLINE, ensureItem, GARMENTS, loadItems, NECKLINES, saveItems, type GarmentId, type Neckline, type SavedItem } from '../wardrobe';
import { addFavourite, hasFavourite, loadFavourites, removeFavourite, saveFavourites, type Favourite } from '../favourites';
import { createColourChooser } from '../colour-chooser';
import { cornerAt, inside, moveRect, rectFromDrag, resizeRect, toSource, usable, type Corner, type Rect } from '../crop';
import { FALLBACK_COLOUR, FALLBACK_GARMENT, IdentifyError, identifyPhoto, type Suggestion } from '../identify';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain words for how sure Gemini was. */
const sure = (c: number) => (c >= 0.8 ? 'fairly sure' : c >= 0.5 ? 'not very sure' : 'unsure');

export interface PhotoAdd {
  /** The three buttons (take a photo, upload a photo, add from screenshot). */
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
    <button type="button" class="secondary" data-photo="camera" aria-label="Take photo" title="Clothes only, never people. The photo is not kept.">Take photo</button>
    <button type="button" class="secondary" data-photo="upload" aria-label="Upload photo" title="Clothes only, never people. The photo is not kept."><span class="w-wide">Upload photo</span><span class="w-narrow">Upload</span></button>
    <button type="button" class="secondary" data-photo="screenshot" aria-label="Add from screenshot" title="Crop a screenshot to one garment. Only the crop is sent, and it is not kept."><span class="w-wide">Add from screenshot</span><span class="w-narrow">Screenshot</span></button>
    <input type="file" accept="image/*" capture="environment" hidden data-input="camera" aria-label="Take a photo of a garment">
    <input type="file" accept="image/*" hidden data-input="upload" aria-label="Upload a photo of a garment">
    <input type="file" accept="image/*" hidden data-input="screenshot" aria-label="Choose a screenshot of a garment">`;

  const sheet = document.createElement('dialog');
  sheet.className = 'sheet w-addsheet';
  sheet.setAttribute('aria-labelledby', 'w-add-title');
  sheet.innerHTML = `
    <h2 id="w-add-title">Add from photo</h2>
    <p class="help" role="status" data-note></p>
    <div class="w-crop" hidden>
      <p class="help">Drag a box around the one garment. Leave out faces, prices and other items. Never a photo of someone you know.</p>
      <div class="w-crop-stage"><canvas aria-label="Your screenshot. Drag a box around the garment." role="img"></canvas><div class="w-crop-box" hidden><i data-corner="nw"></i><i data-corner="ne"></i><i data-corner="sw"></i><i data-corner="se"></i></div></div>
      <div class="sheet-actions">
        <button type="button" class="primary" data-act="crop-use" disabled>Use this part</button>
        <button type="button" class="secondary" data-act="cancel">Cancel</button>
      </div>
    </div>
    <div class="w-add-form" hidden>
      <div class="field"><span class="field-label" id="w-add-garment">Garment</span><div class="w-add-chips" role="radiogroup" aria-labelledby="w-add-garment"></div></div>
      <div class="field" data-f-neck hidden><span class="field-label" id="w-add-neck">Neckline</span><div class="seg" role="radiogroup" aria-labelledby="w-add-neck"></div></div>
      <div class="field" data-f-sheer hidden><span class="field-label" id="w-add-sheer">Tights</span><div class="seg" role="radiogroup" aria-labelledby="w-add-sheer"></div></div>
      <div class="field"><span class="field-label">Colour</span><div data-colour></div></div>
    </div>
    <div class="sheet-actions" data-actions>
      <button type="button" class="primary" data-act="add" disabled>Add to wardrobe</button>
      <button type="button" class="secondary" data-act="cancel">Cancel</button>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => sheet.querySelector<T>(sel)!;
  const note = q('[data-note]');
  const title = q('#w-add-title');
  const cropPane = q('.w-crop');
  const cropCanvas = q<HTMLCanvasElement>('.w-crop canvas');
  const cropBox = q('.w-crop-box');
  const cropUse = q<HTMLButtonElement>('[data-act="crop-use"]');
  const actions = q('[data-actions]');
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
  // V4-02: the screenshot being cropped. It exists only while the crop step is open and is never stored.
  let shot: ImageBitmap | null = null;
  let rect: Rect | null = null;
  let drag: { kind: 'draw'; from: { x: number; y: number } } | { kind: 'move'; last: { x: number; y: number } } | { kind: 'resize'; corner: Corner } | null = null;

  const releaseShot = () => {
    shot?.close();
    shot = null;
    rect = null;
    drag = null;
    cropCanvas.width = cropCanvas.height = 0; // frees the pixels
  };

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
    if (act === 'crop-use') void useCrop();
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
    cropPane.hidden = true;
    actions.hidden = false;
    addBtn.disabled = true;
    releaseShot();
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

  /** Photo route: the whole photo is shrunk and sent. */
  async function start(file: File) {
    const mine = ++job;
    title.textContent = 'Add from photo';
    cropPane.hidden = true;
    actions.hidden = false;
    releaseShot();
    await read(file, mine, 'Reading your photo… Clothes only, never people; the photo is not kept.', 'photo');
  }

  /** Sends one image for matching and fills the pickers from the answer. Shared by the photo and screenshot routes. */
  async function read(image: Blob, mine: number, reading: string, what: 'photo' | 'crop') {
    loadFavourites().then((f) => {
      favourites = f;
      if (!form.hidden && mine === job) chooser.sync({ hex: colour, favourites });
    });
    form.hidden = true;
    addBtn.disabled = true;
    note.textContent = reading;
    if (!sheet.open) sheet.showModal();
    try {
      const s = await identifyPhoto(image);
      if (mine !== job) return;
      apply(
        s,
        s.matched
          ? `Looks like ${colourName(s.colour).toLowerCase()} ${GARMENTS[s.garment].label} (${sure(s.confidence)}). Check it, and change anything that is wrong.`
          : 'No garment here looks near enough to ours. Choose the nearest one by hand, and check the colour.',
      );
    } catch (e) {
      if (mine !== job) return;
      apply(null, e instanceof IdentifyError ? e.message : `Could not read that ${what}. Choose the garment by hand.`);
    }
  }

  // --- V4-02: screenshot and crop ---------------------------------------------------------------------------------

  /** Where a pointer is on the canvas, in the canvas's own pixels, and how many of them one screen pixel covers. */
  const at = (e: PointerEvent) => {
    const b = cropCanvas.getBoundingClientRect();
    const k = cropCanvas.width / (b.width || 1);
    return { p: { x: (e.clientX - b.left) * k, y: (e.clientY - b.top) * k }, k };
  };

  const drawBox = () => {
    cropBox.hidden = !rect || rect.w < 1 || rect.h < 1;
    cropUse.disabled = !rect || !usable(rect);
    if (!rect) return;
    cropBox.style.left = `${(rect.x / cropCanvas.width) * 100}%`;
    cropBox.style.top = `${(rect.y / cropCanvas.height) * 100}%`;
    cropBox.style.width = `${(rect.w / cropCanvas.width) * 100}%`;
    cropBox.style.height = `${(rect.h / cropCanvas.height) * 100}%`;
  };

  const stage = q('.w-crop-stage');
  stage.addEventListener('pointerdown', (e) => {
    if (!shot || e.button > 0) return;
    e.preventDefault();
    const { p, k } = at(e);
    const corner = rect && usable(rect) ? cornerAt(rect, p, 28 * k) : null;
    drag = corner ? { kind: 'resize', corner } : rect && usable(rect) && inside(rect, p) ? { kind: 'move', last: p } : { kind: 'draw', from: p };
    if (drag.kind === 'draw') rect = { x: p.x, y: p.y, w: 0, h: 0 };
    stage.setPointerCapture(e.pointerId);
    drawBox();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || !rect) return;
    const { p } = at(e);
    const w = cropCanvas.width;
    const h = cropCanvas.height;
    if (drag.kind === 'draw') rect = rectFromDrag(drag.from, p, w, h);
    else if (drag.kind === 'resize') rect = resizeRect(rect, drag.corner, p, w, h);
    else {
      rect = moveRect(rect, p.x - drag.last.x, p.y - drag.last.y, w, h);
      drag.last = p;
    }
    drawBox();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    if (rect && !usable(rect)) rect = null; // a tap clears the box
    drawBox();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /** Opens the sheet on the crop step. The screenshot is drawn here, on the device, and nothing is sent yet. */
  async function startScreenshot(file: File) {
    const mine = ++job;
    title.textContent = 'Add from screenshot';
    form.hidden = true;
    releaseShot();
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      if (mine !== job) return;
      cropPane.hidden = true;
      actions.hidden = false;
      addBtn.disabled = true;
      note.textContent = 'That screenshot could not be opened. Try a PNG or JPEG.';
      if (!sheet.open) sheet.showModal();
      return;
    }
    if (mine !== job) return bitmap.close();
    shot = bitmap;
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height)); // enough for a phone screen; the crop itself is cut from the full-size screenshot
    cropCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
    cropCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = cropCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.drawImage(bitmap, 0, 0, cropCanvas.width, cropCanvas.height);
    rect = null;
    drawBox();
    note.textContent = 'The screenshot stays on this device. Only the part you choose is sent, and it is not kept.';
    actions.hidden = true;
    cropPane.hidden = false;
    addBtn.disabled = true;
    if (!sheet.open) sheet.showModal();
  }

  /** Cuts the chosen part from the full-size screenshot and sends only that. */
  async function useCrop() {
    if (!shot || !rect || !usable(rect)) return;
    const mine = ++job;
    const src = toSource(rect, { w: cropCanvas.width, h: cropCanvas.height }, { w: shot.width, h: shot.height });
    const out = document.createElement('canvas');
    out.width = src.w;
    out.height = src.h;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, src.w, src.h);
    ctx.drawImage(shot, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    out.width = out.height = 0;
    releaseShot(); // the screenshot is gone from memory before the request starts
    cropPane.hidden = true;
    actions.hidden = false;
    if (!blob) {
      apply(null, 'Could not cut out that part. Choose the garment by hand.');
      return;
    }
    await read(blob, mine, 'Reading the part you chose… Only that part is sent, and it is not kept.', 'crop');
  }

  buttons.addEventListener('click', (e) => {
    const kind = (e.target as HTMLElement).closest<HTMLElement>('[data-photo]')?.dataset.photo;
    if (kind) buttons.querySelector<HTMLInputElement>(`[data-input="${kind}"]`)!.click();
  });
  buttons.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the photo is not kept in the page; the same one can be chosen again
    if (!file) return;
    if (input.dataset.input === 'screenshot') void startScreenshot(file);
    else void start(file);
  });

  // On a laptop a screenshot can also be pasted (Win+Shift+S, then Ctrl+V) or dropped on the page. Only while the Clothes tab shows
  // and nothing else is open, so a paste into another sheet's field is left alone.
  const imageOf = (files: FileList | null | undefined) => [...(files ?? [])].find((f) => f.type.startsWith('image/'));
  const free = () => !buttons.hidden && !document.querySelector('dialog[open]');
  const onPaste = (e: ClipboardEvent) => {
    const file = imageOf(e.clipboardData?.files);
    if (!file || !free()) return;
    e.preventDefault();
    void startScreenshot(file);
  };
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  const onDragOver = (e: DragEvent) => {
    if (hasFiles(e) && free()) e.preventDefault(); // lets the page accept the drop instead of opening the file
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e) || !free()) return;
    e.preventDefault();
    const file = imageOf(e.dataTransfer?.files);
    if (file) void startScreenshot(file);
  };
  document.addEventListener('paste', onPaste);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDrop);

  return {
    buttons,
    sheet,
    setVisible: (v) => {
      buttons.hidden = !v;
    },
    dispose: () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      job++;
      if (sheet.open) sheet.close();
    },
  };
}
