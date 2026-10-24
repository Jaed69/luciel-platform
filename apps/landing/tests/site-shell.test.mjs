import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlFiles, read, resolveHref, DIST } from './helpers.mjs';
import { routes, ogPages } from '../src/i18n/routes.ts';

const rel = (p) => p.slice(DIST.length + 1);

test('dist contains built pages', () => {
  const pages = htmlFiles();
  assert.ok(pages.length > 0, 'run `pnpm --filter @luciel/landing build` first');
});

test('every page has canonical, Open Graph and Twitter tags', () => {
  const pages = htmlFiles();
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+"/, `${rel(page)}: canonical`);
    assert.match(html, /<meta property="og:title" content="[^"]+"/, `${rel(page)}: og:title`);
    assert.match(html, /<meta property="og:description" content="[^"]+"/, `${rel(page)}: og:description`);
    assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+"/, `${rel(page)}: og:image`);
    const og = html.match(/<meta property="og:image" content="https:\/\/[^"\/]+(\/[^"]*)"/);
    assert.ok(og && resolveHref(og[1]), `${rel(page)}: og:image does not exist in dist`);
    assert.match(html, /<meta property="og:url" content="https:\/\/[^"]+"/, `${rel(page)}: og:url`);
    assert.match(html, /<meta name="twitter:card" content="[^"]+"/, `${rel(page)}: twitter:card`);
  }
});

test('every internal href resolves to a built file', () => {
  const pages = htmlFiles();
  for (const page of pages) {
    const html = read(page);
    for (const [, href] of html.matchAll(/\shref="([^"]*)"/g)) {
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      assert.ok(resolveHref(href), `${rel(page)}: broken internal link ${href}`);
    }
  }
});

test('every page has a header with nav and a footer', () => {
  const pages = htmlFiles();
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<header[\s>][\s\S]*<nav[\s>][\s\S]*<\/header>/, `${rel(page)}: header/nav`);
    assert.match(html, /<footer[\s>]/, `${rel(page)}: footer`);
  }
});

test('every same-page #fragment link points to an element with that id', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, frag] of html.matchAll(/\shref="#([^"]*)"/g)) {
      if (frag === '') continue;
      assert.ok(ids.has(frag), `${rel(page)}: href="#${frag}" has no target id`);
    }
  }
});

test('shareable pages carry their own Open Graph card per locale; the rest fall back to the default', () => {
  const ogImage = (html) => html.match(/<meta property="og:image" content="https:\/\/[^"\/]+(\/[^"]*)"/)?.[1];
  for (const [page, paths] of Object.entries(routes)) {
    for (const [locale, path] of Object.entries(paths)) {
      const file = resolveHref(path);
      assert.ok(file, `${page}/${locale}: ${path} is not built`);
      const expected = ogPages.includes(page) ? `/og/${page}.${locale}.jpg` : '/og-default.jpg';
      assert.equal(ogImage(read(file)), expected, `${page}/${locale}: og:image`);
    }
  }
});

test('every page links the winged-L favicon, and the header brand draws the same mark', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    const icon = html.match(/<link rel="icon" href="([^"]+)" type="image\/svg\+xml"/);
    assert.ok(icon && resolveHref(icon[1]), `${rel(page)}: svg favicon missing or unresolved`);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/, `${rel(page)}: apple-touch-icon`);
    assert.match(html, /<a [^>]*class="brand"[^>]*>\s*<svg class="mark" viewBox="0,0,1200,1200"/, `${rel(page)}: header mark`);
  }
  assert.ok(resolveHref('/apple-touch-icon.png'), 'apple-touch-icon.png exists in dist');
});

test('the large brand marks ship as files: the plain winged L and the haloed version', () => {
  const plain = read(resolveHref('/brand/luciel-mark.svg'));
  const halo = read(resolveHref('/brand/luciel-mark-halo.svg'));
  assert.doesNotMatch(plain, /<ellipse/, 'the small-size mark has no halo');
  assert.match(halo, /<ellipse/, 'the large mark carries the halo');
});
