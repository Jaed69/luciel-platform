// Renders the Open Graph cards into public/og/ (and public/og-default.jpg).
// Each card is an HTML page: an AI-generated, textless background (bg-*.jpg, made with the gen-image skill)
// under real type set in the site's own fonts and tokens. Headless Chrome screenshots it at 1200x630.
// Copy comes from the i18n dictionaries, so a card never drifts from the page it advertises.
//
//   node scripts/og/render.mjs            (CHROME_PATH overrides the browser lookup)
//
// JPEG keeps the paper texture near 60 kB per card (PNG was ~900 kB). The cards are committed; the build only serves them, so it does not need a browser.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { en } from '../../src/i18n/en.ts';
import { es } from '../../src/i18n/es.ts';
import { ogPages, route } from '../../src/i18n/routes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'public', 'og');
const FONTS = join(ROOT, 'node_modules', '@fontsource-variable');
const dictionaries = { en, es };

// Mirrors src/styles/tokens.css ("Paper & Machine").
const dimensions = {
  surface: {
    bg: pathToFileURL(join(HERE, 'bg-surface.jpg')).href, bgPlace: 'center/118% auto', // crops the table edge the art has on both sides
    fg: '#1c1a17', muted: '#5b554c', signal: '#a8350b', line: '#d8cfbf',
    display: "'Newsreader', Georgia, serif", displayWeight: 400, displayTracking: '-0.02em', size: 64,
  },
  depth: {
    bg: pathToFileURL(join(HERE, 'bg-depth.jpg')).href, bgPlace: 'right center/108% auto',
    fg: '#e8e4da', muted: '#9aa3ae', signal: '#ff6a2b', line: '#2a323d',
    display: "'Geist Mono', ui-monospace, monospace", displayWeight: 500, displayTracking: '-0.04em', size: 50,
  },
};

const em = (text) => `<em>${text}</em>`;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** One card per page in ogPages; `default` is the fallback for every other page. */
function cards(locale) {
  const t = dictionaries[locale];
  const all = {
    home: { dimension: 'surface', eyebrow: t.home.role.join(' · '), headline: t.home.thesis.before + em(t.home.thesis.em) + t.home.thesis.after },
    projects: { dimension: 'surface', eyebrow: t.projects.eyebrow, headline: t.projects.heading },
    lab: { dimension: 'depth', eyebrow: t.labPage.eyebrow, headline: t.labPage.heading.before + em(t.labPage.heading.em) },
    contact: { dimension: 'surface', eyebrow: t.home.closing.eyebrow, headline: t.home.closing.heading },
  };
  return ogPages.map((page) => ({ page, file: `${page}.${locale}.jpg`, url: `luciel.dev${route(page, locale)}`, ...all[page] }));
}

function html({ dimension, eyebrow, headline, url }) {
  const d = dimensions[dimension];
  const face = (family, file) =>
    `@font-face{font-family:'${family}';src:url('${pathToFileURL(join(FONTS, file)).href}') format('woff2');font-weight:100 900;}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${face('Newsreader', 'newsreader/files/newsreader-latin-wght-normal.woff2')}
${face('Geist', 'geist/files/geist-latin-wght-normal.woff2')}
${face('Geist Mono', 'geist-mono/files/geist-mono-latin-wght-normal.woff2')}
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:${d.fg} url('${d.bg}') ${d.bgPlace} no-repeat;color:${d.fg};font-family:'Geist',sans-serif;
  padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
.eyebrow{font-family:'Geist Mono',monospace;font-size:20px;letter-spacing:.06em;text-transform:uppercase;color:${d.muted}}
h1{font-family:${d.display};font-weight:${d.displayWeight};font-size:${d.size}px;line-height:1.08;letter-spacing:${d.displayTracking};max-width:680px;margin-top:28px}
h1 em{font-style:${dimension === 'surface' ? 'italic' : 'normal'};color:${d.signal}}
footer{display:flex;align-items:center;gap:16px;font-family:'Geist Mono',monospace;font-size:20px;color:${d.muted};border-top:1px solid ${d.line};padding-top:24px;max-width:680px}
footer b{width:12px;height:12px;background:#ff6a2b;display:inline-block}
</style></head><body>
<div><p class="eyebrow">${eyebrow}</p><h1>${headline}</h1></div>
<footer><b></b>${url}</footer>
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
  { file: '../og-default.jpg', dimension: 'surface', eyebrow: en.home.role.join(' · '), headline: capitalize(en.shell.defaultDescription.replace('luciel.dev: ', '')), url: 'luciel.dev' },
];

// Every shipped raster carries its provenance: a JPEG comment segment right after the start-of-image marker.
const PROVENANCE = 'impeccable:provenance OG card rendered by scripts/og/render.mjs: real type in the site fonts over an AI-generated, textless background (scripts/og/bg-*.jpg, gen-image skill, Antigravity CLI).';
const stamp = (file) => {
  const jpg = readFileSync(file);
  const text = Buffer.from(PROVENANCE, 'latin1');
  const com = Buffer.concat([Buffer.from([0xff, 0xfe, (text.length + 2) >> 8, (text.length + 2) & 0xff]), text]);
  writeFileSync(file, Buffer.concat([jpg.subarray(0, 2), com, jpg.subarray(2)]));
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
