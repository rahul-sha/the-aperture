// Reads the newest entry in docs/sync-changelog.md for the sync image build.
//   node scripts/sync-release.mjs version   prints the version, e.g. 1.1.0
//   node scripts/sync-release.mjs notes     prints that version's notes
// It stops with an error if the newest heading is not "## X.Y.Z (date)", so a
// mistyped entry fails the pull request check instead of the release.
import { readFileSync } from 'node:fs';

const file = new URL('../docs/sync-changelog.md', import.meta.url);
const text = readFileSync(file, 'utf8');
const sections = text.split(/^## /m).slice(1);
const match = sections[0]?.match(/^(\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)\s*\n/);
if (!match) {
  console.error('docs/sync-changelog.md: the newest entry must start with "## 1.2.3 (YYYY-MM-DD)".');
  process.exit(1);
}

const what = process.argv[2];
if (what === 'version') {
  console.log(match[1]);
} else if (what === 'notes') {
  console.log(sections[0].slice(match[0].length).trim());
} else {
  console.error('Usage: node scripts/sync-release.mjs version|notes');
  process.exit(1);
}
