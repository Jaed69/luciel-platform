import type { Dictionary } from './dictionary';
import type { Locale } from './routes';
import { en } from './en';
import { es } from './es';

const dictionaries: Record<Locale, Dictionary> = { en, es };

export const useDictionary = (locale: Locale): Dictionary => dictionaries[locale];
