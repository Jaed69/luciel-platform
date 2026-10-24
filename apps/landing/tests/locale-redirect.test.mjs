import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, htmlFiles, read } from './helpers.mjs';

const conf = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'nginx', 'nginx.conf'), 'utf8');
const rel = (p) => p.slice(DIST.length + 1);

// The root picks the language from the browser's Accept-Language header, never from the IP address,
// and a language the visitor chose in the switcher (the `lang` cookie) wins over the header.
test('nginx reads the first Accept-Language tag and lets the lang cookie override it', () => {
  const accept = conf.match(/map\s+\$http_accept_language\s+\$prefers_es\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(accept, /default\s+0;/);
  assert.match(accept, /"~\*\^\\s\*es\\b"\s+1;/, 'only a leading es tag counts as preferring Spanish');
  const root = conf.match(/map\s+"\$cookie_lang:\$prefers_es"\s+\$root_to_es\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(root, /default\s+0;/);
  assert.match(root, /":1"\s+1;/, 'no choice yet and a Spanish browser goes to /es/');
  assert.match(root, /"~\^es:"\s+1;/, 'a stored Spanish choice goes to /es/');
  assert.doesNotMatch(root, /en:/, 'a stored English choice stays on the English root');
  assert.doesNotMatch(conf, /geoip|\$remote_addr/i, 'language is never derived from the IP address');
});

test('nginx redirects only the exact root, temporarily, and varies its cache key', () => {
  const block = conf.match(/location\s+=\s+\/\s*\{[^]*?try_files[^;]*;\s*\}/)?.[0] ?? '';
  assert.match(block, /absolute_redirect\s+off;/, 'Location stays relative behind the proxy');
  assert.match(block, /add_header\s+Vary\s+"Accept-Language, Cookie"\s+always;/);
  assert.match(block, /if\s+\(\$root_to_es\)\s*\{\s*return\s+302\s+\/es\/;/);
  assert.match(block, /try_files\s+\/index\.html\s+=404;/);
  assert.equal((conf.match(/\$root_to_es\)/g) ?? []).length, 1, 'no other location redirects by language');
});

test('the language switcher remembers the choice in a first-party lang cookie', () => {
  for (const page of htmlFiles()) {
    const html = read(page);
    if (!/<nav class="lang"/.test(html)) continue;
    assert.match(html, /querySelectorAll\('\.lang a'\)/, `${rel(page)}: switcher links are wired`);
    assert.match(html, /document\.cookie='lang='\+a\.lang\+';path=\/;max-age=31536000;samesite=lax'/, `${rel(page)}: lang cookie`);
  }
});

test('the privacy policy discloses the language cookie in both languages', () => {
  const en = read(join(DIST, 'privacy', 'index.html'));
  const es = read(join(DIST, 'es', 'privacidad', 'index.html'));
  assert.doesNotMatch(en, /sets no cookies/);
  assert.doesNotMatch(es, /no establece cookies/);
  assert.match(en, /<code>lang<\/code>/);
  assert.match(es, /<code>lang<\/code>/);
  assert.match(en, /Accept-Language/);
  assert.match(es, /Accept-Language/);
});
