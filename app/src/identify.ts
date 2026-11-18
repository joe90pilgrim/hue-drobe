// V4-01: photo of a garment -> nearest shipped garment and its colour, through our own server's /api/identify (which calls Gemini).
// The photo is shrunk here, sent once, and held only in memory. Nothing is stored on the device or uploaded anywhere else, and
// no key lives in the app. Garments only: the screen says so before the photo is chosen (decision of 18 Nov 2026).
import { DEFAULT_NECKLINE, GARMENTS, NECKLINES, isNeckline, type GarmentId, type Neckline } from './wardrobe';

const HEX = /^#[0-9a-f]{6}$/i;
/** The colour the confirm step starts on when the photo could not be read: the "Mid grey" basic. */
export const FALLBACK_COLOUR = '#8c8c8c';
export const FALLBACK_GARMENT: GarmentId = 'tee';

/** A shipped garment as the server is told about it: the id, a plain description, and the variants the app stores for it. */
export interface Template {
  id: GarmentId;
  label: string;
  variants: string[];
}

/** Every garment the app can save. Only the tee (necklines) and tights (opaque or sheer) have variants; shirt sleeve lengths are garments of their own. */
export function templateList(): Template[] {
  return (Object.keys(GARMENTS) as GarmentId[]).map((id) => ({
    id,
    label: GARMENTS[id].label,
    variants: id === 'tee' ? Object.keys(NECKLINES) : id === 'tights' ? ['opaque', 'sheer'] : [],
  }));
}

export interface Suggestion {
  garment: GarmentId;
  neckline: Neckline;
  sheer: boolean;
  /** Lower-case sRGB hex. */
  colour: string;
  /** 0 to 1, how sure Gemini was of the garment. */
  confidence: number;
  /** False when no shipped garment was near enough; the garment is then the default and should be chosen by hand. */
  matched: boolean;
}

/** Reads the server's answer into the values the confirm step starts from. Null if there is no usable colour. */
export function toSuggestion(raw: unknown): Suggestion | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || typeof r.hexColor !== 'string' || !HEX.test(r.hexColor)) return null;
  const matched = typeof r.templateId === 'string' && r.templateId in GARMENTS;
  const garment = matched ? (r.templateId as GarmentId) : FALLBACK_GARMENT;
  const variant = typeof r.variant === 'string' ? r.variant : '';
  return {
    garment,
    neckline: garment === 'tee' && isNeckline(variant) ? variant : DEFAULT_NECKLINE,
    sheer: garment === 'tights' && variant === 'sheer',
    colour: r.hexColor.toLowerCase(),
    confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(1, Math.max(0, r.confidence)) : 0,
    matched,
  };
}

/** Why a photo could not be read. `message` is safe to show. */
export class IdentifyError extends Error {}

/** Shrinks a photo so its longest side is at most `max` px and returns it as a base64 JPEG (no data: prefix). Orientation is applied. */
export async function downscale(file: Blob, max = 1024): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new IdentifyError('That photo could not be opened. Try a JPEG or PNG.');
  }
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new IdentifyError('That photo could not be opened.');
    ctx.fillStyle = '#ffffff'; // a transparent PNG would turn black as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { image: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}

/** Shrinks the photo and asks the server what it is. Throws an IdentifyError with a message to show. */
export async function identifyPhoto(file: Blob): Promise<Suggestion> {
  const { image, mimeType } = await downscale(file);
  let res: Response;
  try {
    res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mimeType, templates: templateList() }),
    });
  } catch {
    throw new IdentifyError('Could not reach the server. Check your connection, or choose the garment by hand.');
  }
  if (res.status === 404) throw new IdentifyError('Photo matching is not switched on yet. Choose the garment by hand.');
  if (!res.ok) throw new IdentifyError('Could not read that photo. Choose the garment by hand.');
  const s = toSuggestion(await res.json().catch(() => null));
  if (!s) throw new IdentifyError('Could not read that photo. Choose the garment by hand.');
  return s;
}
