import { quiz, scoreQuiz } from '../quiz/quiz';
import { kvGet, kvPut } from '../store';

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
    <header class="header"><h1>Colour</h1></header>
    <section class="card quiz" id="quiz"></section>`;
  const card = el.querySelector<HTMLElement>('#quiz')!;
  const n = quiz.questions.length;
  let gone = false;
  let current = -1; // question index in the quiz in progress, or -1 on the intro or result screen
  let draft: Answers = {}; // answers given in the quiz in progress
  let saved: Answers | null = null; // the last finished quiz, shown on return

  function showIntro() {
    current = -1;
    card.innerHTML = `
      <h2>Find your season</h2>
      <p>A short quiz about your skin, hair and eyes, then general advice on which colours suit you.</p>
      <p class="note">${n} questions. Take it in daylight, by a window rather than under a lamp.</p>
      <div class="actions"><button type="button" class="primary" data-action="start">Start the quiz</button></div>`;
  }

  function showQuestion(i: number) {
    current = i;
    const q = quiz.questions[i];
    const picked = draft[q.id];
    card.innerHTML = `
      <div class="step-head">
        <span class="step-count">Question ${i + 1} of ${n}</span>
        <div class="progress" role="progressbar" aria-label="Quiz progress" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${i + 1}">
          <span style="width:${((i + 1) / n) * 100}%"></span>
        </div>
      </div>
      <h2 id="question">${esc(q.text)}</h2>
      ${q.help ? `<p class="help">${esc(q.help)}</p>` : ''}
      <div class="answers" role="radiogroup" aria-labelledby="question">
        ${q.answers
          .map((a) => `<button type="button" role="radio" class="answer" data-answer="${esc(a.id)}" aria-checked="${a.id === picked}">${esc(a.label)}</button>`)
          .join('')}
      </div>
      <div class="actions">
        <button type="button" class="secondary" data-action="back">Back</button>
        <button type="button" class="primary" data-action="next" ${picked ? '' : 'disabled'}>${i + 1 < n ? 'Next' : 'See my result'}</button>
      </div>`;
  }

  function showResult(answers: Answers) {
    current = -1;
    const { season: s } = scoreQuiz(answers);
    card.innerHTML = `
      <p class="eyebrow">Your season</p>
      <h2 class="season">${esc(s.name)}</h2>
      <p>${esc(s.description)}</p>
      <h3>Your palette</h3>
      <ul class="palette">
        ${s.palette.map((hex) => `<li class="chip" role="img" aria-label="${esc(hex)}" title="${esc(hex)}" style="background:${esc(hex)}"></li>`).join('')}
      </ul>
      <h3>Colours that flatter you</h3>
      <p>${esc(s.advice.flatters)}</p>
      <h3>Neutrals</h3>
      <p>${esc(s.advice.neutrals)}</p>
      <h3>Colours to approach with care</h3>
      <p>${esc(s.advice.careWith)}</p>
      <div class="actions"><button type="button" class="secondary" data-action="retake">Retake the quiz</button></div>`;
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
    } else if (action === 'back') {
      if (current > 0) showQuestion(current - 1);
      else if (saved) showResult(saved);
      else showIntro();
    } else if (action === 'next') {
      if (current + 1 < n) showQuestion(current + 1);
      else void finish();
    }
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
