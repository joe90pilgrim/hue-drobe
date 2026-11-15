import { createViewer } from '../viewer';

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
        <span class="stage-hint"></span>
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

  const stage = el.querySelector<HTMLElement>('#stage')!;
  const hint = stage.querySelector<HTMLElement>('.stage-hint')!;
  const viewer = createViewer(stage, (msg) => {
    hint.textContent = msg ?? '';
    hint.hidden = msg === null;
  });
  return () => viewer.dispose();
}
