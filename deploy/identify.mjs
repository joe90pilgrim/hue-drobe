// V4-01: finds the nearest shipped garment template and the dominant colour in a photo of one garment, with one Gemini call.
// The photo is held in memory for the length of the request only. It is never written to disk, logged or stored, and the
// answer carries no part of it. The API key comes from the GEMINI_API_KEY environment variable and never leaves the server.
//
// Decision record: docs/decisions/2026-11-18-v4-data-off-device.md.md (garments only; never photos of Joe, Beth or anyone they know,
// or body data; amended 22 Nov 2026 so a cropped retailer product image of a model is allowed).

export const DEFAULT_MODEL = 'gemini-flash-latest';
/** Largest photo accepted, as base64 text. The app shrinks photos to about 1024 px first (roughly 150 KB). */
export const MAX_IMAGE_CHARS = 3_000_000;
export const MAX_BODY_BYTES = MAX_IMAGE_CHARS + 20_000;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ID = /^[a-z][a-z0-9_]{0,31}$/;
const VARIANT = /^[a-z][a-z0-9_ -]{0,31}$/i;
const HEX = /^#[0-9a-f]{6}$/i;

/** Checks the template list the app sends: [{ id, label, variants? }]. Returns a clean copy, or null if it is not usable. */
export function cleanTemplates(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const out = [];
  for (const t of value) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !ID.test(t.id) || out.some((o) => o.id === t.id)) return null;
    if (typeof t.label !== 'string' || t.label.length === 0 || t.label.length > 60 || /[\r\n]/.test(t.label)) return null;
    const variants = t.variants ?? [];
    if (!Array.isArray(variants) || variants.length > 8 || !variants.every((v) => typeof v === 'string' && VARIANT.test(v))) return null;
    out.push({ id: t.id, label: t.label, variants: [...variants] });
  }
  return out;
}

/** The prompt. The template list is data (ids and labels checked above), not instructions. */
export function buildPrompt(templates) {
  const list = templates.map((t) => `- ${t.id}: ${t.label}${t.variants.length ? ` (variants: ${t.variants.join(', ')})` : ''}`).join('\n');
  return [
    'You are matching an image of one item of clothing to the nearest garment template in a wardrobe app.',
    'The image is either a photo of the garment, or a crop of a shopping web page (V4-02). On a web page ignore any text, prices, buttons, colour swatches, size charts, logos and other products, and look only at the one garment.',
    'A retailer model may be wearing the garment. Describe the garment only; ignore the person, their skin, hair and the background.',
    'Templates (id: description):',
    list,
    '',
    'Reply with JSON only.',
    '- templateId: the id of the template whose shape is nearest to the garment. Use null if the image does not show a garment, or if it is a snapshot of a person with no clear garment to match.',
    '- variant: one of that template\'s variants if it has any and the photo shows which, otherwise null.',
    '- hexColor: the dominant colour of the garment fabric as sRGB hex, such as #2e5e8c. Ignore the background, shadows, labels, hangers, buttons, trims and, on a worn image, the person.',
    '- confidence: a number from 0 to 1 for how sure you are of the template.',
  ].join('\n');
}

export function buildRequest({ image, mimeType, templates, model }) {
  const ids = templates.map((t) => t.id);
  const variants = [...new Set(templates.flatMap((t) => t.variants))];
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    body: {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(templates) }, { inline_data: { mime_type: mimeType, data: image } }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            templateId: { type: 'STRING', enum: ids, nullable: true },
            variant: variants.length ? { type: 'STRING', enum: variants, nullable: true } : { type: 'STRING', nullable: true },
            hexColor: { type: 'STRING' },
            confidence: { type: 'NUMBER' },
          },
          required: ['templateId', 'variant', 'hexColor', 'confidence'],
        },
      },
    },
  };
}

/** Turns Gemini's answer into { templateId, variant, hexColor, confidence }, checked against the templates sent. Null if unusable. */
export function parseAnswer(text, templates) {
  let a;
  try {
    a = JSON.parse(text);
  } catch {
    return null;
  }
  if (!a || typeof a !== 'object' || typeof a.hexColor !== 'string' || !HEX.test(a.hexColor.trim())) return null;
  const template = templates.find((t) => t.id === a.templateId);
  const variant = template && typeof a.variant === 'string' && template.variants.includes(a.variant) ? a.variant : null;
  const confidence = typeof a.confidence === 'number' && Number.isFinite(a.confidence) ? Math.min(1, Math.max(0, a.confidence)) : 0;
  return { templateId: template ? template.id : null, variant, hexColor: a.hexColor.trim().toLowerCase(), confidence };
}

/**
 * Returns identify({ image, mimeType, templates }) -> { templateId, variant, hexColor, confidence }.
 * Throws an Error with a `status` (400, 502) the server turns into the reply; the message is safe to show.
 */
export function createIdentifier({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return async function identify({ image, mimeType, templates }) {
    const req = buildRequest({ image, mimeType, templates, model });
    let res;
    try {
      res = await fetchImpl(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw Object.assign(new Error('The photo service could not be reached'), { status: 502, cause: e.name });
    }
    if (!res.ok) throw Object.assign(new Error('The photo service refused the request'), { status: 502, cause: `HTTP ${res.status}` });
    let text;
    try {
      text = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text;
    } catch {}
    const answer = typeof text === 'string' ? parseAnswer(text, templates) : null;
    if (!answer) throw Object.assign(new Error('Could not read a garment in that photo'), { status: 502, cause: 'unusable answer' });
    return answer;
  };
}

/** Reads and checks the app's request body: { image (base64), mimeType, templates }. Returns the clean parts, or null. */
export function cleanRequest(body) {
  if (!body || typeof body !== 'object') return null;
  const { image, mimeType } = body;
  if (typeof image !== 'string' || image.length < 100 || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return null;
  if (!MIME_TYPES.includes(mimeType)) return null;
  const templates = cleanTemplates(body.templates);
  return templates ? { image, mimeType, templates } : null;
}
