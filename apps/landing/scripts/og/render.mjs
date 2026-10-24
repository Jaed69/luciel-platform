// Renders the Open Graph cards into public/og/ (and public/og-default.jpg).
// Each card is an HTML page in the home's studio identity: the hero's own plates (assets/plates/, made with the
// gen-image skill) under real type set in Roboto Flex, signed with the haloed winged-L mark.
// Headless Chrome screenshots it at 1200x630.
// Copy and data come from the i18n dictionaries and src/data/lab.ts, so a card never drifts from the page it advertises.
//
//   node scripts/og/render.mjs            (CHROME_PATH overrides the browser lookup)
//
// The cards are committed; the build only serves them, so it does not need a browser.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { en } from '../../src/i18n/en.ts';
import { es } from '../../src/i18n/es.ts';
import { ogPages, route } from '../../src/i18n/routes.ts';
import { criteria, samples } from '../../src/data/lab.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'public', 'og');
const FONTS = join(ROOT, 'node_modules', '@fontsource-variable');
const PLATES = join(ROOT, 'assets', 'plates');
const dictionaries = { en, es };

const file = (path) => pathToFileURL(path).href;
const backdrop = file(join(PLATES, 'hero-backdrop.png'));
const paperStack = file(join(PLATES, 'paper-stack.png'));
// The haloed mark (D) is the >= 64 px version; the card draws it in the hero's ink.
const mark = readFileSync(join(ROOT, 'public', 'brand', 'luciel-mark-halo.svg'), 'utf8')
  .replace(/<title>[^<]*<\/title>/, '')
  .replaceAll('#1e1c1a', 'currentColor');

// Mirrors src/styles/tokens.css and the studio colours in src/views/Home.astro.
const INK = '#eeece8';
const INK_SOFT = 'rgb(238 236 232 / 0.84)';
const STUDIO_SHADOW = '#2a2724';
const VERDICT = { met: '#3f6b2a', partial: '#855400', missing: '#a8350b', na: '#4f5a5c' };

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The lab card shows the same replayed audit as the home's lab door: the first sample's real findings. */
function receipt(locale) {
  const lp = dictionaries[locale].labPage;
  const sample = samples[0];
  const label = (id) => criteria.find((c) => c.id === id)?.label[locale] ?? id;
  const rows = sample.findings.slice(0, 5).map((f) =>
    `<li><span>${esc(label(f.criterion))}</span><b style="color:${VERDICT[f.verdict]}">${esc(lp.verdicts[f.verdict])}</b><i>${f.page ? `${lp.results.page} ${f.page}` : '—'}</i></li>`).join('');
  return `<figure class="sheet"><figcaption><b>${esc(sample.file)}</b><span>${esc(sample.title[locale])} · ${sample.pages} ${esc(lp.pages)}</span></figcaption><ol>${rows}</ol></figure>`;
}

/** One card per page in ogPages; `default` is the fallback for every other page. */
function cards(locale) {
  const t = dictionaries[locale];
  const all = {
    home: { scene: 'stack', title: 'Jhamil Peña', role: t.home.hero.role, lead: t.home.hero.lead },
    projects: { scene: 'studio', role: t.projects.eyebrow, title: t.projects.heading },
    lab: { scene: 'lab', role: t.labPage.eyebrow, title: t.labPage.heading.before + t.labPage.heading.em, object: receipt(locale) },
    contact: { scene: 'closing', title: t.home.closing.heading, lead: t.home.closing.lead },
  };
  return ogPages.map((page) => ({ page, file: `${page}.${locale}.jpg`, url: `luciel.dev${route(page, locale)}`, ...all[page] }));
}

