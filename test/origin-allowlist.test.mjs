// WHAT:       Proves the broker's forward allowlist accepts EnterpriseDS app origins and
//             refuses everything else -- read out of the SHIPPED public/index.html, not a copy.
// WHY:        That regex is the only thing standing between a forged `state` and an open
//             redirect that leaks a Google auth code. It shipped untested, and it had to be
//             widened for Azure Container Apps (apps move off Static Web Apps because the
//             SWA Free plan caps at 10 apps per subscription). A security control that is
//             edited without a test is the control that rots.
// SUPERSEDES: nothing
// SUPERSEDED-BY: nothing -- current
// EVIDENCE:   deventerpriseds-org/eds-claude-skills docs/qc-evidence/FEASIBILITY-azure-container-apps.md
//             and .claude/skills/create-github-repo.md (Deployment target section)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HTML = fileURLToPath(new URL('../public/index.html', import.meta.url));

/**
 * Pull the live regex out of the page itself. If the marker or the literal moves, this
 * throws rather than silently testing a stale copy of the pattern -- the difference
 * between a guard and the appearance of one.
 */
function allowlistFromShippedPage() {
  const src = readFileSync(HTML, 'utf8');
  const lines = src.split('\n');
  const markerAt = lines.findIndex((l) => l.includes('ALLOWLIST-REGEX'));
  assert.notStrictEqual(markerAt, -1, 'ALLOWLIST-REGEX marker missing from public/index.html');
  const decl = lines[markerAt + 1];
  const literal = /\/(\^.*\$)\/([a-z]*)\s*;\s*$/.exec(decl.trim());
  assert.ok(literal, `line after the marker is not an anchored regex literal: ${decl}`);
  return new RegExp(literal[1], literal[2]);
}

const ALLOWED = allowlistFromShippedPage();

test('accepts Static Web App origins -- the shape every existing app uses', () => {
  // The broker's own URL, from the enterpriseds-azure-deploy skill.
  assert.ok(ALLOWED.test('https://proud-hill-09accd00f.7.azurestaticapps.net'));
  assert.ok(ALLOWED.test('https://enterpriseds-mail-web.1.azurestaticapps.net'));
});

test('accepts Container Apps origins -- the reason this was widened', () => {
  assert.ok(ALLOWED.test('https://sidecar.kindsky-1a2b3c4d.eastus.azurecontainerapps.io'));
  assert.ok(ALLOWED.test('https://my-app.abc123.westeurope.azurecontainerapps.io'));
});

test('refuses an unrelated host', () => {
  assert.ok(!ALLOWED.test('https://evil.com'));
  assert.ok(!ALLOWED.test('https://accounts.google.com'));
});

test('refuses a host that only CONTAINS an allowed suffix -- the anchoring cases', () => {
  // Suffix in a PATH. `/` is not in the character class, and `$` closes the match.
  assert.ok(!ALLOWED.test('https://evil.com/.azurestaticapps.net'));
  assert.ok(!ALLOWED.test('https://evil.com/x.y.azurecontainerapps.io'));
  // Allowed suffix as a LEFT-hand label of an attacker domain.
  assert.ok(!ALLOWED.test('https://x.1.azurestaticapps.net.evil.com'));
  assert.ok(!ALLOWED.test('https://a.b.azurecontainerapps.io.evil.com'));
  // Fragment and query cannot smuggle it either.
  assert.ok(!ALLOWED.test('https://evil.com#.azurecontainerapps.io'));
  assert.ok(!ALLOWED.test('https://evil.com?x=.1.azurestaticapps.net'));
});

test('refuses plaintext http, so a code is never forwarded in the clear', () => {
  assert.ok(!ALLOWED.test('http://proud-hill-09accd00f.7.azurestaticapps.net'));
  assert.ok(!ALLOWED.test('http://a.b.azurecontainerapps.io'));
});

test('refuses the bare platform suffixes and too-short hosts', () => {
  assert.ok(!ALLOWED.test('https://azurecontainerapps.io'));
  assert.ok(!ALLOWED.test('https://azurestaticapps.net'));
  // One label before the container suffix is not a real app FQDN.
  assert.ok(!ALLOWED.test('https://solo.azurecontainerapps.io'));
});

test('does not accidentally widen the Static Web App branch', () => {
  // The SWA middle label is digits. Keeping that strict was a deliberate non-change:
  // this asserts the widening did not leak across branches.
  assert.ok(!ALLOWED.test('https://name.notdigits.azurestaticapps.net'));
  assert.ok(!ALLOWED.test('https://a.b.c.azurestaticapps.net'));
});

test('refuses a credentialed authority', () => {
  assert.ok(!ALLOWED.test('https://user@evil.com'));
  assert.ok(!ALLOWED.test('https://evil.com@a.b.azurecontainerapps.io'));
});
