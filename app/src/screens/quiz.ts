import { quiz, scoreQuiz, type Season } from '../quiz/quiz';
import { kvGet, kvPut } from '../store';
import { addFavourite, hasFavourite, loadFavourites, removeFavourite, saveFavourites, type Favourite } from '../favourites';

/** The saved result: the answers that produced it, so the season can always be re-run from them. */
const KEY = 'colourQuiz';
type Answers = Record<string, string>; // question id -> answer id

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** True when every question has a valid answer, so the saved result can be scored. */
function isComplete(a: unknown): a is Answers {
  if (!a || typeof a !== 'object') return false;
  const answers = a as Answers;
  return quiz.questions.every((q) => q.answers.some((o) => o.id === answers[q.id]));
}

export function renderQuiz(el: HTMLElement): () => void {
  el.innerHTML = `
    <h1 class="page-title">My colours</h1>
    <section class="quiz" id="quiz"></section>`;
  const card = el.querySelector<HTMLElement>('#quiz')!;
  const n = quiz.questions.length;
  let gone = false;
  let current = -1; // question index in the quiz in progress, or -1 on the intro or result screen
  let draft: Answers = {}; // answers given in the quiz in progress
  let saved: Answers | null = null; // the last finished quiz, shown on return
  let favourites: Favourite[] = []; // shared with the colour picker on the Dress screen

  /** Sets each palette swatch to match the favourites, and the count line under each palette. */
  function syncFavButtons() {
    card.querySelectorAll<HTMLButtonElement>('[data-fav]').forEach((b) => {
      b.setAttribute('aria-pressed', String(hasFavourite(favourites, b.dataset.fav!)));
    });
    card.querySelectorAll<HTMLElement>('.palette').forEach((ul) => {
      const count = ul.querySelectorAll('[data-fav][aria-pressed="true"]').length;
      const line = ul.parentElement?.querySelector<HTMLElement>('.fav-count');
      if (line) line.textContent = `\u2665 ${count} in your favourites`;
    });
  }

  function toggleFavourite(hex: string) {
    favourites = hasFavourite(favourites, hex) ? removeFavourite(favourites, hex) : addFavourite(favourites, hex, true);
    syncFavButtons();
    void saveFavourites(favourites);
  }

  const bar = (inner: string) => `<div class="quiz-bar">${inner}</div>`;

  function showIntro() {
    current = -1;
    card.innerHTML = `
      <div class="card">
        <h2 class="intro-title">Find the colours that suit you</h2>
        <p>Answer ${n} short questions about your skin, hair and eyes. You'll get your colour season, a palette of colours to wear, and some general advice.</p>
        <p class="tip"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Do it in daylight, by a window rather than under a lamp, with a mirror to hand.</span></p>
      </div>
      ${bar('<button type="button" class="primary" data-action="start">Take the quiz</button>')}`;
  }

  function showQuestion(i: number) {
    current = i;
    const q = quiz.questions[i];
    const picked = draft[q.id];
    card.innerHTML = `
      <div class="card q-card">
        <div class="step-head">
          <span class="step-count">Colour quiz \u00b7 question ${i + 1} of ${n}</span>
          <div class="progress" role="progressbar" aria-label="Quiz progress" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${i + 1}">
            <span style="width:${((i + 1) / n) * 100}%"></span>
          </div>
        </div>
        <h2 id="question" class="q-text">${esc(q.text)}</h2>
        ${q.help ? `<p class="help">${esc(q.help)}</p>` : ''}
        <div class="answers" role="radiogroup" aria-labelledby="question">
          ${q.answers
            .map((a) => `<button type="button" role="radio" class="answer" data-answer="${esc(a.id)}" aria-checked="${a.id === picked}"><span>${esc(a.label)}</span><svg class="tick" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>`)
            .join('')}
        </div>
      </div>
      ${bar(`<button type="button" class="secondary" data-action="back">Back</button>
        <button type="button" class="primary" data-action="next" ${picked ? '' : 'disabled'}>${i + 1 < n ? 'Next' : 'See my result'}</button>`)}`;
  }

  function paletteHtml(s: Season): string {
    const heart = '<svg class="heart" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/></svg>';
    return `<div class="palette-wrap"><ul class="palette">
        ${s.palette
          .map(
            (hex) => `<li><button type="button" class="swatch" data-fav="${esc(hex)}" aria-pressed="false" aria-label="${esc(hex)}" title="${esc(hex)}" style="background:${esc(hex)}">${heart}</button></li>`,
          )
          .join('')}
      </ul><p class="fav-count" aria-live="polite"></p></div>`;
  }

  function showResult(answers: Answers) {
    current = -1;
    const { season: s, runnerUp: r, borderline } = scoreQuiz(answers);
    const second = borderline
      ? `<div class="close-second">
        <p id="close-second-line">You are also close to <strong>${esc(r.name)}</strong>.</p>
        <button type="button" class="secondary" data-action="toggle-second" aria-expanded="false" aria-controls="close-second-detail">See this palette</button>
        <div id="close-second-detail" hidden>
          <p>${esc(r.description)}</p>
          ${paletteHtml(r)}
          <h4>Colours that flatter</h4>
          <p>${esc(r.advice.flatters)}</p>
          <h4>Neutrals</h4>
          <p>${esc(r.advice.neutrals)}</p>
          <h4>Colours to approach with care</h4>
          <p>${esc(r.advice.careWith)}</p>
        </div>
      </div>`
      : '';
    card.innerHTML = `
      <div class="result">
        <div class="res-left">
          <div class="card">
            <p class="eyebrow">Your season</p>
            <h2 class="season">${esc(s.name)}</h2>
            <p>${esc(s.description)}</p>
            ${second}
          </div>
          <div class="card">
            <h3>Your palette</h3>
            <p class="help"><span class="when-tap">Tap</span><span class="when-select">Select</span> a colour to add it to your favourites. Favourites are offered when you choose a garment colour.</p>
            ${paletteHtml(s)}
          </div>
        </div>
        <div class="res-right card">
          <h3>Colours that flatter you</h3>
          <p>${esc(s.advice.flatters)}</p>
          <h3>Neutrals</h3>
          <p>${esc(s.advice.neutrals)}</p>
          <h3>Colours to approach with care</h3>
          <p>${esc(s.advice.careWith)}</p>
          <div class="actions"><button type="button" class="secondary" data-action="retake">Retake the quiz</button></div>
        </div>
      </div>`;
    syncFavButtons();
  }

  async function finish() {
    const answers = { ...draft };
    saved = answers;
    showResult(answers);
    await kvPut(KEY, { answers, finishedAt: new Date().toISOString() });
  }

  // One listener on the card, which stays in place while its contents change.
  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const fav = target.closest<HTMLButtonElement>('[data-fav]');
    if (fav) {
      toggleFavourite(fav.dataset.fav!);
      return;
    }
    const answer = target.closest<HTMLButtonElement>('[data-answer]');
    if (answer && current >= 0) {
      draft[quiz.questions[current].id] = answer.dataset.answer!;
      card.querySelectorAll<HTMLElement>('[data-answer]').forEach((b) => b.setAttribute('aria-checked', String(b === answer)));
      card.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled = false;
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'start' || action === 'retake') {
      draft = {};
      showQuestion(0);
    } else if (action === 'toggle-second') {
      const btn = target.closest<HTMLButtonElement>('[data-action]')!;
      const detail = card.querySelector<HTMLElement>('#close-second-detail')!;
      const open = detail.hidden;
      detail.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Hide this palette' : 'See this palette';
    } else if (action === 'back') {
      if (current > 0) showQuestion(current - 1);
      else if (saved) showResult(saved);
      else showIntro();
    } else if (action === 'next') {
      if (current + 1 < n) showQuestion(current + 1);
      else void finish();
    }
  });

  loadFavourites().then((list) => {
    if (gone) return;
    favourites = list;
    syncFavButtons();
  });

  kvGet<{ answers?: unknown } | null>(KEY, null).then((v) => {
    if (gone) return;
    const a = v?.answers;
    if (isComplete(a)) {
      saved = a;
      showResult(a);
    } else {
      showIntro();
    }
  });

  return () => {
    gone = true;
  };
}
