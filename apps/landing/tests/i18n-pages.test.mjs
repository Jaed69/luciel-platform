import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, escapeRe, piiFindings, read, requireDist } from './helpers.mjs';
import { route } from '../src/i18n/routes.ts';
import { projects } from '../src/data/projects.ts';

const file = (...parts) => join(DIST, ...parts);
const home = () => read(file('es', 'index.html'));
const projectsPage = () => read(file('es', 'proyectos', 'index.html'));
const notFound = () => read(file('es', '404', 'index.html'));
const section = (html, attr) => html.match(new RegExp(`<section[^>]*${attr}[^]*?</section>`))?.[0] ?? '';
const cardOf = (html, name) => html.match(new RegExp(`<article[^>]*data-project="${name}"[\\s\\S]*?</article>`))?.[0] ?? '';
const headerOf = (html) => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';

test('the Spanish pages live under /es/ with Spanish slugs', () => {
  requireDist();
  assert.equal(route('home', 'es'), '/es/');
  assert.equal(route('projects', 'es'), '/es/proyectos/');
  assert.equal(route('notFound', 'es'), '/es/404/');
  for (const built of [['es', 'index.html'], ['es', 'proyectos', 'index.html'], ['es', '404', 'index.html']]) {
    assert.ok(existsSync(file(...built)), `dist/${built.join('/')} is missing`);
  }
});

