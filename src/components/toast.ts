import { useSyncExternalStore } from 'react';

/**
 * A short confirmation that an action worked ("Wine saved").
 *
 * It lives outside React state on purpose: most actions that deserve one
 * navigate away as soon as they finish, so the component that started the
 * action is gone before the message could be shown. The Layout renders the
 * current message, and it survives the route change.
 */
export type Toast = { id: number; message: string };

const VISIBLE_MS = 2800;
const listeners = new Set<() => void>();
let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

function publish(toast: Toast | null) {
  current = toast;
  for (const listener of listeners) listener();
}

export function showToast(message: string) {
  clearTimeout(timer);
  publish({ id: nextId++, message });
  timer = setTimeout(() => publish(null), VISIBLE_MS);
}

export function dismissToast() {
  clearTimeout(timer);
  publish(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
