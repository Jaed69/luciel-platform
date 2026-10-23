import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, htmlFiles, localeOfFile, read } from './helpers.mjs';

const rel = (p) => p.slice(DIST.length + 1);
const scripts = (html) => [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([^]*?)<\/script>/g)].map((m) => m[1]);
const builtCss = () =>
  readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'))
    .join('\n');

const NAMES = { en: 'Depth dimension', es: 'Dimensión profundidad' };

test('every page starts in Surface and restores the saved dimension before first paint', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.match(html, /<html[^>]*\sdata-dimension="surface"/, `${rel(page)}: html starts in surface`);
    const head = html.match(/<head>([^]*?)<\/head>/)?.[1] ?? '';
    const prePaint = scripts(head).find((s) => s.includes('localStorage'));
    assert.ok(prePaint, `${rel(page)}: no pre-paint script in <head>`);
    assert.match(prePaint, /dataset\.dimension='depth'/);
    assert.match(prePaint, /try\{/, 'storage access must not throw when blocked');
  }
});

test('every page has one dimension switch, named in its language, with a D hint', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    const buttons = html.match(/<button[^>]*id="dim"[^>]*>[^]*?<\/button>/g) ?? [];
    assert.equal(buttons.length, 1, `${rel(page)}: one switch`);
    assert.match(buttons[0], new RegExp(`aria-label="${NAMES[localeOfFile(page)]}"`), `${rel(page)}: localized name`);
    assert.match(buttons[0], /aria-pressed="false"/, `${rel(page)}: starts unpressed`);
    assert.match(buttons[0], /<kbd aria-hidden="true">D<\/kbd>/, `${rel(page)}: key hint`);
  }
});

test('the switch flips, persists, animates only with motion allowed, and ignores typing and modifiers', () => {
  const script = scripts(read(join(DIST, 'index.html'))).find((s) => s.includes("getElementById('dim')"));
  assert.ok(script, 'switch script missing');
  assert.match(script, /r\.dataset\.dimension=n/, 'flips html[data-dimension]');
  assert.match(script, /localStorage\.dim=n/, 'remembers the choice');
  assert.match(script, /setAttribute\('aria-pressed'/, 'reflects the state on the button');
  assert.match(script, /startViewTransition&&!matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/, 'reduced motion is a hard cut');
  assert.match(script, /addEventListener\('keydown'/);
  for (const guard of ['e.ctrlKey', 'e.metaKey', 'e.altKey', 'e.repeat', "closest('input,textarea,select,[contenteditable]')"]) {
    assert.ok(script.includes(guard), `key handler misses guard ${guard}`);
  }
});

test('only the active dimension renders its reading, and the jump respects reduced motion', () => {
  const css = builtCss();
  assert.match(css, /:root:not\(\[data-dimension=["']?depth["']?\]\) \[data-reading=["']?depth["']?\][^{]*\{[^}]*display:\s*none/);
  assert.match(css, /:root\[data-dimension=["']?depth["']?\] \[data-reading=["']?surface["']?\][^{]*\{[^}]*display:\s*none/);
  assert.match(css, /::view-transition-new\(root\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce\)\s*\{[^}]*::view-transition-old\(root\)[^}]*\{[^}]*animation:\s*none/);
});

test('the D hint is hidden on devices without hover, where there is usually no keyboard', () => {
  assert.match(builtCss(), /@media\s*\(hover:\s*none\)\s*\{[^}]*\.dim kbd\s*\{[^}]*display:\s*none/);
});

test('without JavaScript the switch is hidden instead of sitting there inert', () => {
  for (const page of htmlFiles()) {
    const head = read(page).match(/<head>([^]*?)<\/head>/)?.[1] ?? '';
    assert.match(head, /<noscript><style>\.dim\{display:none\}<\/style><\/noscript>/, `${rel(page)}: no-JS fallback`);
  }
});

test('nothing on the site is driven by scroll', () => {
  assert.doesNotMatch(builtCss(), /animation-timeline/, 'scroll-driven animation in CSS');
  for (const page of htmlFiles()) {
    for (const script of scripts(read(page))) {
      assert.doesNotMatch(script, /addEventListener\('scroll'/, `${rel(page)}: scroll listener`);
    }
  }
});
