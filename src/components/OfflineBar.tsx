import { useEffect, useSyncExternalStore } from 'react';
import { bootstrapAccount } from '../lib/auth/client';
import { dataChanged } from '../lib/query/client';
import '../offline.css';

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
 * The app now opens offline, so without this an empty page would look like a
 * fault rather than a missing connection. When the signal returns the account
 * is checked again (the saved sign-in may have ended meanwhile) and every
 * screen reloads what it shows.
 */
export function OfflineBar() {
  const offline = useSyncExternalStore(subscribe, isOffline, () => false);
  useEffect(() => {
    const reconnect = () => {
      bootstrapAccount()
        .then((user) => {
          if (user) dataChanged();
          else window.location.assign('/login');
        })
        .catch(() => null);
    };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, []);
  if (!offline) return null;
  return (
    <p className="offline-bar" aria-live="polite">
      <strong>You are offline.</strong> WineLog will reconnect when your signal returns.
    </p>
  );
}
