// Checks the rule in scripts/check-version.mjs: a change people can see must
// raise the version number. Run by `npm test` before the site is built.
import { decide } from '../scripts/check-version.mjs';

let failures = 0;
function check(name, ok) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  version: ${name}\n`);
  if (!ok) failures += 1;
}

check('a page change without a new version fails', decide(['app/page.js'], '1.1.0', '1.1.0').ok === false);
check('a page change with a new version passes', decide(['components/Walk.js'], '1.1.0', '1.1.1').ok === true);
check('words on the site count as a visible change', decide(['content/about.json'], '1.1.0', '1.1.0').ok === false);
check('notes and tests alone need no new version', decide(['docs/bugs.md', 'README.md', 'tests/e2e.mjs'], '1.1.0', '1.1.0').ok === true);
check('the sync script alone needs no new version', decide(['scripts/immich-to-r2.mjs'], '1.1.0', '1.1.0').ok === true);
check('a lower version fails', decide(['app/page.js'], '1.2.0', '1.1.9').ok === false);
check('a new middle number passes', decide(['app/page.js'], '1.9.3', '1.10.0').ok === true);

process.exit(failures ? 1 : 0);
