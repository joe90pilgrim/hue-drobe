import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { person } from './person';

/** Files of the avatar pack that the viewer loads, from the signed-in person's pack. The dev server serves packs from private/pack/<person>/. */
const PACK_FILES = ['body.glb', 'tee.glb', 'tee_v.glb', 'tee_scoop.glb', 'trousers.glb', 'shorts.glb', 'tights.glb', 'sweatshirt.glb'];
/** How much of the light sheer tights stop (V2-04): 1 is opaque. Roughly a 20-denier look; tune by eye with Beth. */
export const SHEER_OPACITY = 0.45;

/** A neckline variant is the same garment: `tee_v` and `tee_scoop` take the colour set for `tee`. */
const groupOf = (name: string) => name.split('_')[0];
const packUrl = () => `./pack/${person()}/`;

export interface Viewer {
  /** Shows or hides a pack mesh (`tee`, `tee_v`, `tee_scoop`, `sweatshirt`, `trousers`, `shorts`, `tights`) instantly. Works before it has loaded. */
  setGarment: (name: string, visible: boolean) => void;
  /** Sets a garment's plain colour from an sRGB hex string such as `#2e5e8c`; `tee` colours every tee neckline. Works before it has loaded. */
  setColour: (name: string, hex: string) => void;
  /** Makes a garment partly see-through (V2-04: sheer tights) or opaque again. Works before it has loaded. */
  setSheer: (name: string, sheer: boolean) => void;
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
  const wanted = new Map<string, boolean>();
  const colours = new Map<string, string>();
  const sheers = new Map<string, boolean>();
  let bytes = 0;
  let disposed = false;
  const loader = new GLTFLoader();
  const loads = PACK_FILES.map(async (file) => {
    const res = await fetch(packUrl() + file);
    const buf = res.ok ? await res.arrayBuffer() : null;
    // The dev server answers a missing file with index.html, so check for the glTF magic number ("glTF").
    if (!buf || new Uint8Array(buf)[0] !== 0x67) throw new Error(file);
    bytes += buf.byteLength;
    const gltf = await loader.parseAsync(buf, '');
    if (disposed) return;
    const name = file.replace('.glb', '');
    gltf.scene.visible = wanted.get(name) ?? true;
    garments.set(name, gltf.scene);
    const colour = colours.get(groupOf(name));
    if (colour) paint(gltf.scene, colour);
    if (sheers.get(name)) sheerness(gltf.scene, true);
    scene.add(gltf.scene);
  });
  onStatus('Getting your avatar ready…');
  Promise.all(loads).then(
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
