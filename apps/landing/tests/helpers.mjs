import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

export function requireDist() {
  if (!existsSync(DIST)) {
    throw new Error('dist/ is missing: run `pnpm --filter @luciel/landing build` first');
  }
}

export function htmlFiles(dir = DIST) {
  requireDist();
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

export const read = (path) => {
  requireDist();
  return readFileSync(path, 'utf8');
};

// Maps an internal href such as "/projects/" to the file Astro/nginx would serve.
export function resolveHref(href) {
  const path = href.split('#')[0].split('?')[0];
  const direct = join(DIST, path);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const index = join(DIST, path, 'index.html');
  return existsSync(index) ? index : null;
}