test('Spanish home, projects and 404 are paired with the English pages by hreflang and the switcher', () => {
  const pairs = [
    [['index.html'], home(), '/', '/es/'],
    [['projects', 'index.html'], projectsPage(), '/projects/', '/es/proyectos/'],
    [['404.html'], notFound(), '/404.html', '/es/404/'],
  ];
  for (const [englishFile, spanish, enPath, esPath] of pairs) {
    const english = read(file(...englishFile));
    for (const html of [english, spanish]) {
      assert.match(html, new RegExp(`hreflang="en" href="${escapeRe(`https://luciel.dev${enPath}`)}"`));
      assert.match(html, new RegExp(`hreflang="es" href="${escapeRe(`https://luciel.dev${esPath}`)}"`));
      assert.match(html, new RegExp(`hreflang="x-default" href="${escapeRe(`https://luciel.dev${enPath}`)}"`));
    }
    assert.match(headerOf(english), new RegExp(`<a[^>]*href="${escapeRe(esPath)}"[^>]*hreflang="es"`));
    assert.match(headerOf(spanish), new RegExp(`<a[^>]*href="${escapeRe(enPath)}"[^>]*hreflang="en"`));
  }
});

test('Spanish pages are lang="es", canonical to /es/, og:locale es_PE with an English alternate', () => {
  for (const [html, path] of [[home(), '/es/'], [projectsPage(), '/es/proyectos/'], [notFound(), '/es/404/']]) {
    assert.match(html, /<html lang="es"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${escapeRe(`https://luciel.dev${path}`)}"`));
    assert.match(html, /<meta property="og:locale" content="es_PE"/);
    assert.match(html, /<meta property="og:locale:alternate" content="en_US"/);
  }
});

test('Spanish pages use the Spanish nav and skip link', () => {
  for (const html of [home(), projectsPage(), notFound()]) {
    const header = headerOf(html);
    assert.match(header, /<nav aria-label="Principal"/);
    assert.match(header, /<a href="\/es\/"[^>]*>Inicio<\/a>/);
    assert.match(header, /<a href="\/es\/proyectos\/"[^>]*>Proyectos<\/a>/);
    assert.match(header, /profundidad/);
    assert.match(html, /Saltar al contenido/);
    assert.match(html, /<a href="\/es\/" class="brand"/);
  }
});

test('Spanish home has the same sections, case studies and trajectory as the English home', () => {
  const html = home();
  for (const id of ['intro', 'work', 'trajectory', 'stack', 'philosophy', 'tools']) {
    assert.match(html, new RegExp(`<section[^>]*id="${id}"`), `missing section #${id}`);
  }
  assert.ok(section(html, 'aria-labelledby="proof"'), 'missing readouts section');
  assert.match(html, /<h1[^>]*>Jhamil/);
  assert.match(html, /UPC/);
  assert.equal((section(html, 'id="trajectory"').match(/class="stop"/g) ?? []).length, 6);
  const work = section(html, 'id="work"');
  assert.match(work, /<h3>tours<\/h3>/);
  assert.match(work, /Activo · solo con inicio de sesión/);
  assert.match(work, /<h3>Asistente de acreditación<\/h3>/);
  assert.match(work, /En desarrollo · proyecto de la facultad/);
  for (const facet of ['Contexto', 'Enfoque', 'Sistema', 'Resultado']) {
    assert.equal((work.match(new RegExp(`>${facet}<`, 'g')) ?? []).length, 2, `${facet} facet in both cases`);
  }
  const cards = work.match(/<article[^]*?<\/article>/g) ?? [];
  assert.equal(cards.length, 2);
  assert.match(cards[0], /href="https:\/\/github\.com\/Jaed69\/luciel-platform\/tree\/main\/apps\/tours"/);
  assert.doesNotMatch(cards[1], /<a /);
});

test('Spanish home keeps the same figures as the English home', () => {
  const readouts = section(home(), 'aria-labelledby="proof"');
  for (const fact of ['tours.luciel.dev', '>144<', '68 vitest · 76 pytest', '~90%']) {
    assert.ok(readouts.includes(fact), `readouts missing ${fact}`);
  }
  assert.match(readouts, /(&lt;|<) 1 kB/);
  assert.match(readouts, /JavaScript de cliente/);
});

test('Spanish home lists every project with its status and links to the Spanish projects page', () => {
  const tools = section(home(), 'id="tools"');
  for (const { name } of projects) assert.match(tools, new RegExp(`>${name}<`), `${name} missing`);
  assert.equal((tools.match(/Próximamente/g) ?? []).length, 3);
  assert.match(tools, />Activo</);
  assert.match(tools, /href="\/es\/proyectos\/"/);
});

test('Spanish home marks Inicio as the current page and exposes no stray PII', () => {
  const header = headerOf(home());
  assert.match(header, /<a[^>]*href="\/es\/"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/es\/"/);
  assert.doesNotMatch(header, /<a[^>]*href="\/es\/proyectos\/"[^>]*aria-current="page"/);
  assert.deepEqual(piiFindings(home()), []);
});

test('Spanish projects page mirrors the English statuses, links and notes', () => {
  const html = projectsPage();
  for (const [name, status, badge] of [
    ['tours', 'live', 'Activo'],
    ['rtk', 'planned', 'Planificado'],
    ['graph', 'planned', 'Planificado'],
    ['hackathons', 'planned', 'Planificado'],
  ]) {
    const card = cardOf(html, name);
    assert.match(card, new RegExp(`data-status="${status}"`), `${name} status`);
    assert.match(card, new RegExp(`>\\s*${badge}\\s*</span>`), `${name} badge`);
  }
  const tours = cardOf(html, 'tours');
  assert.match(tours, /href="https:\/\/tours\.luciel\.dev"/);
  assert.match(tours, /requiere inicio de sesión/);
  assert.match(tours, /Código en GitHub/);
  for (const name of ['rtk', 'graph', 'hackathons']) assert.doesNotMatch(cardOf(html, name), /<a /);
  assert.match(headerOf(html), /<a[^>]*href="\/es\/proyectos\/"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/es\/proyectos\/"/);
  assert.match(html, /<h1[^>]*>Qué está activo/);
});

test('every project has a summary in both languages and each page renders its own', () => {
  for (const project of projects) {
    assert.ok(project.summary.en.length > 0, `${project.name}: en`);
    assert.ok(project.summary.es.length > 0, `${project.name}: es`);
    assert.notEqual(project.summary.es, project.summary.en, `${project.name}: es is not translated`);
    assert.ok(cardOf(projectsPage(), project.name).includes(project.summary.es), `${project.name}: es summary rendered`);
    assert.ok(cardOf(read(file('projects', 'index.html')), project.name).includes(project.summary.en), `${project.name}: en summary rendered`);
  }
});

test('the Spanish 404 has chrome, Spanish copy and links to the Spanish home and projects', () => {
  const html = notFound();
  assert.match(html, /<footer[\s>]/);
  assert.match(html, /<h1[^>]*>Página no encontrada/);
  assert.match(html, /<main[^]*href="\/es\/"[^]*<\/main>/);
  assert.match(html, /<main[^]*href="\/es\/proyectos\/"[^]*<\/main>/);
});

test('nginx serves the Spanish 404 for unknown paths under /es/', () => {
  const conf = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'nginx', 'nginx.conf'), 'utf8');
  const es = conf.match(/location\s+\/es\/\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(es, /error_page\s+404\s+\/es\/404\/index\.html;/);
  assert.match(es, /try_files\s+\$uri\s+\$uri\/index\.html\s+=404;/);
  assert.match(conf, /location\s+=\s+\/es\/404\/index\.html\s*\{[^}]*internal;[^}]*\}/);
  assert.match(conf, /error_page\s+404\s+\/404\.html;/, 'English 404 stays the default');
});
