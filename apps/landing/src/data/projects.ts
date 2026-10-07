import type { Locale } from '../i18n/routes';

export type ProjectStatus = 'live' | 'planned';

export interface Project {
  name: string;
  url?: string;
  sourceUrl?: string;
  status: ProjectStatus;
  /** Who can open `url`: 'login' means a login-only back-office. */
  access?: 'login' | 'public';
  /** One translation per locale; the facts must be identical across them. */
  summary: Record<Locale, string>;
  stack: string[];
}

// Every statement here is sourced from README.md, apps/tours/STATUS.md or .planning/PROJECT.md.
export const projects: Project[] = [
  {
    name: 'tours',
    url: 'https://tours.luciel.dev',
    sourceUrl: 'https://github.com/Jaed69/luciel-platform/tree/main/apps/tours',
    status: 'live',
    access: 'login',
    summary: {
      en: 'Double-entry accounting panel for a tour agency and hotel in Cusco: sales, commissions, settlements and an audit log. It is a login-only back-office for a real client, so there is no public demo; the source is on GitHub.',
      es: 'Panel de contabilidad de partida doble para una agencia de turismo y hotel en Cusco: ventas, comisiones, liquidaciones y un registro de auditoría. Es un back-office con acceso solo mediante inicio de sesión para un cliente real, por lo que no hay demo pública; el código fuente está en GitHub.',
    },
    stack: ['Next.js', 'FastAPI', 'SQLite (WAL)'],
  },
  {
    name: 'rtk',
    status: 'planned',
    summary: {
      en: 'Token optimizer. The next tool in line, chosen as the pilot because it has no fragile dependencies.',
      es: 'Optimizador de tokens. La siguiente herramienta en la lista, elegida como piloto porque no tiene dependencias frágiles.',
    },
    stack: [],
  },
  {
    name: 'graph',
    status: 'planned',
    summary: { en: 'Code graph tool.', es: 'Herramienta de grafo de código.' },
    stack: [],
  },
  {
    name: 'hackathons',
    status: 'planned',
    summary: { en: 'Hackathon radar.', es: 'Radar de hackatones.' },
    stack: [],
  },
];
