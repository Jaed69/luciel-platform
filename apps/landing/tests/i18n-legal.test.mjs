import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, CONTACT_EMAIL, escapeRe, htmlFilesFor, read } from './helpers.mjs';
import { routes, alternates, route } from '../src/i18n/routes.ts';

const EMAIL_RE = escapeRe(CONTACT_EMAIL);
const rel = (p) => p.slice(DIST.length + 1);
const page = (name) => join(DIST, 'es', name, 'index.html');
const text = (html) => html.replace(/<(script|style)[^]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');

test('every English page has a Spanish twin and the other way round', () => {
  for (const key of Object.keys(routes)) {
    assert.deepEqual(alternates(key).map((a) => a.locale), ['en', 'es'], `${key} must exist in both locales`);
  }
});

test('Spanish legal pages use Spanish slugs under /es/', () => {
  assert.equal(route('privacy', 'es'), '/es/privacidad/');
  assert.equal(route('terms', 'es'), '/es/terminos/');
  assert.equal(route('contact', 'es'), '/es/contacto/');
  for (const name of ['privacidad', 'terminos', 'contacto']) {
    assert.ok(existsSync(page(name)), `dist/es/${name}/index.html is missing`);
  }
});

test('Spanish legal pages have an h1, a main landmark, lang="es" and their own canonical', () => {
  for (const [name, h1] of [['privacidad', 'Política de Privacidad'], ['terminos', 'Términos de Uso'], ['contacto', 'Contacto']]) {
    const html = read(page(name));
    assert.match(html, /<html lang="es"/, `${name}: lang`);
    assert.match(html, /<main[\s>]/, `${name}: main`);
    assert.match(html, new RegExp(`<h1[^>]*>${escapeRe(h1)}<`), `${name}: h1`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${escapeRe(`https://luciel.dev/es/${name}/`)}"`), `${name}: canonical`);
  }
});

test('every Spanish page footer links to the Spanish privacy, terms and contact pages', () => {
  for (const file of htmlFilesFor('es')) {
    const footer = read(file).match(/<footer class="foot"[\s\S]*?<\/footer>/)?.[0] ?? '';
    for (const [href, label] of [['/es/privacidad/', 'Privacidad'], ['/es/terminos/', 'Términos'], ['/es/contacto/', 'Contacto']]) {
      assert.match(footer, new RegExp(`href="${href}"[^>]*>${label}<`), `${rel(file)}: footer missing ${href}`);
    }
    assert.doesNotMatch(footer, /href="\/(privacy|terms|contact)\//, `${rel(file)}: footer links to English legal pages`);
  }
});

test('Spanish privacy policy covers logs, cookies, AdSense as planned, Ley N.° 29733 and rights', () => {
  const html = read(page('privacidad'));
  const t = text(html);
  assert.match(t, /Ley N\.° 29733/);
  assert.match(t, /AdSense/);
  assert.match(t, /Publicidad \(prevista\)/);
  assert.match(t, /no está activo/);
  assert.match(t, /cookies/i);
  assert.match(t, /registros de acceso/i);
  assert.match(t, /Oracle Cloud/);
  assert.match(t, /rectificación/i);
  assert.match(t, /cancelación/i);
  assert.match(t, /oposición/i);
  assert.match(t, /Última actualización: 6 de octubre de 2026/);
  assert.match(html, /href="https:\/\/policies\.google\.com\/technologies\/ads"/);
  assert.match(html, /href="https:\/\/adssettings\.google\.com"/);
  assert.match(html, new RegExp(`mailto:${EMAIL_RE}`));
});

test('Spanish terms cover ownership, warranty, liability and governing law', () => {
  const html = read(page('terminos'));
  const t = text(html);
  for (const re of [/Propiedad intelectual/, /garantía/i, /responsabilidad/i, /leyes del Perú/, /Última actualización/]) {
    assert.match(t, re);
  }
  assert.match(html, /href="\/es\/privacidad\/"/);
  assert.match(html, /href="https:\/\/github\.com\/Jaed69\/luciel-platform"/);
  assert.match(html, new RegExp(`mailto:${EMAIL_RE}`));
});

test('Spanish contact page shows the email as text and as a mailto link, with no form, and links within /es/', () => {
  const html = read(page('contacto'));
  assert.match(text(html), new RegExp(EMAIL_RE));
  assert.match(html, new RegExp(`href="mailto:${EMAIL_RE}"`));
  assert.doesNotMatch(html, /<form[\s>]/);
  assert.match(html, /<main[^]*href="\/es\/proyectos\/"[^]*<\/main>/);
  assert.match(html, /<main[^]*href="\/es\/privacidad\/"[^]*<\/main>/);
});

test('the switcher on each legal page leads to its twin and back', () => {
  for (const [key, esPath] of [['privacy', '/es/privacidad/'], ['terms', '/es/terminos/'], ['contact', '/es/contacto/']]) {
    const enPath = route(key, 'en');
    const english = read(join(DIST, enPath, 'index.html'));
    const spanish = read(join(DIST, esPath, 'index.html'));
    assert.match(english, new RegExp(`<a[^>]*href="${escapeRe(esPath)}"[^>]*hreflang="es"`));
    assert.match(spanish, new RegExp(`<a[^>]*href="${escapeRe(enPath)}"[^>]*hreflang="en"`));
  }
});

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test('the sitemap lists every Spanish page, with hreflang alternates, and still no 404', () => {
  const chunks = locs(read(join(DIST, 'sitemap.xml')));
  const xml = chunks.map((loc) => read(join(DIST, new URL(loc).pathname))).join('\n');
  const urls = locs(xml);
  for (const path of ['/es/', '/es/proyectos/', '/es/privacidad/', '/es/terminos/', '/es/contacto/']) {
    assert.ok(urls.includes(`https://luciel.dev${path}`), `sitemap is missing ${path}`);
  }
  assert.ok(!urls.some((u) => /404/.test(u)), '404 pages must not be in the sitemap');
  for (const key of ['home', 'projects', 'privacy', 'terms', 'contact']) {
    const entry = xml.match(new RegExp(`<url><loc>${escapeRe(`https://luciel.dev${route(key, 'es')}`)}</loc>[^]*?</url>`))?.[0] ?? '';
    for (const locale of ['en', 'es']) {
      assert.match(
        entry,
        new RegExp(`<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeRe(`https://luciel.dev${route(key, locale)}`)}"`),
        `${key}: sitemap alternate ${locale}`,
      );
    }
  }
});
