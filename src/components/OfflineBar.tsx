import { useEffect, useSyncExternalStore } from 'react';
import { bootstrapAccount } from '../lib/auth/client';
import { connectionReturned, oldestSavedCopyOnScreen, subscribeSavedCopiesOnScreen } from '../lib/query/client';
import { savedLabel } from '../lib/offline/savedReads';
import './offline.css';

function subscribe(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}
const isOffline = () => navigator.onLine === false;

/**
 * A plain line under the top bar while the phone has no signal.
 *
 * The app opens offline, so without this an empty page would look like a fault
 * rather than a missing connection. When the screen in front of you is showing
 * a copy saved earlier, the line says so and from when. When the signal returns
 * the account is checked again (the saved sign-in may have ended meanwhile) and
 * every screen reloads what it shows.
 */
export function OfflineBar() {
  const offline = useSyncExternalStore(subscribe, isOffline, () => false);
  useEffect(() => {
    const reconnect = () => {
      bootstrapAccount()
        .then((user) => {
          if (user) connectionReturned();
          else window.location.assign('/login');
        })
        .catch(() => null);
    };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, []);
  const savedAt = useSyncExternalStore(subscribeSavedCopiesOnScreen, oldestSavedCopyOnScreen, () => 0);
  if (!offline) return null;
  return (
    <p className="offline-bar" aria-live="polite">
      <strong>You are offline.</strong>{' '}
      {savedAt
        ? `Showing the copy saved on this phone ${savedLabel(savedAt)}.`
        : 'WineLog will reconnect when your signal returns.'}
    </p>
  );
}
