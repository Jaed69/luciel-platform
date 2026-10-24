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

test('the switch always names both dimensions, with a thumb under the active one', () => {
  for (const page of htmlFiles()) {
    const button = read(page).match(/<button[^>]*id="dim"[^>]*>[^]*?<\/button>/)?.[0] ?? '';
    assert.match(button, /<span class="pair" aria-hidden="true"><span class="thumb"><\/span><span class="side s">[^<]+<\/span><span class="side d">[^<]+<\/span><\/span>/, `${rel(page)}: paired sides`);
  }
  assert.match(builtCss(), /:root\[data-dimension=["']?depth["']?\] \.dim \.thumb\{transform:translateX?\(100%\)\}/);
});

test('the jump scans the new dimension in behind one line that moves on the mask clock', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.equal((html.match(/<span class="scan" aria-hidden="true"><\/span>/g) ?? []).length, 1, `${rel(page)}: one scan line`);
    assert.match(html, /<\/header>\s*<span class="scan"/, `${rel(page)}: the line sits outside the blurred header`);
  }
  const script = scripts(read(join(DIST, 'index.html'))).find((s) => s.includes("getElementById('dim')"));
  // The root's class must not be the line's own class, or the .scan rule would hide the whole page.
  assert.match(script, /r\.classList\.add\('scanning'\)/);
  assert.match(script, /\.finished\.then\(\(\)=>r\.classList\.remove\('scanning'\)\)/);
  const css = builtCss();
  assert.match(css, /:root\.scanning \.scan\{display:block\}/);
  assert.match(css, /@keyframes dim-scan-in\{0%\{[^}]*mask-position:0 100%\}to\{[^}]*mask-position:0 0\}\}/);
  assert.match(css, /@keyframes dim-scan-down\{0%\{top:0\}to\{top:calc\(100vh - 2px\)\}\}/, 'the line moves by top, on the main thread with the mask');
  assert.match(css, /::view-transition-old\(root\)\{mix-blend-mode:normal;animation:none\}/, 'the old page holds still');
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
