import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';

// Vitest --changed sees imports, but not tests that inspect source with fs.
// Run this bounded set alongside affected imports whenever application source
// changes. This also covers tests whose filenames are built at runtime.
const directory = 'tests/unit';
for (const name of readdirSync(directory).filter(name => /\.test\.[cm]?[jt]sx?$/.test(name)).sort()) {
  const content = readFileSync(`${directory}/${name}`, 'utf8');
  if (/\b(readFileSync|readFile|readdirSync|readdir|globSync|glob)\b/.test(content)) process.stdout.write(`${directory}/${name}\n`);
}
