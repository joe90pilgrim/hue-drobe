import data from '../data/colour-quiz.json';

export type Trait = 'warmth' | 'value' | 'chroma';
export const TRAITS: readonly Trait[] = ['warmth', 'value', 'chroma'];
export type TraitScores = Record<Trait, number>;

export interface QuizAnswer {
  id: string;
  label: string;
  scores: Partial<TraitScores>;
}
export interface QuizQuestion {
  id: string;
  text: string;
  help?: string;
  answers: QuizAnswer[];
}
export interface Season {
  id: string;
  family: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  name: string;
  leads: [Trait, Trait];
  target: TraitScores;
  description: string;
  advice: { flatters: string; neutrals: string; careWith: string };
  palette: string[];
}
export interface QuizData {
  version: number;
  questions: QuizQuestion[];
  seasons: Season[];
}

export const quiz = data as unknown as QuizData;

export interface QuizResult {
  /** Each trait from -1 to 1: cool to warm, deep to light, soft to clear. */
  traits: TraitScores;
  season: Season;
  /** The next-closest season, shown as an alternative. */
  runnerUp: Season;
  /** 0 to 1. How much closer the best season is than the runner-up. Low means a borderline result. */
  confidence: number;
  /** True when the runner-up is nearly as close as the best season, so the result screen mentions it. */
  borderline: boolean;
}

/** The runner-up counts as a close second when its distance is within this share of the best season's. */
export const CLOSE_SECOND_MARGIN = 0.15;

/** The most a trait can move: the sum, over questions, of that trait's largest absolute score. */
export function traitRange(q: QuizData = quiz): TraitScores {
  const range: TraitScores = { warmth: 0, value: 0, chroma: 0 };
  for (const question of q.questions) {
    for (const t of TRAITS) {
      range[t] += Math.max(0, ...question.answers.map((a) => Math.abs(a.scores[t] ?? 0)));
    }
  }
  return range;
}

function distance2(a: TraitScores, b: TraitScores): number {
  return TRAITS.reduce((sum, t) => sum + (a[t] - b[t]) ** 2, 0);
}

/** Closest seasons first. Ties go to the earlier season in the file, so the result is always the same. */
export function rankSeasons(traits: TraitScores, q: QuizData = quiz): { season: Season; d2: number }[] {
  return q.seasons
    .map((season, i) => ({ season, d2: distance2(traits, season.target), i }))
    .sort((x, y) => x.d2 - y.d2 || x.i - y.i);
}

/** answers maps a question id to the chosen answer id. Unanswered questions score nothing. */
export function scoreQuiz(answers: Record<string, string>, q: QuizData = quiz): QuizResult {
  const sums: TraitScores = { warmth: 0, value: 0, chroma: 0 };
  for (const question of q.questions) {
    const chosen = question.answers.find((a) => a.id === answers[question.id]);
    if (!chosen) continue;
    for (const t of TRAITS) sums[t] += chosen.scores[t] ?? 0;
  }
  const range = traitRange(q);
  const traits: TraitScores = {
    warmth: sums.warmth / range.warmth,
    value: sums.value / range.value,
    chroma: sums.chroma / range.chroma,
  };
  const [best, second] = rankSeasons(traits, q);
  const d1 = Math.sqrt(best.d2);
  const d2 = Math.sqrt(second.d2);
  return {
    traits,
    season: best.season,
    runnerUp: second.season,
    confidence: d1 + d2 === 0 ? 1 : (d2 - d1) / (d1 + d2),
    borderline: d2 <= d1 * (1 + CLOSE_SECOND_MARGIN),
  };
}