function html({ scene, title, role, lead, object = '', url }) {
  const face = (family, path) =>
    `@font-face{font-family:'${family}';src:url('${file(join(FONTS, path))}') format('woff2');font-weight:100 1000;}`;
  const stack = scene === 'stack' ? `<img class="paper" src="${paperStack}" alt="">` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${face('Roboto Flex', 'roboto-flex/files/roboto-flex-latin-wght-normal.woff2')}
${face('Geist Mono', 'geist-mono/files/geist-mono-latin-wght-normal.woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:${STUDIO_SHADOW};color:${INK};font-family:'Roboto Flex',sans-serif;
  padding:64px 72px 56px;display:flex;flex-direction:column;justify-content:space-between}
.stage{position:absolute;inset:0;z-index:-2;overflow:hidden}
.backdrop{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 45%}
.closing .backdrop{filter:brightness(.52) contrast(1.04)}
.studio .backdrop{filter:brightness(.78)}
body::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgb(42 39 36/.55),rgb(42 39 36/.15) 55%,transparent)}
.lab::before,.lab .backdrop{display:none}
.paper{position:absolute;right:40px;bottom:-60px;height:600px;filter:drop-shadow(0 30px 40px rgb(0 0 0/.35))}
.copy{display:grid;gap:18px;max-width:${scene === 'stack' || scene === 'lab' ? 600 : 860}px}
.role{font-size:28px;font-weight:330;color:${INK_SOFT};letter-spacing:-.005em}
h1{font-size:${scene === 'stack' ? 92 : 68}px;font-weight:400;line-height:1.04;letter-spacing:-.025em}
.lead{font-size:32px;font-weight:330;line-height:1.2;color:${INK};max-width:560px}
footer{display:flex;align-items:center;gap:18px;font-size:24px;font-weight:360;color:${INK_SOFT}}
footer svg{width:64px;height:64px;color:${INK}}
.sheet{position:absolute;right:64px;top:96px;width:470px;padding:22px 26px 10px;border-radius:8px;background:#f1f2f2;color:#1d2426;
  box-shadow:0 30px 60px -30px rgb(0 0 0/.75);transform:rotate(-1.2deg)}
.sheet figcaption{display:grid;gap:4px;padding-bottom:14px;border-bottom:1px solid #c9cece}
.sheet figcaption b{font-family:'Geist Mono',monospace;font-weight:400;font-size:17px}
.sheet figcaption span{font-size:16px;color:#4f5a5c}
.sheet ol{list-style:none}
.sheet li{display:grid;grid-template-columns:1fr auto 52px;gap:16px;align-items:baseline;padding:13px 0;font-size:18px;line-height:1.3}
.sheet li+li{border-top:1px solid #dde0e0}
.sheet li b{font-size:16px;font-weight:500}
.sheet li i{font-style:normal;font-size:16px;color:#4f5a5c;text-align:right}
</style></head><body class="${scene}">
<div class="stage"><img class="backdrop" src="${backdrop}" alt="">${stack}</div>${object}
<div class="copy">${role ? `<p class="role">${esc(role)}</p>` : ''}<h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>
<footer>${mark}<span>${esc(url)}</span></footer>
</body></html>`;
}

function chrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('No Chrome/Edge found: set CHROME_PATH');
  return found;
}

const browser = chrome();
const scratch = mkdtempSync(join(tmpdir(), 'luciel-og-'));
mkdirSync(OUT, { recursive: true });

const jobs = [
  ...cards('en'),
  ...cards('es'),
  { file: '../og-default.jpg', scene: 'stack', title: 'Jhamil Peña', role: en.home.hero.role, lead: en.home.hero.lead, url: 'luciel.dev' },
];

// Every shipped raster carries its provenance: a JPEG comment segment right after the start-of-image marker.
const PROVENANCE = 'impeccable:provenance OG card rendered by scripts/og/render.mjs: real type in the site fonts over the hero plates (assets/plates/*.png, gen-image skill, Antigravity CLI).';
const stamp = (path) => {
  const jpg = readFileSync(path);
  const text = Buffer.from(PROVENANCE, 'latin1');
  const com = Buffer.concat([Buffer.from([0xff, 0xfe, (text.length + 2) >> 8, (text.length + 2) & 0xff]), text]);
  writeFileSync(path, Buffer.concat([jpg.subarray(0, 2), com, jpg.subarray(2)]));
};

try {
  for (const job of jobs) {
    const page = join(scratch, 'card.html');
    writeFileSync(page, html(job));
    execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--allow-file-access-from-files', '--virtual-time-budget=5000', '--window-size=1200,630',
      `--user-data-dir=${join(scratch, 'profile')}`, `--screenshot=${join(OUT, job.file)}`, pathToFileURL(page).href,
    ], { stdio: 'ignore' });
    stamp(join(OUT, job.file));
    console.log(`og: ${join('public/og', job.file)}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
