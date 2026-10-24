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
    /** The global Surface/Depth switch. `toggle` is the button name; it stays fixed while aria-pressed flips. */
    dimension: { surface: string; depth: string; toggle: string };
    /** `home` names the brand link; the visible links are the home's work section, the lab, projects and contact. */
    nav: { label: string; home: string; work: string; lab: string; projects: string; contact: string };
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
    /**
     * The image-led first viewport. Every card states a whole fact; `booking` is one fictitious tour booking,
     * the fields the paper stack turns into, so the demo reads as data and never as real client records.
     */
    hero: {
      role: string;
      lead: string;
      actions: { lab: string; contact: string };
      cards: { tours: string; lab: string; caching: { name: string; text: string } };
      booking: { label: string; fields: { label: string; value: string }[] };
    };
    /** Hero calls to action (same-page anchors). */
    jump: { lab: string; work: string };
    /** Depth reading of the hero: how this site itself is built. Every fact must stay true. */
    build: Section & { facts: { label: string; value: string }[] };
    lab: Section & {
      lead: string;
      open: string;
      status: string;
      privacy: string;
      next: { name: string; text: string }[];
      /** Depth reading: the pipeline the lab will show. Planned, and labelled as such. */
      pipeline: Section & { steps: { name: string; text: string }[]; note: string };
    };
    aboutHeading: Section;
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
    closing: Section & { lead: string; contact: string; depthHeading: string; depthLead: string; source: string };
  };
  labPage: {
    title: string;
    description: string;
    eyebrow: string;
    heading: { before: string; em: string };
    lead: string;
    samples: string;
    pages: string;
    own: { title: string; text: string };
    run: string;
    again: string;
    running: string;
    illustrative: string;
    steps: [string, string, string, string, string];
    /** aria-live messages: idle, one per step, then done. */
    status: [string, string, string, string, string, string, string];
    results: { heading: string; criterion: string; verdict: string; source: string; page: string };
    verdicts: { met: string; partial: string; missing: string; na: string };
    depth: { eyebrow: string; stream: string; inspector: string; idle: string; replay: string };
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
