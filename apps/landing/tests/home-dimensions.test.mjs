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

test('the hero names the person and the job, opens the lab, and shows how the site is built underneath', () => {
  const expected = {
    en: { lead: 'I turn manual processes into systems that run.', lab: '/lab/accreditation/', contact: '/contact/', build: 'Built to be rebuilt from git.', js: '&lt; 2 kB per page: the dimension switch and the lab replay' },
    es: { lead: 'Convierto procesos manuales en sistemas que funcionan.', lab: '/es/lab/acreditacion/', contact: '/es/contacto/', build: 'Hecha para reconstruirse desde git.', js: '&lt; 2 kB por página: el selector de dimensión y la reproducción del laboratorio' },
  };
  for (const [locale, file] of Object.entries(HOMES)) {
    const hero = section(read(file), 'id="intro"');
    const stage = hero.slice(0, hero.indexOf('data-reading="depth"'));
    const depth = hero.match(/<div[^>]*data-reading="depth"[^]*<\/dl>/)?.[0] ?? '';
    assert.match(stage, /<h1[^>]*>Jhamil Peña<\/h1>/, `${locale}: name`);
    assert.ok(stage.includes(expected[locale].lead), `${locale}: lead`);
    assert.match(stage, new RegExp(`<p class="actions"><a href="${expected[locale].lab}">[^<]+</a><a href="${expected[locale].contact}">`), `${locale}: the hero opens the lab and contact`);
    assert.ok(depth.includes(expected[locale].build), `${locale}: build heading`);
    assert.equal((depth.match(/<dt>/g) ?? []).length, 5, `${locale}: five build facts`);
    assert.ok(depth.includes(expected[locale].js), `${locale}: client JS fact matches the readout`);
  }
});

test('the lab door has both readings and opens the lab; only the next experiments are coming', () => {
  for (const [locale, file] of Object.entries(HOMES)) {
    const lab = section(read(file), 'id="lab"');
    assert.ok(lab, `${locale}: no #lab section`);
    assert.match(lab, /data-reading="surface"/);
    assert.match(lab, /data-reading="depth"/);
    assert.match(lab, locale === 'en' ? /Coming soon/ : /Próximamente/);
    assert.equal((lab.match(/<ol class="nodes">[^]*?<\/ol>/)?.[0].match(/<li>/g) ?? []).length, 5, `${locale}: five pipeline steps`);
    assert.match(lab, locale === 'en' ? /Planned:/ : /Planificado:/, `${locale}: the pipeline is labelled as planned`);
    const links = [...lab.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, [locale === 'en' ? '/lab/accreditation/' : '/es/lab/acreditacion/'], `${locale}: the door links only to the lab`);
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

test('home sections are named by their headings alone, with the approved copy', () => {
  const expected = {
    en: { work: 'Two systems, built for real use.', about: 'Who builds this.', lab: 'pick a sample document' },
    es: { work: 'Dos sistemas, hechos para uso real.', about: 'Quién construye esto.', lab: 'elige un documento de ejemplo' },
  };
  for (const [locale, file] of Object.entries(HOMES)) {
    const html = read(file);
    assert.doesNotMatch(html, /<p class="eyebrow">/, `${locale}: no eyebrow labels on the home`);
    assert.match(section(html, 'id="work"'), new RegExp(`<h2 id="work-h"[^>]*>${expected[locale].work}</h2>`), `${locale}: work heading`);
    assert.ok(section(html, 'id="trajectory"').includes(expected[locale].about), `${locale}: about heading`);
    assert.ok(section(html, 'id="lab"').includes(expected[locale].lab), `${locale}: the lab offers sample documents, not uploads`);
  }
});

test('the lab door shows the sample audit it replays, each finding with the page it came from', () => {
  const expected = {
    en: { first: 'Learning outcomes are stated', verdicts: ['Met', 'Met', 'Met', 'Missing', 'Partial', 'Partial'] },
    es: { first: 'Los resultados de aprendizaje están declarados', verdicts: ['Cumple', 'Cumple', 'Cumple', 'Falta', 'Parcial', 'Parcial'] },
  };
  for (const [locale, file] of Object.entries(HOMES)) {
    const lab = section(read(file), 'id="lab"');
    const door = lab.slice(lab.indexOf('data-reading="surface"'), lab.indexOf('data-reading="depth"'));
    assert.ok(door.includes('syllabus-data-structures.pdf'), `${locale}: the sample file is named`);
    const rows = door.match(/<ol class="receipt"[^]*?<\/ol>/)?.[0].match(/<li[^]*?<\/li>/g) ?? [];
    assert.equal(rows.length, 6, `${locale}: one row per criterion`);
    assert.ok(rows[0].includes(expected[locale].first), `${locale}: criteria are named in full`);
    assert.deepEqual(rows.map((row) => row.match(/class="verdict[^"]*">([^<]+)</)?.[1]), expected[locale].verdicts, `${locale}: verdicts in order`);
    assert.deepEqual(rows.map((row) => row.match(/class="src">([^<]*)</)?.[1]), ['p. 1', 'p. 2', 'p. 3', '—', 'p. 6', 'p. 1'], `${locale}: each finding points to its page`);
    assert.doesNotMatch(door, /class="sheet"/, `${locale}: no drawn placeholder sheet`);
  }
});
