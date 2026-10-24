// Single source of truth for locales and for where each page lives in each locale.
// English is the default locale and stays at the root; Spanish lives under /es/ with Spanish slugs.
// Keep this file free of runtime-only syntax (enums, decorators): node:test imports it directly.

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type PageKey = 'home' | 'projects' | 'lab' | 'privacy' | 'terms' | 'contact' | 'notFound';

/** A page may be missing in a locale; the switcher, nav and hreflang only list what exists. */
export const routes: Record<PageKey, Partial<Record<Locale, string>>> = {
  home: { en: '/', es: '/es/' },
  projects: { en: '/projects/', es: '/es/proyectos/' },
  lab: { en: '/lab/accreditation/', es: '/es/lab/acreditacion/' },
  privacy: { en: '/privacy/', es: '/es/privacidad/' },
  terms: { en: '/terms/', es: '/es/terminos/' },
  contact: { en: '/contact/', es: '/es/contacto/' },
  notFound: { en: '/404.html', es: '/es/404/' },
};

/** Pages worth sharing get their own Open Graph card, rendered by scripts/og/render.mjs; the rest use /og-default.jpg. */
export const ogPages: readonly PageKey[] = ['home', 'projects', 'lab', 'contact'];

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
