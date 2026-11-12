/**
 * Copies of what each screen last loaded, kept on this device so they can be
 * shown when there is no connection.
 *
 * Every successful read is filed under the same name the shared loader uses
 * for it. When a later read cannot reach the server at all, the loader hands
 * back the filed copy instead of an error. Copies belong to one account: they
 * live in a database named after it, and signing out, or a different person
 * signing in, deletes them.
 *
 * Nothing here is ever sent anywhere, and nothing is read from it while the
 * server can be reached.
 */
export type SavedRead = { value: unknown; at: number };

/** Where copies are kept. The app uses the browser's database; tests swap in a plain map. */
export interface SavedReadsBackend {
  get(scope: string, key: string): Promise<SavedRead | undefined>;
  put(scope: string, key: string, saved: SavedRead): Promise<void>;
  clear(scope: string): Promise<void>;
}

const DB_PREFIX = 'winelog-saved-reads:';
const STORE = 'reads';
const SCOPE_KEY = 'winelog-saved-reads-scope';
/** Enough for every list and a few hundred opened wines; the oldest go first. */
const MAX_ENTRIES = 400;
const PRUNE_EVERY = 40;

function request<T>(source: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('Browser storage failed'));
  });
}

/** One kind of thing kept on the device: what it holds, and when it was filed. */
export interface DeviceStore<T> {
  get(scope: string, key: string): Promise<{ value: T; at: number } | undefined>;
  put(scope: string, key: string, saved: { value: T; at: number }): Promise<void>;
  clear(scope: string): Promise<void>;
}

/**
 * A store in the browser's own database, one database per account, holding at
 * most `maxEntries` things. When it grows past that, the oldest are removed.
 */
export function browserDeviceStore<T>(prefix: string, maxEntries: number): DeviceStore<T> {
  const open = (scope: string) =>
    new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Browser storage is unavailable'));
        return;
      }
      const opening = indexedDB.open(prefix + scope, 1);
      opening.onupgradeneeded = () => {
        opening.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('at', 'at');
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error ?? new Error('Could not open browser storage'));
    });

  let writes = 0;
  async function prune(db: IDBDatabase) {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    let extra = (await request(store.count())) - maxEntries;
    if (extra <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const walk = store.index('at').openCursor();
      walk.onerror = () => reject(walk.error);
      walk.onsuccess = () => {
        const cursor = walk.result;
        if (!cursor || extra <= 0) return resolve();
        cursor.delete();
        extra -= 1;
        cursor.continue();
      };
    });
  }

  return {
    async get(scope, key) {
      const db = await open(scope);
      try {
        const row = await request<{ value: T; at: number } | undefined>(
          db.transaction(STORE).objectStore(STORE).get(key),
        );
        return row ? { value: row.value, at: row.at } : undefined;
      } finally {
        db.close();
      }
    },
    async put(scope, key, saved) {
      const db = await open(scope);
      try {
        await request(
          db
            .transaction(STORE, 'readwrite')
            .objectStore(STORE)
            .put({ key, ...saved }),
        );
        if (++writes % PRUNE_EVERY === 0) await prune(db);
      } finally {
        db.close();
      }
    },
    clear(scope) {
      return new Promise<void>((resolve) => {
        if (typeof indexedDB === 'undefined') return resolve();
        const removal = indexedDB.deleteDatabase(prefix + scope);
        removal.onsuccess = removal.onerror = removal.onblocked = () => resolve();
      });
    },
  };
}

const browserBackend: SavedReadsBackend = browserDeviceStore<unknown>(DB_PREFIX, MAX_ENTRIES);

let backend: SavedReadsBackend = browserBackend;
let scope: string | null = null;
/** Other things kept per account on this device (label photos), deleted along with the copies. */
const alsoOwned = new Set<(scope: string) => Promise<void>>();

/** The account whose copies are being kept, or null when nobody is signed in. */
export const savedReadsOwner = () => scope;
/** Have something else deleted whenever the copies of an account are. */
export function deleteWithSavedReads(clear: (scope: string) => Promise<void>) {
  alsoOwned.add(clear);
}

/** Tests only: keep copies somewhere other than the browser's database. */
export function setSavedReadsBackend(next: SavedReadsBackend | null) {
  backend = next ?? browserBackend;
}

const lastScope = () => {
  try {
    return localStorage.getItem(SCOPE_KEY);
  } catch {
    return null;
  }
};

/**
 * Say whose copies these are. Called whenever the account is known: at start,
 * on sign-out, and when the server says nobody is signed in. Copies filed for
 * anyone else on this device are deleted at that moment.
 */
export function setSavedReadsOwner(accountId: string | null) {
  const previous = scope ?? lastScope();
  scope = accountId;
  if (previous && previous !== accountId) {
    void backend.clear(previous).catch(() => null);
    alsoOwned.forEach((clear) => void clear(previous).catch(() => null));
  }
  try {
    if (accountId) localStorage.setItem(SCOPE_KEY, accountId);
    else localStorage.removeItem(SCOPE_KEY);
  } catch {}
  if (!accountId) clearSavedCopyMarks();
}

const nameOf = (key: readonly unknown[]) => JSON.stringify(key);

/** File a fresh answer. Never waited for, and a full or missing database is not an error. */
export function rememberRead(key: readonly unknown[], value: unknown) {
  if (!scope || value === undefined) return;
  void backend.put(scope, nameOf(key), { value, at: Date.now() }).catch(() => null);
}

export async function recallRead(key: readonly unknown[]): Promise<SavedRead | undefined> {
  if (!scope) return undefined;
  try {
    return await backend.get(scope, nameOf(key));
  } catch {
    return undefined;
  }
}

/**
 * True when a read failed because the server could not be reached, as opposed
 * to the server answering with a refusal. Only the first kind may be covered
 * by a saved copy: "not found" and "not allowed" are real answers.
 */
export function connectionFailed(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message);
}

/**
 * Run a read, file its answer, and fall back to the filed copy when the server
 * cannot be reached at all. `onSavedCopy` hears when a copy was handed back.
 */
export async function readKeepingCopy<T>(
  key: readonly unknown[],
  read: () => Promise<T>,
  onSavedCopy?: (at: number) => void,
): Promise<T> {
  try {
    const value = await read();
    rememberRead(key, value);
    unmarkSavedCopy(key);
    return value;
  } catch (error) {
    if (!connectionFailed(error)) throw error;
    const saved = await recallRead(key);
    if (!saved) throw error;
    onSavedCopy?.(saved.at);
    return saved.value as T;
  }
}

// Which answers on screen right now are saved copies, and from when. The
// offline bar reads this to say so.
const marks = new Map<string, number>();
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

export function markSavedCopy(key: readonly unknown[], at: number) {
  marks.set(nameOf(key), at);
  announce();
}
export function unmarkSavedCopy(key: readonly unknown[]) {
  if (marks.delete(nameOf(key))) announce();
}
export function clearSavedCopyMarks() {
  if (!marks.size) return;
  marks.clear();
  announce();
}
export function subscribeSavedCopies(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** The names and dates of the saved copies currently handed out. */
export const savedCopyMarks = (): ReadonlyMap<string, number> => marks;

/** "today at 14:05", "yesterday at 09:30", or "on 3 Nov at 18:20". */
export function savedLabel(at: number, now = Date.now()) {
  const when = new Date(at);
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `on ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${time}`;
}
