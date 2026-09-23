import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const browserSpecs = {
  wines: ['wine-flow', 'wine-detail-layout', 'lwin-review', 'lwin-edit', 'lwin-owner-status', 'journal-performance'],
  producers: ['producer-name-review'],
  achievements: ['burgundy-atlas'],
  auth: ['wine-flow'],
  cellar: ['wine-flow'],
  cuvees: ['wine-detail-layout', 'lwin-edit'],
  journey: ['wine-flow'],
  maturity: ['wine-detail-layout'],
  recognition: ['wine-flow', 'lwin-review'],
  share: ['wine-flow'],
  tastings: ['wine-flow'],
  uploads: ['wine-flow'],
};
const libraryBrowserSpecs = {
  wine: browserSpecs.wines,
  producers: ['producer-name-review', 'lwin-review'],
  cuvees: ['wine-detail-layout', 'lwin-edit'],
  recognition: browserSpecs.recognition,
  journal: ['wine-flow', 'journal-performance'],
  tastings: browserSpecs.tastings,
  cellar: browserSpecs.cellar,
  maturity: browserSpecs.maturity,
  images: ['wine-flow', 'wine-detail-layout'],
  places: ['wine-detail-layout'],
};

const full = reason => ({ reason, quality: true, platform: true, unit: 'full', sourceReaders: false, chromium: 'full', webkit: true, specs: [] });

export function chooseScope(paths, checkpoint = false) {
  if (checkpoint) return full('main, manual, or scheduled checkpoint');
  if (!paths.length) return full('empty or unreadable PR diff');
  const files = [...new Set(paths.map(path => path.replaceAll('\\', '/')).filter(Boolean))];
  if (files.every(path => path.startsWith('docs/') || path.endsWith('.md'))) {
    return { reason: 'documentation only', quality: false, platform: false, unit: 'none', sourceReaders: false, chromium: 'none', webkit: false, specs: [] };
  }

  // An import graph cannot describe changes to tooling, migrations, assets,
  // global configuration, or shared authentication and ownership boundaries.
  if (files.length > 40 || files.some(path =>
    path.startsWith('.github/') || path.startsWith('tests/unit/support/') ||
    (path.startsWith('tests/unit/') && !/\.test\.[cm]?[jt]sx?$/.test(path)) ||
    path.startsWith('src/lib/db/') || path.startsWith('src/lib/auth/') ||
    path.startsWith('src/lib/credits/') || path.startsWith('worker/multiUser/') ||
    /^worker\/(entry|index|multiUserEntry)\.ts$/.test(path) ||
    /^(package(-lock)?\.json|vitest\.config\.ts|playwright(\.iphone)?\.config\.ts|vite\.config\.ts|wrangler\.jsonc|tsconfig.*\.json|eslint\.config\.js)$/.test(path) ||
    path === 'scripts/ci-scope.mjs' || path === 'scripts/source-text-tests.mjs'
  )) return full('wide or cross-cutting change');

  let unit = 'none';
  let chromium = 'none';
  let webkit = false;
  let platform = false;
  const sourceReaders = files.some(path => path.startsWith('src/') || path.startsWith('worker/'));
  const specs = new Set();
  const selectBrowser = names => {
    if (chromium === 'full') return;
    chromium = 'selected';
    names.forEach(name => specs.add(`tests/e2e/${name}.spec.ts`));
  };
  for (const path of files) {
    if (path.startsWith('docs/') || path.endsWith('.md')) continue;
    if (path.startsWith('tests/unit/') && /\.test\.[cm]?[jt]sx?$/.test(path)) { unit = 'changed'; continue; }
    if (path.startsWith('tests/e2e/')) {
      if (/\.spec\.ts$/.test(path) && !path.endsWith('iphone-layout.spec.ts')) {
        selectBrowser([path.split('/').at(-1).replace('.spec.ts', '')]);
        if (path.endsWith('lwin-edit.spec.ts')) webkit = true;
      }
      else if (path.endsWith('iphone-layout.spec.ts')) webkit = true;
      else { chromium = 'full'; webkit = true; }
      continue;
    }
    if (path.startsWith('src/') || path.startsWith('worker/')) unit = 'changed';
    if (path.startsWith('worker/') || path.startsWith('src/lib/db/')) platform = true;
    if (path.startsWith('src/features/')) {
      const feature = path.split('/')[2];
      if (browserSpecs[feature]) selectBrowser(browserSpecs[feature]);
      else chromium = 'full';
    } else if (path.startsWith('src/lib/')) {
      const library = path.split('/')[2];
      if (libraryBrowserSpecs[library]) selectBrowser(libraryBrowserSpecs[library]);
      else if (library === 'ui') chromium = 'full';
    } else if (path.startsWith('src/components/') ||
      /^src\/(App\.|main\.|[^/]+\.css$)/.test(path) || path === 'index.html' || path.startsWith('public/')) {
      chromium = 'full';
    }
    if (/\.css$/.test(path) || path.startsWith('src/components/') || path.startsWith('src/lib/ui/') ||
      path === 'index.html' || path.startsWith('public/') || /^src\/(App|main)\./.test(path)) webkit = true;
    if (path === 'scripts/worker-runtime-smoke.mjs') platform = true;
    if (!/^(src|worker|tests|scripts|public)\//.test(path) && path !== 'index.html') {
      return full(`unclassified file: ${path}`);
    }
    if (path.startsWith('scripts/') && path !== 'scripts/worker-runtime-smoke.mjs' && path !== 'scripts/test-suite-report.mjs') {
      return full(`unclassified script: ${path}`);
    }
    if (path.startsWith('tests/')) return full(`unclassified test support: ${path}`);
  }
  return { reason: 'affected PR paths', quality: true, platform, unit, sourceReaders, chromium, webkit, specs: [...specs].sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checkpoint = process.argv.includes('--checkpoint');
  const index = process.argv.indexOf('--changed-file');
  const paths = index < 0 ? [] : readFileSync(process.argv[index + 1], 'utf8').split('\0').filter(Boolean);
  const result = chooseScope(paths, checkpoint);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(result)) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${Array.isArray(value) ? JSON.stringify(value) : value}\n`);
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### CI scope\n\n${result.reason}; unit: ${result.unit}; Chromium: ${result.chromium}; WebKit: ${result.webkit}; platform smoke: ${result.platform}.\n`);
  }
}
