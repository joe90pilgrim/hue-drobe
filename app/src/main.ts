import './style.css';
import { renderDress } from './screens/dress';
import { renderQuiz } from './screens/quiz';

type Route = 'dress' | 'colour';

const screens: Record<Route, { label: string; icon: string; render: (el: HTMLElement) => () => void }> = {
  dress: {
    label: 'Dress',
    icon: '<path d="M10 6a2 2 0 1 1 3 1.7c-.6.4-1 .9-1 1.6V10"/><path d="M12 10 3 17h18z"/>',
    render: renderDress,
  },
  colour: {
    label: 'Colour',
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/>',
    render: renderQuiz,
  },
};

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="shell">
    <nav class="nav" aria-label="Main">
      ${(Object.keys(screens) as Route[])
        .map(
          (r) => `<a class="nav-item" href="#/${r}" data-route="${r}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${screens[r].icon}</svg>
            <span>${screens[r].label}</span></a>`,
        )
        .join('')}
    </nav>
    <main class="main" id="main"></main>
  </div>`;

const main = document.getElementById('main')!;
let cleanup: (() => void) | undefined;

function currentRoute(): Route {
  const r = location.hash.replace('#/', '');
  return r === 'colour' ? 'colour' : 'dress';
}

function show() {
  const route = currentRoute();
  cleanup?.();
  main.innerHTML = '';
  cleanup = screens[route].render(main);
  app.querySelectorAll<HTMLElement>('.nav-item').forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

window.addEventListener('hashchange', show);
show();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
