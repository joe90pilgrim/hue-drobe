import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Files of the avatar pack that the viewer loads. Joe's pack is served from private/pack/joe by the dev server only. */
const PACK_FILES = ['body.glb', 'tee.glb', 'trousers.glb'];
const PACK_URL = './pack/joe/';

export interface Viewer {
  dispose: () => void;
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

  let bytes = 0;
  let disposed = false;
  const loader = new GLTFLoader();
  const loads = PACK_FILES.map(async (file) => {
    const res = await fetch(PACK_URL + file);
    const buf = res.ok ? await res.arrayBuffer() : null;
    // The dev server answers a missing file with index.html, so check for the glTF magic number ("glTF").
    if (!buf || new Uint8Array(buf)[0] !== 0x67) throw new Error(file);
    bytes += buf.byteLength;
    const gltf = await loader.parseAsync(buf, '');
    if (!disposed) scene.add(gltf.scene);
  });
  onStatus('Loading avatar…');
  Promise.all(loads).then(
    () => onStatus(null),
    () => onStatus('Avatar pack not found. Run: python pack/build_pack.py --private'),
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
