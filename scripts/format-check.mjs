// Keeps the formatter's ground once it has been won.
//
// Most of this codebase predates the formatter and is written as long single
// lines. Reformatting all of it in one go would touch every file at once and
// break the tests that read source as text, so it is adopted file by file:
//
//   1. Every path listed in scripts/formatted-files.txt must be formatted.
//   2. With --base <commit>, every code file ADDED since that commit must be
//      formatted too, so new files start out readable.
//
// Format a file with `npm run format -- <path>`, then add it to the list.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { check, getFileInfo, resolveConfig } from 'prettier';

const LIST = 'scripts/formatted-files.txt';
const CODE = /\.(ts|tsx|mjs|js|css)$/;

const listed = readFileSync(LIST, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const baseAt = process.argv.indexOf('--base');
const base = baseAt === -1 ? '' : (process.argv[baseAt + 1] ?? '');
// A pull request build is a shallow checkout with no shared history, where the
// three-dot form cannot find a merge base; comparing the two commits directly
// gives the same answer there, because the build's HEAD is the merge result.
function addedSince(commit) {
  const diff = (range) =>
    execFileSync('git', ['diff', '--name-only', '--diff-filter=A', ...range], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  let names;
  try {
    names = diff([`${commit}...HEAD`]);
  } catch {
    names = diff([commit, 'HEAD']);
  }
  return names.split('\n').filter((path) => CODE.test(path));
}
const added = base ? addedSince(base) : [];

const missing = listed.filter((path) => !existsSync(path));
const unformatted = [];
for (const path of new Set([...listed, ...added])) {
  if (!existsSync(path)) continue;
  const info = await getFileInfo(path, { ignorePath: '.prettierignore' });
  if (info.ignored || !info.inferredParser) continue;
  const options = (await resolveConfig(path)) ?? {};
  if (!(await check(readFileSync(path, 'utf8'), { ...options, filepath: path }))) unformatted.push(path);
}

const say = (line) => process.stderr.write(`${line}\n`);
if (missing.length) say(`Listed in ${LIST} but not found:\n  ${missing.join('\n  ')}`);
if (unformatted.length) {
  say(`Not formatted:\n  ${unformatted.join('\n  ')}\n\nFix with: npm run format -- ${unformatted.join(' ')}`);
}
if (missing.length || unformatted.length) process.exit(1);
process.stdout.write(`Formatting holds for ${listed.length} listed and ${added.length} newly added file(s).\n`);
