/**
 * Which built files the phone keeps so the app can start with no signal.
 *
 * Every script and style sheet except the heavy ones that only one screen
 * needs: the Burgundy map renderer and the per-vineyard evidence files, about
 * seven of the ten megabytes. Those are fetched when their screen is opened and
 * kept from then on, instead of being downloaded by everyone on first visit.
 */
export function shellFiles(fileNames: readonly string[]) {
  return fileNames
    .filter((name) => /\.(?:js|css)$/.test(name))
    .filter((name) => !/\.evidence-|(?:^|\/)VillageMap-/.test(name))
    .map((name) => `/${name}`)
    .sort();
}

/** Changes whenever any kept file does, because built file names carry a content hash. */
export function shellVersion(files: readonly string[]) {
  let hash = 5381;
  for (const char of files.join('|')) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/**
 * Put the file list into the service worker template. Anchored on the whole
 * statement, not the bare word, so a mention of the placeholder in a comment
 * can never be the one that gets replaced.
 */
export function fillShell(template: string, shell: { version: string; files: readonly string[] }) {
  const slot = 'const SHELL = __SHELL__;';
  if (template.split(slot).length !== 2)
    throw new Error('The service worker template must contain its SHELL slot exactly once');
  return template.replace(slot, `const SHELL = ${JSON.stringify(shell)};`);
}
