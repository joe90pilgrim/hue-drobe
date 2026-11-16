// Who is signed in (V2-06). The server knows from IAP's signed header and answers /api/me; the dev server answers as Joe.
// The last answer is remembered on the device, so the installed app still opens offline.

const REMEMBER_KEY = 'huedrobe.person';

/** A person id as the server sends it: `joe`, `b`. Anything else is refused, since it becomes part of a database name and a URL. */
export function cleanPerson(v: unknown): string | null {
  return typeof v === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(v) ? v : null;
}

function remembered(): string | null {
  try {
    return cleanPerson(localStorage.getItem(REMEMBER_KEY));
  } catch {
    return null;
  }
}

function remember(person: string) {
  try {
    localStorage.setItem(REMEMBER_KEY, person);
  } catch {
    /* storage unavailable: the next start asks the server again */
  }
}

/**
 * Asks the server who is signed in. Falls back to the person last seen on this device when the server cannot be reached
 * (offline, or an expired sign-in that redirects to Google). Returns null when neither is known.
 */
export async function findPerson(): Promise<string | null> {
  try {
    const res = await fetch('./api/me', { cache: 'no-store', credentials: 'same-origin' });
    if (res.ok) {
      const person = cleanPerson(((await res.json()) as { person?: unknown }).person);
      if (person) {
        remember(person);
        return person;
      }
    }
  } catch {
    /* offline or signed out: use the remembered person */
  }
  return remembered();
}

let current: string | null = null;

/** Sets the signed-in person for this page. Called once at start, before any screen reads storage. */
export function setPerson(person: string) {
  current = person;
}

/** The signed-in person. Throws if called before `setPerson`, so nothing is ever read or written without an owner. */
export function person(): string {
  if (!current) throw new Error('No signed-in person yet');
  return current;
}
