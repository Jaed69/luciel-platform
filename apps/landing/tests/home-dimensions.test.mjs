import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DIST, htmlFiles, read } from './helpers.mjs';

const HOMES = { en: join(DIST, 'index.html'), es: join(DIST, 'es', 'index.html') };
const section = (html, attr) => html.match(new RegExp(`<section[^>]*${attr}[^]*?</section>`))?.[0] ?? '';
// The element carrying data-reading="<dimension>" up to its matching close, for flat (non-nested) blocks.
const readingsOf = (html, dimension) => [...html.matchAll(new RegExp(`<(\\w+)[^>]*data-reading="${dimension}"[^]*?</\\1>`, 'g'))].map((m) => m[0]);

test('every reading on the site is either surface or depth', () => {
  for (const page of htmlFiles()) {
    for (const [, value] of read(page).matchAll(/data-reading="([^"]*)"/g)) {
      assert.ok(value === 'surface' || value === 'depth', `${page}: unknown reading ${value}`);
    }
  }
});

test('the hero states the thesis on the surface and how the site is built underneath', () => {
  const expected = {
    en: { thesis: 'a use in the real world', build: 'This page, from below', js: '&lt; 1 kB: a clock and the dimension switch' },
    es: { thesis: 'utilidad en el mundo real', build: 'Esta página, por dentro', js: '&lt; 1 kB: un reloj y el selector de dimensión' },
  };
  for (const [locale, file] of Object.entries(HOMES)) {
    const hero = section(read(file), 'id="intro"');
    const [surface] = readingsOf(hero, 'surface');
    const depth = hero.match(/<div[^>]*data-reading="depth"[^]*<\/dl>/)?.[0] ?? '';
    assert.ok(surface?.includes(`<em>${expected[locale].thesis}</em>`), `${locale}: thesis`);
    assert.match(surface, /href="#lab"/);
    assert.match(surface, /href="#work"/);
    assert.ok(depth.includes(expected[locale].build), `${locale}: build eyebrow`);
    assert.equal((depth.match(/<dt>/g) ?? []).length, 5, `${locale}: five build facts`);
    assert.ok(depth.includes(expected[locale].js), `${locale}: client JS fact matches the readout`);
  }
});

test('the lab door has both readings, says it is coming, and links nowhere yet', () => {
  for (const [locale, file] of Object.entries(HOMES)) {
    const lab = section(read(file), 'id="lab"');
    assert.ok(lab, `${locale}: no #lab section`);
    assert.match(lab, /data-reading="surface"/);
    assert.match(lab, /data-reading="depth"/);
    assert.match(lab, locale === 'en' ? /Coming soon/ : /Próximamente/);
    assert.equal((lab.match(/<ol class="nodes">[^]*?<\/ol>/)?.[0].match(/<li>/g) ?? []).length, 5, `${locale}: five pipeline steps`);
    assert.match(lab, locale === 'en' ? /Planned:/ : /Planificado:/, `${locale}: the pipeline is labelled as planned`);
    assert.doesNotMatch(lab, /<a /, `${locale}: the lab does not exist yet, so nothing links to it`);
  }
});

test('each case reads as context and outcome on the surface, approach and system underneath', () => {
  const facets = { en: [['Context', 'Outcome'], ['Approach', 'System']], es: [['Contexto', 'Resultado'], ['Enfoque', 'Sistema']] };
  for (const [locale, file] of Object.entries(HOMES)) {
    const cards = section(read(file), 'id="work"').match(/<article[^]*?<\/article>/g) ?? [];
    assert.equal(cards.length, 2);
    for (const card of cards) {
      const [surface, depth] = facets[locale];
      // The surface facets come first in each card, then everything from the first depth reading on.
      const split = card.indexOf('data-reading="depth"');
      const surfaceBlock = card.slice(card.indexOf('data-reading="surface"'), split);
      const depthBlock = card.slice(split);
      for (const name of surface) assert.ok(surfaceBlock.includes(`>${name}<`), `${locale}: ${name} on the surface`);
      for (const name of depth) assert.ok(depthBlock.includes(`>${name}<`), `${locale}: ${name} underneath`);
      for (const name of depth) assert.ok(!surfaceBlock.includes(`>${name}<`), `${locale}: ${name} must not be on the surface`);
    }
    assert.match(cards[0], /<footer data-reading="depth"><a href="https:\/\/github\.com\/Jaed69\/luciel-platform\/tree\/main\/apps\/tours"/);
  }
});

test('the closing invites contact on the surface and points to the source underneath', () => {
  const contact = { en: '/contact/', es: '/es/contacto/' };
  for (const [locale, file] of Object.entries(HOMES)) {
    const closing = section(read(file), 'id="closing"');
    const [surface] = readingsOf(closing, 'surface');
    const [depth] = readingsOf(closing, 'depth');
    assert.ok(surface?.includes(`href="${contact[locale]}"`), `${locale}: contact link on the surface`);
    assert.ok(depth?.includes('href="https://github.com/Jaed69/luciel-platform"'), `${locale}: repo link underneath`);
  }
});
