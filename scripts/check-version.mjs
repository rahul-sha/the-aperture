// The version rule: a pull request that changes what visitors see must raise
// the version in package.json (last number for a fix, middle for a feature,
// first for a redesign). `npm test` runs this before building the site.
// It compares this branch with main; on main itself there is nothing to check.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Files that change what visitors see. Notes, tests, and the sync script do not.
const VISIBLE = [/^app\//, /^components\//, /^lib\//, /^content\//, /^public\//, /^next\.config\.mjs$/];

function newer(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

export function decide(changed, mainVersion, branchVersion) {
  const visible = changed.filter((f) => VISIBLE.some((re) => re.test(f)));
  if (!visible.length) return { ok: true, why: 'No visible changes, so the version can stay.' };
  if (newer(branchVersion, mainVersion)) return { ok: true, why: `Version raised from ${mainVersion} to ${branchVersion}.` };
  return {
    ok: false,
    why: `These files change what visitors see, but the version in package.json is still ${branchVersion} (main has ${mainVersion}): ${visible.slice(0, 5).join(', ')}. Raise it: last number for a fix, middle for a feature, first for a redesign.`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let base;
  try { base = git('merge-base HEAD origin/main'); } catch {
    console.log('Version check skipped: main is not available here (run `git fetch origin main`).');
    process.exit(0);
  }
  const changed = [
    ...git(`diff --name-only ${base}`).split('\n'),
    ...git('ls-files --others --exclude-standard').split('\n'),
  ].filter(Boolean);
  const mainVersion = JSON.parse(git(`show ${base}:package.json`)).version;
  const branchVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const result = decide(changed, mainVersion, branchVersion);
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  version: ${result.why}`);
  process.exit(result.ok ? 0 : 1);
}
