import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Find a stylesheet by its file name, wherever under src/ it lives.
 *
 * Style files sit beside the screens they style (shared ones in src/styles),
 * so a test names the file and this finds it. Moving a stylesheet to a
 * different folder then needs no test changes. File names are unique.
 */
const src = join(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

/** Every stylesheet in the app: its file name, its full path and its text. */
export const styleSheets = () =>
  walk(src)
    .filter((path) => path.endsWith('.css'))
    .map((path) => ({ name: path.replaceAll('\\', '/').split('/').pop()!, path, css: readFileSync(path, 'utf8') }));

/** The text of one stylesheet, by file name such as "styles.css". */
export function readStyle(name: string) {
  const found = styleSheets().filter((sheet) => sheet.name === name);
  if (found.length !== 1) throw new Error(`Expected exactly one ${name} under src/, found ${found.length}`);
  return found[0].css;
}
