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
const view = new URLSearchParams(location.search).get('view');
const views = { front: [0, 1.0, 4, 0, 0.9, 0], side: [4, 1.0, 0, 0, 0.9, 0], back: [0, 1.0, -4, 0, 0.9, 0],
                below: [0.0, 0.05, 1.6, 0, 0.85, 0], crotch: [0.0, 0.2, 1.1, 0, 0.82, 0],
                torso: [0, 1.15, 1.7, 0, 1.05, 0], torsoback: [0, 1.15, -1.7, 0, 1.05, 0],
                torsoside: [1.7, 1.15, 0, 0, 1.05, 0], neckback: [0, 1.75, -1.1, 0, 1.4, 0], neckfront: [0, 1.75, 1.1, 0, 1.4, 0], hipback: [0, 1.0, -1.4, 0, 0.9, 0], hipfront: [0, 1.0, 1.4, 0, 0.9, 0], sleeve: [0.75, 1.3, 0.55, 0.3, 1.3, 0] };
const v0 = views[view] || views.front;
camera.position.set(v0[0], v0[1], v0[2]);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(v0[3], v0[4], v0[5]);
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
const hide = (new URLSearchParams(location.search).get('hide') || '').split(',');
if (q) {
  load('/models/personal/' + q + '.glb');
  if (!hide.includes('tee')) load('/models/personal/' + q + '_tee.glb');
  if (!hide.includes('trousers')) load('/models/personal/' + q + '_trousers.glb');
}
else load('/models/test_body.glb');

let frames = 0, last = performance.now(), fps = 0, worstMs = 0, prev = performance.now();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  frames++;
  const now = performance.now();
  worstMs = Math.max(worstMs, now - prev); prev = now;
  if (now - last >= 1000) {
    fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; worstMs = 0;
    hud.textContent = `${info}\nFPS: ${fps}\nModel: ${(modelBytes / 1024).toFixed(0)} KB`;
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
