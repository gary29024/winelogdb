import { useToast } from './toast';
import '../feedback.css';

/**
 * Announces the current confirmation. Always mounted, so screen readers hear a message appear in it.
 * A live region without role="status": pages have status notices of their own, and a second
 * permanent one would make "the status on this page" ambiguous.
 */
export function ToastHost() {
  const toast = useToast();
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="true">
      {toast && (
        <p className="toast" key={toast.id}>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="m4.5 10.5 3.6 3.6 7.4-8" />
          </svg>
          {toast.message}
        </p>
      )}
    </div>
  );
}
