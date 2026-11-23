import { describe, expect, it } from 'vitest';
import { quiz } from '../src/quiz/quiz';
import { buildTemplateRequest, seasonFromAnswers, toLines } from '../src/packing-template';

const COMPLETE = Object.fromEntries(quiz.questions.map((q) => [q.id, q.answers[0].id]));
const TRIP = { name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16' };

describe('the season in a template request', () => {
  it('is the season name and its palette when the quiz is complete', () => {
    const s = seasonFromAnswers(COMPLETE);
    expect(quiz.seasons.map((x) => x.name)).toContain(s?.name);
    expect(s?.palette.length).toBeGreaterThan(0);
    expect(s?.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });

  it('is missing when the quiz is not done, half done or unreadable', () => {
    const half: Record<string, string> = { ...COMPLETE };
    delete half[quiz.questions[0].id];
    for (const answers of [undefined, null, {}, half, { [quiz.questions[0].id]: 'not-an-answer' }, 'x']) expect(seasonFromAnswers(answers)).toBeUndefined();
  });
});

describe('the template request', () => {
  it('holds the name and dates and nothing else without the quiz', () => {
    const req = buildTemplateRequest(TRIP, seasonFromAnswers({}));
    expect(req).toEqual(TRIP);
    expect(Object.keys(req)).toEqual(['name', 'starts', 'ends']);
    expect(JSON.stringify(req)).not.toMatch(/season|palette|#/);
  });

  it('adds the season and palette when the quiz is complete', () => {
    const season = seasonFromAnswers(COMPLETE)!;
    const req = buildTemplateRequest(TRIP, season);
    expect(req).toEqual({ ...TRIP, season });
    expect(Object.keys(req).sort()).toEqual(['ends', 'name', 'season', 'starts']);
  });

  it('sends only the trip fields, even from a full trip record', () => {
    const trip = { ...TRIP, v: 1 as const, id: 'secret-id', entries: [{ kind: 'item' as const, ref: 'tee-1', packed: true }], savedAt: 5 };
    expect(Object.keys(buildTemplateRequest(trip))).toEqual(['name', 'starts', 'ends']);
  });

  it('takes markup and control characters out of the name, which the server would refuse', () => {
    expect(buildTemplateRequest({ ...TRIP, name: 'Lisbon <b>trip</b>\nplease' }).name).toBe('Lisbon b trip /b please');
    expect(buildTemplateRequest({ ...TRIP, name: '<>' }).name).toBe('Trip');
  });
});

describe('the answer', () => {
  it('becomes lines, dropping unusable ones', () => {
    expect(toLines({ items: [{ label: 'Socks', quantity: 3, group: 'Clothes' }, { label: 'Passport', quantity: null, group: null }, { label: '  ' }, null, { quantity: 2 }] })).toEqual([
      { label: 'Socks', quantity: 3, group: 'Clothes' },
      { label: 'Passport' },
    ]);
  });

  it('is null when there are no usable lines', () => {
    for (const raw of [null, {}, { items: [] }, { items: 'x' }, { items: [{ label: '' }] }, 'nope']) expect(toLines(raw)).toBeNull();
  });
});
