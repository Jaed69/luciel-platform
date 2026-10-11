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

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const distPath = (loc) => join(DIST, new URL(loc).pathname);

test('/sitemap.xml is a sitemap index whose entries all exist in dist', () => {
  const file = join(DIST, 'sitemap.xml');
  assert.ok(existsSync(file), 'dist/sitemap.xml is missing');
  const xml = read(file);
  assert.match(xml, /<sitemapindex[\s>]/, 'sitemap.xml must be a sitemapindex');
  const chunks = locs(xml);
  assert.ok(chunks.length > 0, 'sitemap index lists no sitemap');
  for (const loc of chunks) assert.ok(existsSync(distPath(loc)), `${loc} not built`);
});

test('the sitemap chunks together list every public page and not the 404 page', () => {
  const chunks = locs(read(join(DIST, 'sitemap.xml')));
  assert.ok(chunks.length > 0, 'sitemap index lists no sitemap');
  const urls = chunks.flatMap((loc) => locs(read(distPath(loc))));
  for (const path of ['/', '/projects/', '/privacy/', '/terms/', '/contact/']) {
    assert.ok(urls.includes(`https://luciel.dev${path}`), `sitemap is missing ${path}`);
  }
  assert.ok(!urls.some((u) => /404/.test(u)), '404 must not be in the sitemap');
});

test('sitemap-index.xml and sitemap.xml are identical and refer to built sitemaps', () => {
  const index = read(join(DIST, 'sitemap-index.xml'));
  assert.equal(read(join(DIST, 'sitemap.xml')), index);
  const entries = locs(index);
  assert.ok(entries.length > 0, 'sitemap-index.xml has no <loc>');
  for (const loc of entries) assert.ok(existsSync(distPath(loc)), `${loc} not built`);
});
