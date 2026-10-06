export type ProjectStatus = 'live' | 'planned';

export interface Project {
  name: string;
  url?: string;
  sourceUrl?: string;
  status: ProjectStatus;
  /** Who can open `url`: 'login' means a login-only back-office. */
  access?: 'login' | 'public';
  summary: string;
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
    summary:
      'Double-entry accounting panel for a tour agency and hotel in Cusco: sales, commissions, settlements and an audit log. It is a login-only back-office for a real client, so there is no public demo; the source is on GitHub.',
    stack: ['Next.js', 'FastAPI', 'SQLite (WAL)'],
  },
  {
    name: 'rtk',
    status: 'planned',
    summary: 'Token optimizer. The next tool in line, chosen as the pilot because it has no fragile dependencies.',
    stack: [],
  },
  {
    name: 'graph',
    status: 'planned',
    summary: 'Code graph tool.',
    stack: [],
  },
  {
    name: 'hackathons',
    status: 'planned',
    summary: 'Hackathon radar.',
    stack: [],
  },
];
