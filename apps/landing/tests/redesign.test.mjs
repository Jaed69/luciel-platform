import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, escapeRe, htmlFiles, read } from './helpers.mjs';

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

test('the built CSS self-hosts the body and mono font families with local woff2 files', () => {
  const css = cssFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const family of ['Roboto Flex Variable', 'Geist Mono Variable']) {
    assert.match(css, new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*["']?${family}`), `no @font-face for ${family}`);
  }
  assert.doesNotMatch(css, /url\(\s*["']?https?:/, 'font or asset loaded from a remote URL');
  for (const [, url] of css.matchAll(/url\(\s*["']?(\/[^"')]+\.woff2)/g)) {
    assert.ok(existsSync(join(DIST, url)), `font file ${url} missing from dist`);
  }
});

test('every page has the HUD rail with the dimension switch, and no clock or coordinates', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.match(html, /<header[^>]*class="[^"]*\bhud\b/, `${rel(page)}: HUD header`);
    assert.match(html, /<button type="button" id="dim"/, `${rel(page)}: dimension switch`);
    assert.doesNotMatch(html, /id="clock"/, `${rel(page)}: clock element`);
    assert.doesNotMatch(html, /−12\.0464|−77\.0428/, `${rel(page)}: coordinates`);
    assert.doesNotMatch(html, /America\/Lima/, `${rel(page)}: Lima time zone`);
  }
});

// The home readout promises "< 2 kB of client JavaScript on any page"; this keeps that claim true.
test('inline client script stays under 2 kB per page and nothing is loaded externally', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    assert.doesNotMatch(html, /<script[^>]*\ssrc=/, `${rel(page)}: external script`);
    const bytes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([^]*?)<\/script>/g)]
      .map((m) => Buffer.byteLength(m[1]))
      .reduce((a, b) => a + b, 0);
    assert.ok(bytes < 2048, `${rel(page)}: ${bytes} bytes of inline script`);
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

// Each dimension declares its own palette: Surface on :root, Depth on :root[data-dimension="depth"].
const DIMENSIONS = { surface: /:root\s*\{([^}]*)\}/, depth: /:root\[data-dimension="depth"\]\s*\{([^}]*)\}/ };
const block = (dimension) => {
  const m = readFileSync(tokensPath, 'utf8').match(DIMENSIONS[dimension]);
  assert.ok(m, `no token block for ${dimension}`);
  return m[1];
};
const hex = (name, dimension) => {
  const m = block(dimension).match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --color-${name} not found in ${dimension}`);
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

test('text tokens reach 4.5:1 on the ground and on surfaces in both dimensions', () => {
  assert.ok(existsSync(tokensPath));
  for (const dimension of Object.keys(DIMENSIONS)) {
    for (const bg of ['bg', 'surface', 'raise']) {
      for (const fg of ['fg', 'muted', 'faint', 'signal', 'live']) {
        const ratio = contrast(hex(fg, dimension), hex(bg, dimension));
        assert.ok(ratio >= 4.5, `${dimension}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test('Surface is light, Depth is dark, and the body has an explicit background', () => {
  assert.match(block('surface'), /color-scheme:\s*light/);
  assert.match(block('depth'), /color-scheme:\s*dark/);
  assert.match(readFileSync(tokensPath, 'utf8'), /body\s*\{[^}]*background:/);
});

test('fonts come from package specifiers, not relative paths into node_modules', () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const sources = readdirSync(srcDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(css|astro)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
  for (const file of sources) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\.\.\/node_modules\//, `${file}: relative path into node_modules`);
  }
});

test('the display font family of each dimension is declared by a built @font-face', () => {
  const css = cssFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
  const families = [...css.matchAll(/--font-display:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(new Set(families).size >= 2, 'each dimension should set its own --font-display');
  for (const family of families) {
    assert.match(css, new RegExp(String.raw`@font-face\s*\{[^}]*font-family:\s*["']?${escapeRe(family)}["']?[;}]`), `no @font-face for ${family}`);
  }
});
