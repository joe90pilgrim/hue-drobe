// Which files of private/pack/<person>/ go into a deploy (V7-09).
// CORE_PACK: the viewer cannot open without these, so a deploy aborts when one is missing (keep in step with the start of PACK_FILES in app/src/viewer.ts; pack-files.test.mjs checks).
// Everything else the pack build made is copied by pattern, so a new garment never needs a list edited here.
export const CORE_PACK = ['body', 'tee', 'tee_v', 'tee_scoop', 'trousers', 'shorts', 'tights', 'sweatshirt'];

const PACK_FILE = /^(?:[a-z0-9_]+\.glb|manifest\.json)$/;

/** From a pack folder's file names: the avatar meshes (including the `_under_` swaps) and manifest.json. */
export const selectPackFiles = (names) => names.filter((n) => PACK_FILE.test(n));

/** Every mesh a full pack can have beyond the core (one man's pack lacks the skirt and dress, for example). Used only to report which are absent; pack-files.test.mjs keeps it equal to the dev server's list. */
export const KNOWN_PACK = [
  ...CORE_PACK, 'shirt_short', 'shirt_mid', 'shirt_long', 'skirt', 'tee_tucked', 'tee_v_tucked', 'tee_scoop_tucked', 'dress', 'body_dress', 'hair', 'cap', 'beanie', 'blazer_male', 'blazer_female',
  'sweatshirt_over_tee', 'shirt_short_over_tee', 'shirt_mid_over_tee', 'shirt_long_over_tee',
  ...['trainers', 'oxfords', 'monk_straps', 'sandals', 'ankle_boots'].flatMap((s) => [s, `body_${s}`, `body_dress_${s}`]),
];
