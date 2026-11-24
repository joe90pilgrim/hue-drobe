import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { person } from './person';
import { HAT_MESHES, OUTER_MESHES, SHOE_MESHES, parseLayerCombos, parseUnderFiles, type LayerCombos } from './wardrobe';

/** V3-05: the sweatshirt and shirts as worn over the tee. A pack has only the ones that passed on that body (the manifest lists them). */
const OVER_TEE = ['sweatshirt_over_tee', 'shirt_short_over_tee', 'shirt_mid_over_tee', 'shirt_long_over_tee'];
/** Files of the avatar pack that the viewer loads, from the signed-in person's pack. The dev server serves packs from private/pack/<person>/. */
const PACK_FILES = ['body.glb', 'tee.glb', 'tee_v.glb', 'tee_scoop.glb', 'trousers.glb', 'shorts.glb', 'tights.glb', 'sweatshirt.glb', 'shirt_short.glb', 'shirt_mid.glb', 'shirt_long.glb', 'skirt.glb', 'tee_tucked.glb', 'tee_v_tucked.glb', 'tee_scoop_tucked.glb', 'dress.glb', 'body_dress.glb', 'hair.glb', ...OVER_TEE.map((n) => n + '.glb'), ...SHOE_MESHES.map((n) => n + '.glb'), ...HAT_MESHES.map((n) => n + '.glb'), ...OUTER_MESHES.map((n) => n + '.glb')];
/** Only a woman's pack has these (V3-01b: the skirt and the tees cut at its waistband). A man's pack lacks them, and that is not an error.
 * V3-02: so do `dress` and `body_dress` (the body with the parts under the dress removed, drawn in place of `body` while the dress is worn). */
// The shirts (V3-03) are optional too, so a pack built before them still opens: the Dress screen offers a shirt only when its mesh loaded.
const OPTIONAL = new Set(['shirt_short', 'shirt_mid', 'shirt_long', 'skirt', 'tee_tucked', 'tee_v_tucked', 'tee_scoop_tucked', 'dress', 'body_dress', 'hair', ...OVER_TEE, ...SHOE_MESHES, ...HAT_MESHES, ...OUTER_MESHES]);
// V5-01: the shoes, and the body with the feet hidden under each (and, for the dress, under both), are optional too: a person's pack has only the shoes built for them.
/** V5-04: hair is drawn on every avatar that has it, in this dark brown until the person picks another (Joe, 23 Nov 2026: dark brown). */
export const DEFAULT_HAIR_COLOUR = '#3b2a1f';
/** How much of the light sheer tights stop (V2-04): 1 is opaque. Roughly a 20-denier look; tune by eye with Beth. */
export const SHEER_OPACITY = 0.45;

/** A neckline variant is the same garment: `tee_v` and `tee_scoop` take the colour set for `tee`. */
const groupOf = (name: string) => {
  const n = name.replace(/_over_tee$/, '').replace(/_under_.+$/, ''); // a top over the tee takes the colour set for that top; an inner layer drawn under something takes its own
  return n.startsWith('tee_') ? 'tee' : n;
};
const packUrl = () => `./pack/${person()}/`;

export interface Viewer {
  /** Shows or hides a pack mesh (`tee`, `tee_v`, `tee_scoop`, their `_tucked` versions, `sweatshirt`, `shirt_short`, `shirt_mid`, `shirt_long`, `trousers`, `shorts`, `skirt`, `tights`) instantly. Works before it has loaded. */
  setGarment: (name: string, visible: boolean) => void;
  /** Sets a garment's plain colour from an sRGB hex string such as `#2e5e8c`; `tee` colours every tee neckline. Works before it has loaded. */
  setColour: (name: string, hex: string) => void;
  /** Makes a garment partly see-through (V2-04: sheer tights) or opaque again. Works before it has loaded. */
  setSheer: (name: string, sheer: boolean) => void;
  /** True once the pack has loaded and has this mesh. Before then, and for a mesh the person's pack lacks (a man's pack has no skirt), false. */
  has: (name: string) => boolean;
  /** The layered combinations that passed on this person's body (V3-05); empty before the pack has loaded or when it lists none. */
  layers: () => LayerCombos;
  /** Settles when every file has loaded or failed; never rejects. Use `has` after it. */
  ready: Promise<void>;
  dispose: () => void;
}

