import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const hud = document.getElementById('hud');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1b1f);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
camera.position.set(0, 1.0, 4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(2, 3, 3); scene.add(key);
scene.add(new THREE.GridHelper(4, 8, 0x555566, 0x333344));

const gl = renderer.getContext();
const info = `WebGL2: ${gl instanceof WebGL2RenderingContext}\nGPU: ${(() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; })()}`;
let modelBytes = 0;

const q = new URLSearchParams(location.search).get('m');
const loader = new GLTFLoader();
const load = url => fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(buf => {
  if (!buf || new Uint8Array(buf)[0] !== 0x67) return; // not a glb (dev server fallback)
  modelBytes += buf.byteLength;
  loader.parse(buf, '', g => scene.add(g.scene));
});
if (q) { load('/models/personal/' + q + '.glb'); load('/models/personal/' + q + '_tee.glb'); load('/models/personal/' + q + '_trousers.glb'); }
else load('/models/test_body.glb');

let frames = 0, last = performance.now(), fps = 0;
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  frames++;
  const now = performance.now();
  if (now - last >= 1000) {
    fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now;
    hud.textContent = `${info}\nFPS: ${fps}\nModel: ${(modelBytes / 1024).toFixed(0)} KB`;
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
