import { describe, expect, it } from 'vitest';
import { addFavourite, cleanFavourites, hasFavourite, removeFavourite, type Favourite } from '../src/favourites';

describe('cleanFavourites', () => {
  it('keeps valid entries in their saved order and lower-cases the hex', () => {
    expect(
      cleanFavourites([
        { hex: '#2E5E8C', fromPalette: true },
        { hex: '#d6d6d6', fromPalette: false },
      ]),
    ).toEqual([
      { hex: '#2e5e8c', fromPalette: true },
      { hex: '#d6d6d6', fromPalette: false },
    ]);
  });

  it('drops bad hex values, bad shapes and duplicates', () => {
    expect(
      cleanFavourites([
        { hex: 'red', fromPalette: true },
        { hex: '#fff', fromPalette: true },
        { hex: '#12345g', fromPalette: true },
        null,
        'x',
        { fromPalette: true },
        { hex: '#abcdef', fromPalette: true },
        { hex: '#ABCDEF', fromPalette: false },
      ]),
    ).toEqual([{ hex: '#abcdef', fromPalette: true }]);
  });

  it('treats anything other than true as a picked colour, and a non-array as empty', () => {
    expect(cleanFavourites([{ hex: '#000000', fromPalette: 'yes' }])).toEqual([{ hex: '#000000', fromPalette: false }]);
    expect(cleanFavourites(undefined)).toEqual([]);
    expect(cleanFavourites({ hex: '#000000' })).toEqual([]);
  });
});

describe('addFavourite and removeFavourite', () => {
  const start: Favourite[] = [{ hex: '#112233', fromPalette: true }];

  it('adds a colour to the end, lower-cased', () => {
    expect(addFavourite(start, '#AABBCC', false)).toEqual([
      { hex: '#112233', fromPalette: true },
      { hex: '#aabbcc', fromPalette: false },
    ]);
  });

  it('leaves the list unchanged when the colour is already saved or the hex is invalid', () => {
    expect(addFavourite(start, '#112233', false)).toBe(start);
    expect(addFavourite(start, 'nope', true)).toBe(start);
  });

  it('removes a colour, matching regardless of case', () => {
    expect(removeFavourite(start, '#112233')).toEqual([]);
    expect(removeFavourite(start, '#445566')).toEqual(start);
  });

  it('reports whether a colour is saved, regardless of case', () => {
    expect(hasFavourite(start, '#112233')).toBe(true);
    expect(hasFavourite(start, '#11223A')).toBe(false);
  });
});