/** Paints every material under `root`. `Color.set` reads hex as sRGB and converts to three.js's linear working space. */
function paint(root: THREE.Object3D, hex: string) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) (m as THREE.MeshStandardMaterial).color.set(hex);
    }
  });
}

/** Sheer: blended over the skin beneath, without writing depth, so the body shows through but the shorts still hide what they cover. */
function sheerness(root: THREE.Object3D, sheer: boolean) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        mat.transparent = sheer;
        mat.opacity = sheer ? SHEER_OPACITY : 1;
        mat.depthWrite = !sheer;
        mat.needsUpdate = true;
      }
    }
  });
}

/** Shows the avatar in `stage` and lets the user turn and zoom it. `?debug` adds a frame-rate and download-size readout. */
export function createViewer(stage: HTMLElement, onStatus: (msg: string | null) => void): Viewer {
  const debug = new URLSearchParams(location.search).has('debug');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.0, 5.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 8;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.6;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a8, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-3, 1.5, -2);
  scene.add(fill);

  const hud = document.createElement('pre');
  hud.className = 'hud';
  hud.hidden = !debug;
  stage.append(hud);

  const garments = new Map<string, THREE.Object3D>();
  const wanted = new Map<string, boolean>([['hair', true]]); // the hair is always drawn (V5-04); a hat swaps it for its `hair_under_<hat>` file (V5-02)
  const colours = new Map<string, string>();
  const sheers = new Map<string, boolean>();
  /** V3.1-02: the manifest's `inner_layers_drawn`: outer pack mesh -> inner mesh -> the file of the inner garment with the faces the outer covers removed. */
  let underFiles: Record<string, Record<string, string>> = {};
  const underLoading = new Map<string, Promise<void>>();
  let bytes = 0;
  let disposed = false;
  const loader = new GLTFLoader();
  const underName = (inner: string, outer: string) => `${inner}_under_${outer}`;
  /** The inner meshes now drawn under something that is worn: inner -> outer (the first worn outer that lists it). */
  const swaps = () => {
    const m = new Map<string, string>();
    for (const [outer, inners] of Object.entries(underFiles)) {
      if (!wanted.get(outer)) continue;
      for (const inner of Object.keys(inners)) if (!m.has(inner)) m.set(inner, outer);
    }
    return m;
  };
  /** Shows each inner garment either in full or, while something is worn over it, as its `_under_` file once that has loaded. */
  const syncUnder = () => {
    const active = swaps();
    const drawn: string[] = [];
    for (const [outer, inners] of Object.entries(underFiles)) {
      for (const inner of Object.keys(inners)) {
        const u = garments.get(underName(inner, outer));
        if (u) u.visible = false;
      }
    }
    for (const [inner, outer] of active) {
      const u = garments.get(underName(inner, outer));
      if (!u) {
        void loadUnder(inner, outer);
        continue;
      }
      if (wanted.get(inner)) {
        u.visible = true;
        const full = garments.get(inner);
        if (full) full.visible = false;
        drawn.push(underName(inner, outer));
      }
    }
    for (const inner of new Set(Object.values(underFiles).flatMap((i) => Object.keys(i)))) {
      const full = garments.get(inner);
      if (full && !drawn.some((d) => d.startsWith(inner + '_under_'))) full.visible = wanted.get(inner) ?? false;
    }
    stage.dataset.under = drawn.join(',');
  };
  const loadUnder = async (inner: string, outer: string) => {
    const name = underName(inner, outer);
    const file = underFiles[outer]?.[inner];
    if (!file || !/^[A-Za-z0-9_.-]+\.glb$/.test(file)) return;
    const going = underLoading.get(name);
    if (going) return going;
    const p = fetchUnder(name, file);
    underLoading.set(name, p);
    return p;
  };
  const fetchUnder = async (name: string, file: string) => {
    try {
      const res = await fetch(packUrl() + file);
      const buf = res.ok ? await res.arrayBuffer() : null;
      if (!buf || new Uint8Array(buf)[0] !== 0x67) return; // missing: the full inner garment stays
      bytes += buf.byteLength;
      const gltf = await loader.parseAsync(buf, '');
      if (disposed) return;
      gltf.scene.visible = false;
      garments.set(name, gltf.scene);
      const colour = colours.get(groupOf(name)) ?? (groupOf(name) === 'hair' ? DEFAULT_HAIR_COLOUR : undefined);
      if (colour) paint(gltf.scene, colour);
      scene.add(gltf.scene);
      syncUnder();
    } catch {
      // a file that will not load leaves the full inner garment drawn
    }
  };
  const loads = PACK_FILES.map(async (file) => {
    const name = file.replace('.glb', '');
    const res = await fetch(packUrl() + file);
    const buf = res.ok ? await res.arrayBuffer() : null;
    // The dev server answers a missing file with index.html, so check for the glTF magic number ("glTF").
    if (!buf || new Uint8Array(buf)[0] !== 0x67) {
      if (OPTIONAL.has(name)) return;
      throw new Error(file);
    }
    bytes += buf.byteLength;
    const gltf = await loader.parseAsync(buf, '');
    if (disposed) return;
    gltf.scene.visible = wanted.get(name) ?? !name.startsWith('body_'); // a body with parts hidden (under the dress or a shoe) only shows while that is worn
    garments.set(name, gltf.scene);
    syncUnder();
    const colour = colours.get(groupOf(name)) ?? (name === 'hair' ? DEFAULT_HAIR_COLOUR : undefined);
    if (colour) paint(gltf.scene, colour);
    if (sheers.get(name)) sheerness(gltf.scene, true);
    scene.add(gltf.scene);
  });
  let layerCombos: LayerCombos = {};
  const manifestLoad = fetch(packUrl() + 'manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      layerCombos = parseLayerCombos(m);
      underFiles = parseUnderFiles(m);
      syncUnder();
      // V7-09: fetch every inner-under-outer file now, so a blazer shows the moment it is picked; the spinner waits for them.
      return Promise.allSettled(Object.entries(underFiles).flatMap(([outer, inners]) => Object.keys(inners).map((inner) => loadUnder(inner, outer))));
    })
    .then(() => undefined)
    .catch(() => undefined); // no manifest, or not JSON (the dev server answers a missing file with index.html): no layering offered
  const ready = Promise.allSettled([...loads, manifestLoad]).then(() => undefined);
  onStatus('Getting your avatar ready…');
  Promise.all(loads).then(() => manifestLoad).then(
    () => onStatus(null),
    // The developer instruction is for `?debug` only; Joe and his wife see a plain message.
    () => onStatus(debug ? 'Avatar pack not found. Run: python pack/build_pack.py --private' : "The avatar couldn't load. Try reloading the page."),
  );

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  let frames = 0;
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    frames++;
    const now = performance.now();
    if (now - last >= 1000) {
      if (debug) hud.textContent = `FPS: ${Math.round((frames * 1000) / (now - last))}\nPack: ${(bytes / 1024).toFixed(0)} KB`;
      frames = 0;
      last = now;
    }
  });

  return {
    setGarment(name, visible) {
      wanted.set(name, visible);
      const g = garments.get(name);
      if (g) g.visible = visible;
      syncUnder();
    },
    setColour(name, hex) {
      colours.set(name, hex);
      for (const [n, g] of garments) if (groupOf(n) === name) paint(g, hex);
    },
    setSheer(name, sheer) {
      sheers.set(name, sheer);
      const g = garments.get(name);
      if (g) sheerness(g, sheer);
    },
    has: (name) => garments.has(name),
    layers: () => layerCombos,
    ready,
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
