import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlFiles, read, resolveHref, DIST } from './helpers.mjs';

const pages = htmlFiles();
const rel = (p) => p.slice(DIST.length + 1);

test('dist contains built pages', () => {
  assert.ok(pages.length > 0, 'run `pnpm --filter @luciel/landing build` first');
});

test('every page has canonical, Open Graph and Twitter tags', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+"/, `${rel(page)}: canonical`);
    assert.match(html, /<meta property="og:title" content="[^"]+"/, `${rel(page)}: og:title`);
    assert.match(html, /<meta property="og:description" content="[^"]+"/, `${rel(page)}: og:description`);
    assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+"/, `${rel(page)}: og:image`);
    assert.match(html, /<meta property="og:url" content="https:\/\/[^"]+"/, `${rel(page)}: og:url`);
    assert.match(html, /<meta name="twitter:card" content="[^"]+"/, `${rel(page)}: twitter:card`);
  }
});

test('every internal href resolves to a built file', () => {
  for (const page of pages) {
    const html = read(page);
    for (const [, href] of html.matchAll(/\shref="([^"]*)"/g)) {
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      assert.ok(resolveHref(href), `${rel(page)}: broken internal link ${href}`);
    }
  }
});

test('every page has a header with nav and a footer', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<header[\s>][\s\S]*<nav[\s>][\s\S]*<\/header>/, `${rel(page)}: header/nav`);
    assert.match(html, /<footer[\s>]/, `${rel(page)}: footer`);
  }
});
