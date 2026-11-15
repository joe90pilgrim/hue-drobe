import * as THREE from 'three';

const SLOTS = [
  { name: 'Layer', item: 'Sweatshirt' },
  { name: 'Top', item: 'T-shirt' },
  { name: 'Bottom', item: 'Trousers' },
];

export function renderDress(el: HTMLElement): () => void {
  el.innerHTML = `
    <header class="header"><h1>Dress</h1></header>
    <div class="dress">
      <div class="stage" id="stage">
        <span class="stage-hint">Placeholder: the avatar will appear here</span>
      </div>
      <div class="rail" aria-label="Outfit slots">
        ${SLOTS.map(
          (s) => `<div class="slot">
            <div class="slot-label">${s.name}</div>
            <div class="slot-item">${s.item}</div>
            <div class="slot-controls">
              <button aria-label="Previous ${s.name.toLowerCase()}" disabled>&lsaquo;</button>
              <span class="swatch"></span>
              <button aria-label="Next ${s.name.toLowerCase()}" disabled>&rsaquo;</button>
            </div>
          </div>`,
        ).join('')}
      </div>
    </div>`;

  // Minimal three.js scene so the renderer is wired up; replaced in MVP-04.
  const stage = el.querySelector<HTMLElement>('#stage')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.9, 8);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 2.2));
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 1.3, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xc99a7b }),
  );
  body.position.y = 0.9;
  scene.add(body);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  let raf = 0;
  const loop = () => {
    body.rotation.y += 0.01;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.dispose();
  };
}
