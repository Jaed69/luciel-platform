import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, read } from './helpers.mjs';

test('robots.txt allows everyone, names Mediapartners-Google and points to the sitemap', () => {
  const file = join(DIST, 'robots.txt');
  assert.ok(existsSync(file), 'dist/robots.txt is missing');
  const robots = read(file);
  assert.match(robots, /^User-agent: \*\s*\nAllow: \/\s*$/m);
  assert.match(robots, /^User-agent: Mediapartners-Google\s*\nAllow: \/\s*$/m);
  assert.doesNotMatch(robots, /Disallow:\s*\//);
  const sitemap = robots.match(/^Sitemap: (https:\/\/luciel\.dev\/\S+)$/m)?.[1];
  assert.ok(sitemap, 'no Sitemap line');
  assert.ok(existsSync(join(DIST, new URL(sitemap).pathname)), `${sitemap} does not resolve in dist`);
});

test('/sitemap.xml lists every public page and not the 404 page', () => {
  const file = join(DIST, 'sitemap.xml');
  assert.ok(existsSync(file), 'dist/sitemap.xml is missing');
  const urls = [...read(file).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const path of ['/', '/projects/', '/privacy/', '/terms/', '/contact/']) {
    assert.ok(urls.includes(`https://luciel.dev${path}`), `sitemap is missing ${path}`);
  }
  assert.ok(!urls.some((u) => /404/.test(u)), '404 must not be in the sitemap');
});

test('sitemap-index.xml also resolves and refers to a built sitemap', () => {
  const index = read(join(DIST, 'sitemap-index.xml'));
  for (const [, loc] of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    assert.ok(existsSync(join(DIST, new URL(loc).pathname)), `${loc} not built`);
  }
});
