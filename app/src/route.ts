export type Route = 'dress' | 'wardrobe' | 'colour';

/** Maps a location hash such as "#/colour" to a screen. Anything unknown is the Dress screen. */
export function routeFromHash(hash: string): Route {
  const r = hash.replace('#/', '');
  return r === 'colour' || r === 'wardrobe' ? r : 'dress';
}
