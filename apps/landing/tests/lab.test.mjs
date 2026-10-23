import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, read } from './helpers.mjs';

const LABS = { en: join(DIST, 'lab', 'accreditation', 'index.html'), es: join(DIST, 'es', 'lab', 'acreditacion', 'index.html') };
const SAMPLES = ['syllabus', 'evidence', 'cv'];
const lab = (locale) => read(LABS[locale]);
const builtCss = () =>
  readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'))
    .join('\n');

test('the lab exists in English and Spanish and each links to the other', () => {
  for (const [locale, other] of [['en', '/es/lab/acreditacion/'], ['es', '/lab/accreditation/']]) {
    const html = lab(locale);
    assert.match(html, new RegExp(`<link rel="alternate" hreflang="${locale === 'en' ? 'es' : 'en'}" href="https://luciel.dev${other}"`));
    assert.match(html, /<h1>/);
  }
});

test('the first thing on the page is the form: samples and the run button come before any result', () => {
  for (const locale of ['en', 'es']) {
    const html = lab(locale);
    const at = (needle) => html.indexOf(needle);
    assert.ok(at('class="controls"') > 0 && at('class="controls"') < at('data-reading="surface"'), `${locale}: controls before the receipt`);
    assert.ok(at('id="run"') < at('data-reading="depth"'), `${locale}: run button before the machine`);
    const picks = [...html.matchAll(/<button type="button" class="pick" data-pick="([^"]+)" aria-pressed="(true|false)"/g)];
    assert.deepEqual(picks.map((m) => m[1]), SAMPLES);
    assert.deepEqual(picks.map((m) => m[2]), ['true', 'false', 'false'], `${locale}: the first sample starts selected`);
    assert.match(html, /<div class="own" aria-disabled="true">/, `${locale}: own file is announced, not offered`);
    assert.doesNotMatch(html, /<input[^>]*type="file"/, `${locale}: no file input until phase 2`);
  }
});

test('one state drives both readings', () => {
  for (const locale of ['en', 'es']) {
    const html = lab(locale);
    assert.match(html, /<div id="lab" class="lab-app" data-state="idle" data-sample="syllabus" data-step="0" data-msgs="/);
    assert.match(html, /<section data-reading="surface" class="receipt"/);
    assert.match(html, /<section data-reading="depth" class="machine"/);
    assert.match(html, /<p id="lab-status" class="sr" role="status" aria-live="polite">/);
    const msgs = JSON.parse(html.match(/data-msgs="([^"]*)"/)[1].replaceAll('&quot;', '"'));
    assert.equal(msgs.length, 7, `${locale}: idle + five steps + done`);
  }
});

test('every sample carries a full run: five log lines, five inspector lines and six findings', () => {
  for (const locale of ['en', 'es']) {
    const html = lab(locale);
    for (const sample of SAMPLES) {
      assert.equal((html.match(new RegExp(`<code class="ln at-\\d" data-s="${sample}"`, 'g')) ?? []).length, 5, `${locale}/${sample}: log`);
      assert.equal((html.match(new RegExp(`<code class="in at-\\d" data-s="${sample}"`, 'g')) ?? []).length, 5, `${locale}/${sample}: inspector`);
      const table = html.match(new RegExp(`<table data-s="${sample}">[^]*?</table>`))?.[0] ?? '';
      assert.equal((table.match(/<tr>/g) ?? []).length, 7, `${locale}/${sample}: header + six criteria`);
    }
  }
});

test('the lab says its documents are synthetic, its criteria illustrative, and that it replays a prepared run', () => {
  assert.match(lab('en'), /Synthetic documents and illustrative criteria\. This version replays a prepared run\./);
  assert.match(lab('es'), /Documentos sintéticos y criterios ilustrativos\. Esta versión reproduce una ejecución preparada\./);
  assert.match(lab('en'), /runtime: scripted replay/);
});

test('the runner walks five steps, announces each one, and ignores input while running', () => {
  const script = lab('en').match(/<script>(\(\(\)=>\{const a=document\.getElementById\('lab'\)[^]*?)<\/script>/)?.[1];
  assert.ok(script, 'lab runner missing');
  assert.match(script, /a\.dataset\.step=\+\+s/);
  assert.match(script, /s<5\?t:/, 'stops after the fifth step');
  assert.match(script, /a\.dataset\.state='done'/);
  assert.match(script, /o\.textContent=m\[s\]/, 'announces each step');
  assert.match(script, /busy=\(\)=>a\.dataset\.state=='running'/);
  assert.equal((script.match(/if\(busy\(\)\)return/g) ?? []).length, 2, 'both sample picks and the run button wait for the run');
});

test('the CSS reveals each step in both readings and only the chosen sample', () => {
  const css = builtCss();
  for (let step = 1; step <= 5; step++) {
    assert.match(css, new RegExp(`\\[data-step=["']?${step}["']?\\] \\.node-${step}`), `node ${step} activates`);
    assert.match(css, new RegExp(`\\[data-step=["']?${step}["']?\\] \\.in\\.at-${step}`), `inspector ${step}`);
  }
  for (const sample of SAMPLES) {
    assert.match(css, new RegExp(`:not\\(\\[data-sample=["']?${sample}["']?\\]\\) \\[data-s=["']?${sample}["']?\\]`), `${sample} hides when not chosen`);
  }
  assert.match(css, /\[data-state=["']?done["']?\] \.results/);
});
