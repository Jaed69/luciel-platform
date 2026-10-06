import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlFiles, read, resolveHref, DIST } from './helpers.mjs';

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
