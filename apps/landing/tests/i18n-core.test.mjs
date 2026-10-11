import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRe, read, resolveHref } from './helpers.mjs';
import { LOCALES, DEFAULT_LOCALE, routes, route, alternates, htmlLang, ogLocale } from '../src/i18n/routes.ts';
import { en } from '../src/i18n/en.ts';
import { es } from '../src/i18n/es.ts';

const SITE = 'https://luciel.dev';
const headOf = (html) => html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '';
const headerOf = (html) => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';

// Every (page key, locale) pair that has a route, with the built file that serves it.
const builtPages = Object.keys(routes).flatMap((page) =>
  alternates(page).map(({ locale, path }) => ({ page, locale, path, file: resolveHref(path) })),
);

test('the route map keeps English at the root and exposes the default locale', () => {
  assert.deepEqual([...LOCALES], ['en', 'es']);
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(route('home', 'en'), '/');
  assert.equal(route('projects', 'en'), '/projects/');
  assert.equal(route('privacy', 'en'), '/privacy/');
  assert.equal(route('notFound', 'en'), '/404.html');
});

test('alternates lists the pages that exist per locale, English first', () => {
  const home = alternates('home');
  assert.equal(home[0].locale, 'en');
  assert.equal(home[0].path, '/');
  for (const { locale, path } of home) assert.equal(route('home', locale), path);
});

test('html lang and og:locale are defined for every locale', () => {
  assert.equal(htmlLang.en, 'en');
  assert.equal(htmlLang.es, 'es');
  assert.equal(ogLocale.en, 'en_US');
  assert.equal(ogLocale.es, 'es_PE');
});

const keyShape = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object' && !Array.isArray(child)
      ? keyShape(child, `${prefix}${key}.`)
      : [`${prefix}${key}${Array.isArray(child) ? `[${child.length}]` : ''}`],
  );

test('the Spanish dictionary has exactly the same keys (and list lengths) as the English one', () => {
  assert.deepEqual(keyShape(es), keyShape(en));
});

test('no Spanish string is left identical to English where the text is prose', () => {
  for (const key of ['shell.skip', 'shell.nav.home', 'shell.legal.privacy', 'shell.language.label']) {
    const get = (dict) => key.split('.').reduce((acc, part) => acc[part], dict);
    assert.notEqual(get(es), get(en), `${key} is not translated`);
  }
});

test('every built page declares its language in <html lang>', () => {
  for (const { locale, file, path } of builtPages) {
    assert.ok(file, `${path} is not built`);
    assert.match(read(file), new RegExp(`<html lang="${htmlLang[locale]}"`), `${path}: html lang`);
  }
});

test('every page lists hreflang alternates with absolute URLs and x-default pointing to English', () => {
  for (const { page, file, path } of builtPages) {
    const head = headOf(read(file));
    for (const { locale, path: alt } of alternates(page)) {
      assert.match(
        head,
        new RegExp(`<link rel="alternate" hreflang="${locale}" href="${escapeRe(SITE + alt)}"`),
        `${path}: hreflang ${locale}`,
      );
    }
    assert.match(
      head,
      new RegExp(`<link rel="alternate" hreflang="x-default" href="${escapeRe(SITE + route(page, 'en'))}"`),
      `${path}: x-default must point to English`,
    );
  }
});

test('canonical and og:url are the per-locale URL of the page', () => {
  for (const { page, locale, file, path } of builtPages) {
    const head = headOf(read(file));
    const url = SITE + route(page, locale);
    assert.match(head, new RegExp(`<link rel="canonical" href="${escapeRe(url)}"`), `${path}: canonical`);
    assert.match(head, new RegExp(`<meta property="og:url" content="${escapeRe(url)}"`), `${path}: og:url`);
  }
});

test('og:locale matches the page language and every other available locale is an alternate', () => {
  for (const { page, locale, file, path } of builtPages) {
    const head = headOf(read(file));
    assert.match(head, new RegExp(`<meta property="og:locale" content="${ogLocale[locale]}"`), `${path}: og:locale`);
    const others = alternates(page).filter((a) => a.locale !== locale);
    const found = [...head.matchAll(/<meta property="og:locale:alternate" content="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(found, others.map((a) => ogLocale[a.locale]), `${path}: og:locale:alternate`);
  }
});

test('the language switcher links to the equivalent page, marks the current language and lang/hreflang each link', () => {
  for (const { page, locale, file, path } of builtPages) {
    const header = headerOf(read(file));
    const options = alternates(page);
    if (options.length < 2) {
      assert.doesNotMatch(header, /class="lang"/, `${path}: no switcher without an alternate`);
      continue;
    }
    const switcher = header.match(/<nav[^>]*class="lang"[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.ok(switcher, `${path}: switcher missing`);
    for (const { locale: target, path: href } of options) {
      const link = switcher.match(new RegExp(`<a[^>]*href="${escapeRe(href)}"[^>]*>`))?.[0] ?? '';
      assert.ok(link, `${path}: no switcher link to ${href}`);
      assert.match(link, new RegExp(`lang="${target}"`), `${path}: link lang`);
      assert.match(link, new RegExp(`hreflang="${target}"`), `${path}: link hreflang`);
      assert.equal(/aria-current="true"/.test(link), target === locale, `${path}: aria-current on ${target}`);
    }
  }
});

test('header nav labels follow the page language', () => {
  for (const { page, locale, file, path } of builtPages) {
    const dict = locale === 'es' ? es : en;
    const nav = headerOf(read(file)).match(/<nav aria-label="[^"]*">[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.match(nav, new RegExp(`>${escapeRe(dict.shell.nav.home)}<`), `${path}: nav home label`);
    assert.match(nav, new RegExp(`>${escapeRe(dict.shell.nav.projects)}<`), `${path}: nav projects label`);
    assert.match(nav, new RegExp(`href="${escapeRe(route('home', locale))}"`), `${path}: nav home href`);
    assert.match(nav, new RegExp(`href="${escapeRe(route('projects', locale) ?? '')}"`), `${path}: nav projects href`);
  }
});
