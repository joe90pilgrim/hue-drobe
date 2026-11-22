# Wardrobe tab as a closet: design spec

Mock-up: the "Hue-drobe: Wardrobe tab as a closet" canvas in the Huedrobe project (Clothes board is interactive; Outfits board; Silhouette set board). Tickets: V3-15, V3-16, V3-17.

## Problems today

1. Items and outfits are colour blocks. They show no garment shape.
2. The tab does not look like a wardrobe.
3. Colour blocks will not say much about an outfit once hats, shoes and layers arrive.

## Design

**Silhouettes.** One drawn shape per garment (and per tee neckline), filled with the item's colour. The edge, collar and seam lines are worked out from the fill colour, so a new colour needs no new art. The same shapes are used on item cards, outfit cards and the detail panel art.

**Clothes tab = closet.**
- Things that hang (Tops, Dresses, Bottoms, Tights) hang from a rail. Hats and shoes, when they exist (V5), sit on shelves. Each group declares which.
- Group order, top to bottom: Hats, Tops, Dresses, Bottoms, Tights, Shoes. Empty groups are hidden.
- In "All" on a phone, each group is one rail that slides sideways, with the next item peeking in. Choosing a chip shows only that group, wrapped into rows of three, each row with its own rail. On a laptop (900 px and wider, with the side panel) rails wrap instead of sliding.
- Each group sits in a soft "bay" (#ebe7e1, radius 16) with a rail line (4 px, #9a9a9a) or a shelf beam (8 px, #cdc5ba) drawn behind the items. Item cards are 104 px wide, silhouette 96 px, name 13/700, sub line 12 grey.
- Selected item: white 65% highlight behind it. Tapping still opens the existing panel (Try it on, Rename, Delete).

**Outfits tab = flat-lay cards.** A card shows the outfit's silhouettes stacked head to toe (hat, top, bottom, shoes), centred on #efefef, 120:190 aspect in the mock-up. A dress is one tall shape. Tights show as legs under a short bottom. A missing (deleted) piece shows as a dashed empty outline in its place. When the name is just the list of pieces, the second line says how many items instead of repeating the name.

A tee worn under a sweatshirt (a layer) is drawn in the mock-up as the tee peeking out at the neck and hem. Saved outfits do not store the under tee today, so that part is not built yet (see V3-17).

## App ids to shapes

| Garment id | Shape |
|---|---|
| `tee` + `crew` | `tee` |
| `tee` + `v` | `tee_v` |
| `tee` + `scoop` | not drawn yet: copy `tee` and deepen the neck curve (`Q50 30`) |
| `sweatshirt` | `sweat` |
| `shirt_short`, `shirt_mid`, `shirt_long` | `shirt_short`, `shirt_mid`, `shirt_long` |
| `trousers`, `shorts`, `skirt` | same names |
| `tights` | `tights` (sheer: fill at about 55% opacity) |
| `dress` ("Shift dress") | `dress` |
| any unknown id | a generic rounded shape, so a new garment never shows blank |

## Starting point for the shape table

These are mid-fidelity drawings from the mock-up, not final art. Joe signs off the look. Path data is in a 100 by 100 box for hung items. `box` is the content box used to crop the shape in flat-lays and on shelves.

```js
const HOOK_TOP = 'M50 14 L50 9 Q50 3 56 3 Q61 3 61 8 M50 14 L12 27 M50 14 L88 27';
const HOOK_BOTTOM = 'M50 14 L50 9 Q50 3 56 3 Q61 3 61 8 M27 15 L73 15';
const HOOK_DRESS = 'M50 14 L50 9 Q50 3 56 3 Q61 3 61 8 M50 14 L38 10 M50 14 L62 10';
const SHAPES = {
  tee: { hang: true, hook: HOOK_TOP, box: [4, 12, 92, 86],
    body: 'M38 14 Q50 24 62 14 L86 26 L78 42 L70 37 L70 92 L30 92 L30 37 L22 42 L14 26 Z',
    detail: 'M39.5 17 Q50 27 60.5 17 M30 86 L70 86' },
  tee_v: { hang: true, hook: HOOK_TOP, box: [4, 12, 92, 86],
    body: 'M38 14 L50 34 L62 14 L86 26 L78 42 L70 37 L70 92 L30 92 L30 37 L22 42 L14 26 Z',
    detail: 'M41 16.5 L50 30 L59 16.5 M30 86 L70 86' },
  sweat: { hang: true, hook: HOOK_TOP, box: [4, 12, 92, 86],
    body: 'M38 14 Q50 24 62 14 L84 24 L92 80 L80 83 L72 44 L72 90 L28 90 L28 44 L20 83 L8 80 L16 24 Z',
    detail: 'M39.5 17 Q50 27 60.5 17 M28 84 L72 84 M9 74 L19.5 77 M91 74 L80.5 77' },
  shirt_short: { hang: true, hook: HOOK_TOP, box: [4, 6, 92, 90],
    body: 'M38 14 L50 26 L62 14 L86 26 L78 42 L70 37 L70 94 L30 94 L30 37 L22 42 L14 26 Z',
    collar: 'M50 26 L36 12 L42 8 L50 16 L58 8 L64 12 Z', detail: 'M50 26 L50 94' },
  shirt_mid: { hang: true, hook: HOOK_TOP, box: [4, 6, 92, 90],
    body: 'M38 14 L50 26 L62 14 L86 26 L90 58 L79 60 L70 37 L70 94 L30 94 L30 37 L21 60 L10 58 L14 26 Z',
    collar: 'M50 26 L36 12 L42 8 L50 16 L58 8 L64 12 Z', detail: 'M50 26 L50 94' },
  shirt_long: { hang: true, hook: HOOK_TOP, box: [4, 6, 92, 90],
    body: 'M38 14 L50 26 L62 14 L85 25 L92 84 L80 86 L70 38 L70 94 L30 94 L30 38 L20 86 L8 84 L15 25 Z',
    collar: 'M50 26 L36 12 L42 8 L50 16 L58 8 L64 12 Z', detail: 'M50 26 L50 94 M9 78 L19.5 80 M91 78 L80.5 80' },
  trousers: { hang: true, hook: HOOK_BOTTOM, box: [22, 14, 56, 86],
    body: 'M28 16 L72 16 L75 96 L55 96 L50 46 L45 96 L25 96 Z', detail: 'M28 22 L72 22 M50 22 L50 46' },
  shorts: { hang: true, hook: HOOK_BOTTOM, box: [20, 14, 60, 48],
    body: 'M28 16 L72 16 L76 58 L55 58 L50 38 L45 58 L24 58 Z', detail: 'M28 22 L72 22 M50 22 L50 38' },
  skirt: { hang: true, hook: HOOK_BOTTOM, box: [12, 14, 76, 64],
    body: 'M32 16 L68 16 L86 76 L14 76 Z', detail: 'M32 22 L68 22' },
  dress: { hang: true, hook: HOOK_DRESS, box: [22, 8, 56, 88],
    body: 'M36 10 L42 10 L45 18 Q50 22 55 18 L58 10 L64 10 L66 34 L76 94 L24 94 L34 34 Z', detail: 'M35 40 L65 40' },
  tights: { hang: true, hook: HOOK_BOTTOM, box: [30, 14, 40, 86],
    body: 'M34 16 L66 16 L68 98 L54 98 L50 46 L46 98 L32 98 Z', detail: 'M34 22 L66 22' },
  beanie: { hang: false, box: [12, 10, 76, 58],
    body: 'M18 50 Q16 14 50 12 Q84 14 82 50 Z', collar: 'M14 48 L86 48 L86 62 Q50 68 14 62 Z',
    detail: 'M30 49 L30 63 M40 49 L40 65 M50 49 L50 66 M60 49 L60 65 M70 49 L70 63' },
  cap: { hang: false, box: [14, 16, 86, 52],
    body: 'M20 56 Q20 22 52 20 Q82 22 84 56 Z', extra: 'M62 54 Q92 52 98 62 Q80 66 58 62 Z', detail: 'M52 20 L52 56' },
  sneaker: { hang: false, box: [4, 18, 94, 42], xfill: '#f4f1ec',
    body: 'M8 48 L8 30 Q22 30 30 20 L46 22 Q56 38 78 40 Q94 42 94 48 Z',
    extra: 'M6 48 L96 48 L96 54 Q96 58 90 58 L12 58 Q6 58 6 54 Z', detail: 'M34 24 L40 31 M41 23 L47 31' },
  boot: { hang: false, box: [16, 6, 82, 60], xfill: '#2b2b2b',
    body: 'M26 8 L50 8 L52 40 Q78 42 92 50 L92 54 L22 54 Z',
    extra: 'M20 54 L94 54 L94 60 Q94 64 88 64 L24 64 Q20 64 20 60 Z', detail: 'M26 18 L50 18' }
};
const lumOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) / 255 + 0.7152 * ((n >> 8) & 255) / 255 + 0.0722 * (n & 255) / 255;
};
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + f)))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
const edgeOf = (hex) => (lumOf(hex) < 0.12 ? '#6b6b6b' : shade(hex, -0.3));
const art = (key, colour, withHook) => {
  const sh = SHAPES[key];
  const dark = lumOf(colour) < 0.12;
  return {
    body: sh.body, collar: sh.collar || '', detail: sh.detail || '', extra: sh.extra || '',
    hook: withHook === false ? '' : (sh.hook || ''),
    fill: colour, edge: edgeOf(colour), xfill: sh.xfill || edgeOf(colour),
    cfill: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.35)',
    box: sh.box.join(' '), bw: sh.box[2], bh: sh.box[3], hang: sh.hang
  };
};
```
