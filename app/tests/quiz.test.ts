import { describe, expect, it } from 'vitest';
import { TRAITS, quiz, scoreQuiz, traitRange, type TraitScores } from '../src/quiz/quiz';

/** Walks every possible set of answers once, keeping running trait sums, and counts the season each one reaches. */
function reachableSeasons(): Map<string, number> {
  const range = traitRange();
  const counts = new Map<string, number>();
  const sums: TraitScores = { warmth: 0, value: 0, chroma: 0 };
  const walk = (qi: number): void => {
    if (qi === quiz.questions.length) {
      const traits = {
        warmth: sums.warmth / range.warmth,
        value: sums.value / range.value,
        chroma: sums.chroma / range.chroma,
      };
      // A plain minimum, not rankSeasons: this runs about four million times.
      let id = quiz.seasons[0].id;
      let best = Infinity;
      for (const season of quiz.seasons) {
        const d2 = TRAITS.reduce((sum, t) => sum + (traits[t] - season.target[t]) ** 2, 0);
        if (d2 < best) {
          best = d2;
          id = season.id;
        }
      }
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return;
    }
    for (const answer of quiz.questions[qi].answers) {
      for (const t of TRAITS) sums[t] += answer.scores[t] ?? 0;
      walk(qi + 1);
      for (const t of TRAITS) sums[t] -= answer.scores[t] ?? 0;
    }
  };
  walk(0);
  return counts;
}

describe('quiz content', () => {
  it('has 8 to 12 questions with unique ids and at least two answers each', () => {
    expect(quiz.questions.length).toBeGreaterThanOrEqual(8);
    expect(quiz.questions.length).toBeLessThanOrEqual(12);
    expect(new Set(quiz.questions.map((q) => q.id)).size).toBe(quiz.questions.length);
    for (const q of quiz.questions) {
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
      expect(new Set(q.answers.map((a) => a.id)).size).toBe(q.answers.length);
    }
  });

  it('has the 12 seasons, three per family, each with advice and 8 to 12 hex swatches', () => {
    expect(quiz.seasons).toHaveLength(12);
    for (const family of ['Spring', 'Summer', 'Autumn', 'Winter']) {
      expect(quiz.seasons.filter((s) => s.family === family)).toHaveLength(3);
    }
    expect(new Set(quiz.seasons.map((s) => s.id)).size).toBe(12);
    for (const s of quiz.seasons) {
      expect(s.description.length, s.id).toBeGreaterThan(40);
      for (const text of Object.values(s.advice)) expect(text.length, s.id).toBeGreaterThan(20);
      expect(s.palette.length, s.id).toBeGreaterThanOrEqual(8);
      expect(s.palette.length, s.id).toBeLessThanOrEqual(12);
      for (const hex of s.palette) expect(hex, s.id).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('lets every one of the 12 seasons be reached by some set of answers', () => {
    const counts = reachableSeasons();
    if (process.env.QUIZ_DISTRIBUTION) console.log([...counts].sort((a, b) => b[1] - a[1]));
    const missing = quiz.seasons.filter((s) => !counts.has(s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
  }, 60_000);
});

describe('scoreQuiz', () => {
  const pick = (choices: Record<string, string>) => scoreQuiz(choices);

  it('gives the same result for the same answers', () => {
    const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.answers[0].id]));
    expect(pick(answers)).toEqual(pick(answers));
  });

  it('keeps every trait between -1 and 1', () => {
    for (const pickLast of [false, true]) {
      const answers = Object.fromEntries(
        quiz.questions.map((q) => [q.id, q.answers[pickLast ? q.answers.length - 1 : 0].id]),
      );
      for (const t of TRAITS) expect(Math.abs(pick(answers).traits[t])).toBeLessThanOrEqual(1);
    }
  });

  it('puts a clearly cool, light, soft set of answers in Summer', () => {
    const result = pick({
      'wrist-veins': 'blue',
      metal: 'silver',
      'skin-depth': 'very-fair',
      'skin-tone': 'pink',
      'hair-depth': 'light-brown',
      'hair-tone': 'ash',
      'eye-colour': 'light-blue',
      'eye-clarity': 'soft',
      contrast: 'low',
      sun: 'burn',
      compliments: 'pastel',
    });
    expect(result.season.family).toBe('Summer');
  });

  it('puts a clearly warm, deep set of answers in Autumn', () => {
    const result = pick({
      'wrist-veins': 'green',
      metal: 'gold',
      'skin-depth': 'tan-olive',
      'skin-tone': 'peach',
      'hair-depth': 'dark-brown',
      'hair-tone': 'golden',
      'eye-colour': 'warm-brown',
      'eye-clarity': 'between',
      contrast: 'medium',
      sun: 'golden',
      compliments: 'deep',
    });
    expect(result.season.family).toBe('Autumn');
  });

  it('puts a clearly cool, deep, high-contrast set of answers in Winter', () => {
    const result = pick({
      'wrist-veins': 'blue',
      metal: 'silver',
      'skin-depth': 'fair',
      'skin-tone': 'pink',
      'hair-depth': 'black',
      'hair-tone': 'ash',
      'eye-colour': 'dark',
      'eye-clarity': 'crisp',
      contrast: 'high',
      sun: 'burn',
      compliments: 'vivid',
    });
    expect(result.season.family).toBe('Winter');
  });

  it('puts a clearly warm, light, clear set of answers in Spring', () => {
    const result = pick({
      'wrist-veins': 'green',
      metal: 'gold',
      'skin-depth': 'fair',
      'skin-tone': 'peach',
      'hair-depth': 'blonde',
      'hair-tone': 'golden',
      'eye-colour': 'green',
      'eye-clarity': 'crisp',
      contrast: 'medium',
      sun: 'freckle',
      compliments: 'vivid',
    });
    expect(result.season.family).toBe('Spring');
  });

  it('returns a runner-up that differs from the result, and a confidence from 0 to 1', () => {
    const result = pick({});
    expect(result.runnerUp.id).not.toBe(result.season.id);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
