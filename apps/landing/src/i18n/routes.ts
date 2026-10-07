// Single source of truth for locales and for where each page lives in each locale.
// English is the default locale and stays at the root; Spanish lives under /es/ with Spanish slugs.
// Keep this file free of runtime-only syntax (enums, decorators): node:test imports it directly.

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type PageKey = 'home' | 'projects' | 'privacy' | 'terms' | 'contact' | 'notFound';

/** A page may be missing in a locale; the switcher, nav and hreflang only list what exists. */
export const routes: Record<PageKey, Partial<Record<Locale, string>>> = {
  home: { en: '/' },
  projects: { en: '/projects/' },
  privacy: { en: '/privacy/' },
  terms: { en: '/terms/' },
  contact: { en: '/contact/' },
  notFound: { en: '/404.html' },
};

export const htmlLang: Record<Locale, string> = { en: 'en', es: 'es' };
export const ogLocale: Record<Locale, string> = { en: 'en_US', es: 'es_PE' };

export function route(page: PageKey, locale: Locale): string | undefined {
  return routes[page][locale];
}

/** Every locale in which `page` exists, in LOCALES order (English first). */
export function alternates(page: PageKey): { locale: Locale; path: string }[] {
  return LOCALES.flatMap((locale) => {
    const path = routes[page][locale];
    return path ? [{ locale, path }] : [];
  });
}
