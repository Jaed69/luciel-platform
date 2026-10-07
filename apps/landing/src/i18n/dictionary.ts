import type { Locale } from './routes';

/** Strings shared by every page: skip link, HUD header, footer, legal-page chrome. */
export interface Dictionary {
  shell: {
    skip: string;
    statusBar: string;
    depth: string;
    nav: { label: string; home: string; projects: string };
    legal: { label: string; privacy: string; terms: string; contact: string };
    language: { label: string; names: Record<Locale, string> };
    lastUpdated: string;
    defaultDescription: string;
  };
}
