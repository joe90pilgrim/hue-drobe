import { describe, expect, it } from 'vitest';
import { quiz } from '../src/quiz/quiz';
// @ts-expect-error plain JavaScript module from the server, no type declarations
import { GARMENT_IDS, MAX_BODY_BYTES, MAX_WARDROBE as SERVER_MAX_WARDROBE, cleanRequest } from '../../deploy/packing.mjs';
import { MAX_NOTES, MAX_WARDROBE, buildTemplateRequest, seasonFromAnswers, toLines, wardrobePieces } from '../src/packing-template';
import { GARMENTS, newItem, type SavedItem } from '../src/wardrobe';

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

  it('adds a tidy note only when there is one, cut to the server limit', () => {
    expect(Object.keys(buildTemplateRequest(TRIP, undefined, [], '   '))).toEqual(['name', 'starts', 'ends']);
    expect(buildTemplateRequest(TRIP, undefined, [], ' Carry-on <only>\nplease ').notes).toBe('Carry-on only please');
    expect(buildTemplateRequest(TRIP, undefined, [], 'x'.repeat(500)).notes).toHaveLength(MAX_NOTES);
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

const piece = (id: string, o: Partial<SavedItem> = {}): SavedItem => ({ v: 2, id, garment: 'tee', neckline: 'crew', colour: '#2E5E8C', name: 'Navy tee', savedAt: 1, ...o });

describe('the wardrobe list in the request (V7-05)', () => {
  it('holds only id, garment, name and colour for each piece', () => {
    const req = buildTemplateRequest(TRIP, undefined, [piece('tee-1'), piece('sh-1', { garment: 'sweatshirt', name: 'Blue sweatshirt', colour: '#3a3a3c' })]);
    expect(req.wardrobe).toEqual([
      { id: 'tee-1', garment: 'tee', name: 'Navy tee', colour: '#2e5e8c' },
      { id: 'sh-1', garment: 'sweatshirt', name: 'Blue sweatshirt', colour: '#3a3a3c' },
    ]);
    for (const w of req.wardrobe!) expect(Object.keys(w).sort()).toEqual(['colour', 'garment', 'id', 'name']);
    expect(JSON.stringify(req)).not.toMatch(/neckline|savedAt|photo|height|measure/i);
  });

  it('sends no wardrobe key when there is nothing saved, so the request is as it was', () => {
    expect(buildTemplateRequest(TRIP, undefined, [])).toEqual(TRIP);
    expect(Object.keys(buildTemplateRequest(TRIP))).toEqual(['name', 'starts', 'ends']);
  });

  it('takes markup, line breaks and web addresses out of a name, and falls back to the garment', () => {
    const [a, b, c] = wardrobePieces([piece('a', { name: 'Tee <b>one</b>\nplease' }), piece('b', { name: 'See https://example.com now' }), piece('c', { name: '<>', garment: 'trousers' })]);
    expect(a.name).toBe('Tee b one /b please');
    expect(b.name).not.toMatch(/:\/\/|www\./);
    expect(c.name).toBe('trousers');
  });

  it("is accepted by the server's own checker, with names at the 40-character limit and the 150-piece limit", () => {
    const items = Array.from({ length: MAX_WARDROBE + 20 }, (_, i) => piece(`${i}-${'x'.repeat(30)}`, { name: 'N'.repeat(40), garment: 'shirt_long' }));
    const req = buildTemplateRequest(TRIP, seasonFromAnswers(COMPLETE), items);
    expect(req.wardrobe).toHaveLength(MAX_WARDROBE);
    expect(req.wardrobe![0].id.startsWith('20-')).toBe(true); // the newest 150 are kept
    const clean = cleanRequest(JSON.parse(JSON.stringify(req)));
    expect(clean).not.toBeNull();
    expect(clean.wardrobe).toHaveLength(MAX_WARDROBE);
    expect(JSON.stringify(req).length).toBeLessThan(MAX_BODY_BYTES);
  });

  it('drops the oldest pieces if names with many bytes would go over the body cap', () => {
    // 40 three-byte characters in each name: 150 of them with 36-character ids is over 32 KB if all are sent.
    const items = Array.from({ length: MAX_WARDROBE }, (_, i) => piece(`${i}`.padStart(36, 'i'), { name: '漢'.repeat(40), garment: 'shirt_long' }));
    const req = buildTemplateRequest(TRIP, seasonFromAnswers(COMPLETE), items);
    expect(req.wardrobe!.length).toBeLessThan(MAX_WARDROBE);
    expect(req.wardrobe![req.wardrobe!.length - 1].id.endsWith('149')).toBe(true); // the newest stay
    expect(new TextEncoder().encode(JSON.stringify(req)).length).toBeLessThan(MAX_BODY_BYTES);
    expect(cleanRequest(JSON.parse(JSON.stringify(req)))).not.toBeNull();
  });

  it('skips a piece whose id or garment the server would refuse, rather than failing the whole request', () => {
    const out = wardrobePieces([piece('ok'), piece('has space'), piece(''), piece('cape-1', { garment: 'cape' as never })]);
    expect(out.map((p) => p.id)).toEqual(['ok']);
  });

  it('uses the same garment ids and the same piece limit as the server', () => {
    expect([...GARMENT_IDS].sort()).toEqual(Object.keys(GARMENTS).sort());
    expect(MAX_WARDROBE).toBe(SERVER_MAX_WARDROBE);
    // A piece of every garment the app can save passes the server's check.
    const all = (Object.keys(GARMENTS) as (keyof typeof GARMENTS)[]).map((g) => newItem(g, '#336699'));
    expect(cleanRequest(JSON.parse(JSON.stringify(buildTemplateRequest(TRIP, undefined, all)))).wardrobe).toHaveLength(all.length);
  });
});

describe('the answer with colour, type and matches (V7-05)', () => {
  it('keeps the new fields on a line, and old-style answers are unchanged', () => {
    const lines = toLines({ items: [{ label: 'Wool jumper', quantity: 2, group: 'Layers', colour: '#8C4A2F', type: 'sweatshirt', matches: ['a1', 'a1', 'a2'] }, { label: 'Socks', quantity: 3, group: 'Clothes' }] });
    expect(lines).toEqual([
      { label: 'Wool jumper', quantity: 2, group: 'Layers', colour: '#8c4a2f', type: 'sweatshirt', matches: ['a1', 'a2'] },
      { label: 'Socks', quantity: 3, group: 'Clothes' },
    ]);
  });

  it('drops a bad colour, an unknown type and odd matches, and keeps the line', () => {
    expect(toLines({ items: [{ label: 'Tee', colour: 'red', type: 'cape', matches: 'a1' }, { label: 'Tee 2', colour: '#fff', type: 'constructor', matches: [1, null, ''] }] })).toEqual([{ label: 'Tee' }, { label: 'Tee 2' }]);
  });
});
