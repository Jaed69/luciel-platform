import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, CONTACT_EMAIL, escapeRe, htmlFiles, piiFindings, read } from './helpers.mjs';
const EMAIL_RE = escapeRe(CONTACT_EMAIL);

const rel = (p) => p.slice(DIST.length + 1);
const page = (name) => join(DIST, name, 'index.html');
const text = (html) => html.replace(/<(script|style)[^]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');

test('privacy, terms and contact pages are built with an h1 and a main landmark', () => {
  for (const [name, h1] of [['privacy', /Privacy/], ['terms', /Terms/], ['contact', /Contact/]]) {
    assert.ok(existsSync(page(name)), `dist/${name}/index.html is missing`);
    const html = read(page(name));
    assert.match(html, /<main[\s>]/, `${name}: main`);
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${h1.source}`), `${name}: h1`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${escapeRe(`https://luciel.dev/${name}/`)}"`), `${name}: canonical`);
  }
});

test('every page footer links to privacy, terms and contact', () => {
  for (const file of htmlFiles()) {
    const footer = read(file).match(/<footer class="foot"[\s\S]*?<\/footer>/)?.[0] ?? '';
    for (const href of ['/privacy/', '/terms/', '/contact/']) {
      assert.match(footer, new RegExp(`href="${href}"`), `${rel(file)}: footer missing ${href}`);
    }
  }
});

test('privacy policy covers logs, cookies, AdSense, Law 29733 and rights', () => {
  const t = text(read(page('privacy')));
  assert.match(t, /Law No\. 29733/);
  assert.match(t, /AdSense/);
  assert.match(t, /cookies/i);
  assert.match(t, /access log/i);
  assert.match(t, /Oracle Cloud/);
  assert.match(t, /rectification/i);
  assert.match(t, /Last updated/);
  const html = read(page('privacy'));
  assert.match(html, /href="https:\/\/policies\.google\.com\/technologies\/ads"/);
  assert.match(html, /href="https:\/\/adssettings\.google\.com"/);
  assert.match(html, new RegExp(`mailto:${EMAIL_RE}`));
});

test('terms cover ownership, warranty, liability and governing law', () => {
  const t = text(read(page('terms')));
  for (const re of [/Intellectual property/i, /warranty/i, /liability/i, /Peru/, /Last updated/]) {
    assert.match(t, re);
  }
});

test('contact page shows the email as text and as a mailto link, with no form', () => {
  const html = read(page('contact'));
  assert.match(text(html), new RegExp(EMAIL_RE));
  assert.match(html, new RegExp(`href="mailto:${EMAIL_RE}"`));
  assert.doesNotMatch(html, /<form[\s>]/);
});

test('only the published contact email appears anywhere; no other email or phone number', () => {
  for (const file of htmlFiles()) {
    assert.deepEqual(piiFindings(read(file)), [], `${rel(file)}: PII-like content`);
  }
});

test('the PII guard rejects other emails and phone numbers', () => {
  assert.deepEqual(piiFindings(`<p>${CONTACT_EMAIL}</p>`), []);
  assert.deepEqual(piiFindings('<p>x@example.com</p>'), ['email-like string']);
  assert.deepEqual(piiFindings(`<p>${CONTACT_EMAIL} and other.person@luciel.dev</p>`), ['email-like string']);
  assert.deepEqual(piiFindings('<p>+51 987 654 321</p>'), ['phone-like number']);
});

test('the PII guard still scans meta descriptions', () => {
  const meta = (name, content) => `<meta name="${name}" content="${content}">`;
  assert.deepEqual(piiFindings(meta('description', 'write me: x@example.com')), ['email-like string']);
  assert.deepEqual(piiFindings(`<meta property="og:description" content="call +51 987 654 321">`), ['phone-like number']);
  assert.deepEqual(piiFindings(meta('twitter:description', 'x@example.com')), ['email-like string']);
  assert.deepEqual(piiFindings(meta('description', 'A plain description')), []);
  assert.deepEqual(piiFindings(meta('description', `mail ${CONTACT_EMAIL}`)), []);
  assert.deepEqual(piiFindings('<link rel="canonical" href="https://luciel.dev/a@b.co/">'), []);
});

test('the PII guard allows only the exact standalone contact address', () => {
  assert.deepEqual(piiFindings(`<p>${CONTACT_EMAIL}.</p>`), []);
  assert.deepEqual(piiFindings(`<a href="mailto:${CONTACT_EMAIL}">x</a>`), []);
  assert.deepEqual(piiFindings(`<p>x${CONTACT_EMAIL}</p>`), ['email-like string']);
  assert.deepEqual(piiFindings(`<p>${CONTACT_EMAIL}.evil</p>`), ['email-like string']);
  assert.deepEqual(piiFindings(`<p>${CONTACT_EMAIL}m</p>`), ['email-like string']);
});

test('escapeRe makes a literal pattern', () => {
  assert.match('a.b', new RegExp(`^${escapeRe('a.b')}$`));
  assert.doesNotMatch('axb', new RegExp(`^${escapeRe('a.b')}$`));
});
