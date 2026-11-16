import { describe, expect, it } from 'vitest';
import { SYNCED_KEYS } from '../src/backup';
// @ts-expect-error plain JavaScript module from the server, no type declarations
import { SYNC_KEYS } from '../../deploy/datastore.mjs';

describe('synced keys', () => {
  it('the app sends exactly the keys the server accepts', () => {
    expect([...SYNCED_KEYS].sort()).toEqual([...(SYNC_KEYS as string[])].sort());
  });
});
