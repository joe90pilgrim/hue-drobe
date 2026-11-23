import './style.css';
import { renderTryOn } from './screens/try-on';
import { renderWardrobe } from './screens/wardrobe';
import { renderQuiz } from './screens/quiz';
import { renderPacking } from './screens/packing';
import { routeFromHash, type Route } from './route';
import { createBackupDialog } from './backup-ui';
import { findPerson, setPerson } from './person';
import { moveLegacyData } from './store';
import { startSync } from './sync';

/** Screens in tab order. A fourth entry here adds a tab to the phone bar and the sidebar with no layout change. */
const screens: Record<Route, { label: string; icon: string; render: (el: HTMLElement) => () => void }> = {
  'try-on': {
    label: 'Try on',
    icon: '<path d="M10 6a2 2 0 1 1 3 1.7c-.6.4-1 .9-1 1.6V10"/><path d="M12 10 3 17h18z"/>',
    render: renderTryOn,
  },
  wardrobe: {
    label: 'Wardrobe',
    icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    render: renderWardrobe,
  },
  colours: {
    label: 'My colours',
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/>',
    render: renderQuiz,
  },
  packing: {
    label: 'Packing',
    icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    render: renderPacking,
  },
};

const icon = (paths: string) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

// The logo: the tee-and-hook mark from public/icon.svg without the dark tile, hook in ink, cropped to the artwork.
// Keep it in step with icon.svg (the tee path, hook path, wheel colours and transform). Each use needs its own clip id.
const WHEEL = ['#FF1F8E', '#FF8C1A', '#8CFF1A', '#19FF8C', '#1A8CFF', '#8C1AFF'];
const wheelWedges = WHEEL.map((c, i) => {
  const pt = (k: number) => [256 + 200 * Math.cos((k * Math.PI) / 3 - Math.PI / 3), 300 + 200 * Math.sin((k * Math.PI) / 3 - Math.PI / 3)].map((v) => v.toFixed(1));
  const [x1, y1] = pt(i), [x2, y2] = pt(i + 1);
  return `<path d="M256 300 L${x1} ${y1} A200 200 0 0 1 ${x2} ${y2} Z" fill="${c}" stroke="${c}" stroke-width="1"/>`;
}).join('');
const logo = (id: string) => `<svg class="logo" width="28" height="28" viewBox="76 76 360 360" aria-hidden="true"><defs><clipPath id="${id}"><path d="M226 166 Q186 178 140 211 L96 272 L136 296 L172 262 L172 400 L340 400 L340 262 L376 296 L416 272 L372 211 Q326 178 286 166 Q256 190 226 166 Z"/></clipPath></defs><g transform="translate(256 256) scale(1.08) translate(-256 -256) translate(0 21)"><path d="M226 166 Q256 148 286 166 Q256 190 226 166 Z" fill="#2E2E36"/><path d="M256 206 V150 C256 130 286 126 286 100 C286 80 270 70 254 76 C242 80 238 90 240 100" fill="none" stroke="#16161A" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><g clip-path="url(#${id})">${wheelWedges}</g></g></svg>`;
const brand = (id: string) => `${logo(id)}<span class="wordmark">Hue-drobe</span>`;

const menuIcon = icon('<path d="M4 7h16M4 12h16M4 17h16"/>');
const backupIcon = icon('<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19h14"/>');

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">${brand("logo-tee-top")}</div>
      <button type="button" class="menu-btn" id="menu-btn" aria-label="Menu" aria-haspopup="dialog">${menuIcon}</button>
    </header>
    <main class="main" id="main"></main>
    <nav class="nav" aria-label="Main">
      <div class="brand side-brand">${brand("logo-tee-side")}</div>
      ${(Object.keys(screens) as Route[])
        .map((r) => `<a class="nav-item" href="#/${r}" data-route="${r}"><span class="nav-icon">${icon(screens[r].icon)}</span><span class="nav-label">${screens[r].label}</span></a>`)
        .join('')}
      <button type="button" class="nav-foot" id="backup-btn">${backupIcon}<span>Back up and restore</span></button>
    </nav>
  </div>`;

const main = document.getElementById('main')!;
let cleanup: (() => void) | undefined;

function show() {
  const route = routeFromHash(location.hash);
  cleanup?.();
  main.innerHTML = '';
  main.scrollTop = 0;
  cleanup = screens[route].render(main);
  app.querySelectorAll<HTMLElement>('.nav-item').forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// After a restore the open screen reloads its data from storage.
const backup = createBackupDialog(show);
document.getElementById('menu-btn')!.addEventListener('click', backup.open);
document.getElementById('backup-btn')!.addEventListener('click', backup.open);

// Who is signed in decides whose data and avatar load (V2-06), so nothing renders until that is known.
/** True while someone is in the middle of something a redraw would throw away: an open panel, sheet or dialog, or typing. */
function busy(): boolean {
  if (document.querySelector('dialog[open]')) return true;
  const editor = document.getElementById('editor');
  if (editor && !editor.hidden) return true;
  const focused = document.activeElement;
  return focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement;
}

let shown = false;
/** The server's copy changed something here: redraw the open screen with it, but never under someone's fingers. */
function refreshWhenIdle() {
  if (!shown) return; // the first draw is still to come and will read the new data
  if (busy()) setTimeout(refreshWhenIdle, 1000);
  else show();
}

/** How long, in all, the start may wait on the server (who is signed in, then the first sync) before drawing from the device copy. */
const START_WAIT_MS = 1500;

async function start() {
  const t0 = performance.now();
  const who = await findPerson();
  if (!who) {
    main.innerHTML = '<p class="start-error" role="alert">Could not tell who is signed in. Connect to the internet and reload.</p>';
    return;
  }
  setPerson(who);
  document.documentElement.dataset.person = who;
  await moveLegacyData(who);
  // Background sync between devices (V2-06b). The first round gets whatever time is left of the start budget, so the
  // first screen usually shows the other device's changes; offline or slow, the device copy shows and sync carries on.
  const syncNow = startSync(refreshWhenIdle);
  const left = START_WAIT_MS - (performance.now() - t0);
  if (left > 0 && navigator.onLine) await Promise.race([syncNow(), new Promise((r) => setTimeout(r, left))]);
  window.addEventListener('hashchange', show);
  shown = true;
  show();
}
void start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
