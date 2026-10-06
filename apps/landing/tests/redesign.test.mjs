import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, htmlFiles, read } from './helpers.mjs';

const rel = (p) => p.slice(DIST.length + 1);
const tokensPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'tokens.css');

test('no page loads fonts from Google', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/, `${rel(page)}: references Google Fonts`);
  }
});

const cssFiles = (dir = DIST) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? cssFiles(p) : e.name.endsWith('.css') ? [p] : [];
  });

test('the built CSS self-hosts the three font families with local woff2 files', () => {
  const css = cssFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const family of ['Bricolage Grotesque', 'IBM Plex Sans', 'JetBrains Mono']) {
    assert.match(css, new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*["']?${family}`), `no @font-face for ${family}`);
  }
  assert.doesNotMatch(css, /url\(\s*["']?https?:/, 'font or asset loaded from a remote URL');
  for (const [, url] of css.matchAll(/url\(\s*["']?(\/[^"')]+\.woff2)/g)) {
    assert.ok(existsSync(join(DIST, url)), `font file ${url} missing from dist`);
  }
});

test('every page has the HUD rail with clock and depth readouts', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.match(html, /<header[^>]*class="[^"]*\bhud\b/, `${rel(page)}: HUD header`);
    assert.match(html, /id="clock"/, `${rel(page)}: clock element`);
    assert.match(html, /id="depth"/, `${rel(page)}: depth element`);
    assert.match(html, /−12\.0464 −77\.0428/, `${rel(page)}: coordinates`);
    assert.match(html, /America\/Lima/, `${rel(page)}: Lima time zone`);
  }
});

test('inline client script stays under 1 kB per page and nothing is loaded externally', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.doesNotMatch(html, /<script[^>]*\ssrc=/, `${rel(page)}: external script`);
    const bytes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([^]*?)<\/script>/g)]
      .map((m) => Buffer.byteLength(m[1]))
      .reduce((a, b) => a + b, 0);
    assert.ok(bytes < 1024, `${rel(page)}: ${bytes} bytes of inline script`);
  }
});

test('nothing is hidden at rest with opacity 0', () => {
  const hides = /opacity\s*:\s*0(?![.\d])/;
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.doesNotMatch(html, hides, `${rel(page)}: opacity 0 in markup or inline style`);
  }
  for (const css of cssFiles()) {
    assert.doesNotMatch(readFileSync(css, 'utf8'), hides, `${rel(css)}: opacity 0 in stylesheet`);
  }
});

const hex = (name) => {
  const css = readFileSync(tokensPath, 'utf8');
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --color-${name} not found`);
  return m[1];
};
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('text tokens reach 4.5:1 on the ground and on surfaces', () => {
  assert.ok(existsSync(tokensPath));
  for (const bg of ['bg', 'surface', 'raise']) {
    for (const fg of ['fg', 'muted', 'faint', 'amber', 'rust', 'ochre', 'moss', 'wine', 'sage']) {
      const ratio = contrast(hex(fg), hex(bg));
      assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the site is dark only with an explicit body background', () => {
  const css = readFileSync(tokensPath, 'utf8');
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /body\s*\{[^}]*background:/);
});
