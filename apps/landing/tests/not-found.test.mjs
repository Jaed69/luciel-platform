import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, read, requireDist } from './helpers.mjs';

const pagePath = () => join(DIST, '404.html');

test('404.html is built with header, nav, footer and a link home', () => {
  requireDist();
  assert.ok(existsSync(pagePath()), 'dist/404.html is missing');
  const html = read(pagePath());
  assert.match(html, /<header[^]*<nav[^]*<\/header>/);
  assert.match(html, /<footer[\s>]/);
  assert.match(html, /<main[^]*href="\/"[^]*<\/main>/, 'main content should link home');
  assert.match(html, /<main[^]*href="\/projects\/"[^]*<\/main>/, 'main content should link to projects');
});

test('nginx serves /404.html for missing paths', () => {
  const conf = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'nginx', 'nginx.conf'), 'utf8');
  assert.match(conf, /error_page\s+404\s+\/404\.html;/);
});
