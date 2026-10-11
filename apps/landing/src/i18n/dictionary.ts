import type { Locale } from './routes';

interface Case {
  name: string;
  status: string;
  context: string;
  approach: string;
  /** Trusted static markup (inline <code>); rendered with set:html. */
  system: string;
  outcome: string;
}

interface Stop {
  when: string;
  title: string;
  place: string;
  text: string;
}

interface Section {
  eyebrow: string;
  heading: string;
}

/**
 * All translatable copy except the long legal prose (src/views/*). Technology names, project data and
 * colours are not translated, so they live once in src/data and in the views.
 */
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
  home: {
    title: string;
    description: string;
    role: [string, string, string];
    thesis: { before: string; em: string; after: string };
    about: [string, string, string];
    readouts: Section & { intro: string; items: { value: string; label: string; source: string }[] };
    work: Section & {
      facets: { context: string; approach: string; system: string; outcome: string };
      source: string;
      cases: [Case, Case];
    };
    trajectory: Section & { stops: [Stop, Stop, Stop, Stop, Stop, Stop] };
    stack: Section & { labels: [string, string, string, string] };
    method: Section & { principles: { title: string; text: string }[] };
    tools: Section & { live: string; planned: string; more: string };
  };
  projects: {
    title: string;
    description: string;
    eyebrow: string;
    heading: string;
    intro: { before: string; after: string };
    liveHeading: string;
    plannedHeading: string;
    statuses: { live: string; planned: string };
    loginRequired: string;
    source: string;
  };
  notFound: {
    title: string;
    description: string;
    eyebrow: string;
    heading: string;
    lead: string;
    home: string;
    projects: string;
  };
}
