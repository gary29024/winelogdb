/**
 * Ask the browser to keep the app on the phone so it can start with no signal.
 *
 * /sw.js is written by the build, so only the built app has one. On the
 * development server the address answers with the page instead, the browser
 * refuses it as a script, and nothing is registered, which is what we want
 * there: a saved copy of files that change on every edit would show stale code.
 */
export function registerOfflineShell() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => null);
  });
}
