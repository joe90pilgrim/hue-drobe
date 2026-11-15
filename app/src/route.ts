export type Route = 'dress' | 'colour';

/** Maps a location hash such as "#/colour" to a screen. Anything unknown is the Dress screen. */
export function routeFromHash(hash: string): Route {
  return hash.replace('#/', '') === 'colour' ? 'colour' : 'dress';
}
