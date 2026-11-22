export type Route = 'try-on' | 'wardrobe' | 'colours' | 'packing';

/**
 * Maps a location hash such as "#/colours" to a screen. The old links #/dress and #/colour still work.
 * Anything unknown is the Try on screen.
 */
export function routeFromHash(hash: string): Route {
  switch (hash.replace('#/', '')) {
    case 'wardrobe':
      return 'wardrobe';
    case 'colours':
    case 'colour':
      return 'colours';
    case 'packing':
      return 'packing';
    default:
      return 'try-on';
  }
}
