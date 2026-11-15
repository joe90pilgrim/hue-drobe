export function renderQuiz(el: HTMLElement): () => void {
  el.innerHTML = `
    <header class="header"><h1>Colour</h1></header>
    <section class="card quiz">
      <h2>Find your season</h2>
      <p>A short quiz about your skin, hair and eyes, then general advice on which colours suit you.</p>
      <button class="primary" disabled>Start the quiz</button>
      <p class="note">Placeholder: the quiz arrives in MVP-08 and MVP-09.</p>
    </section>`;
  return () => {};
}
