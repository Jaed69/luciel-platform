import type { Locale } from '../i18n/routes';

/*
  Phase 1 of the accreditation lab replays prepared runs. Everything here is illustrative:
  the criteria are generic (not any real accreditation framework) and the documents are synthetic.
  Log and inspector lines are machine output, so they stay in English in both locales.
*/

type Text = Record<Locale, string>;

export type Verdict = 'met' | 'partial' | 'missing' | 'na';

export interface Criterion {
  id: string;
  label: Text;
}

export interface Finding {
  criterion: string;
  verdict: Verdict;
  /** Page the evidence was found on; absent when nothing was found. */
  page?: number;
  note: Text;
}

export interface Sample {
  id: string;
  file: string;
  title: Text;
  pages: number;
  /** One log line per pipeline step, in order: read, convert, analyze, audit, report. */
  log: [string, string, string, string, string];
  /** What the inspector shows while each step runs. */
  inspect: [string, string, string, string, string];
  findings: Finding[];
}

export const STEPS = ['read', 'convert', 'analyze', 'audit', 'report'] as const;

export const criteria: Criterion[] = [
  { id: 'C1', label: { en: 'Learning outcomes are stated', es: 'Los resultados de aprendizaje están declarados' } },
  { id: 'C2', label: { en: 'Outcomes map to program objectives', es: 'Los resultados se alinean con los objetivos del programa' } },
  { id: 'C3', label: { en: 'Assessment methods are described', es: 'Se describen los métodos de evaluación' } },
  { id: 'C4', label: { en: 'Student work is evidenced', es: 'Hay evidencia de trabajo de estudiantes' } },
  { id: 'C5', label: { en: 'Improvement actions are recorded', es: 'Se registran acciones de mejora' } },
  { id: 'C6', label: { en: 'Instructor qualifications are documented', es: 'Se documenta la calificación del docente' } },
];

export const samples: Sample[] = [
  {
    id: 'syllabus',
    file: 'syllabus-data-structures.pdf',
    title: { en: 'Course syllabus · Data Structures', es: 'Sílabo del curso · Estructuras de Datos' },
    pages: 6,
    log: [
      '[read]     6 pages · text layer found',
      '[convert]  no OCR needed · 2 tables kept as rows',
      '[analyze]  phase 1/2 · classified as course syllabus',
      '[audit]    6 criteria checked · 3 met · 2 partial · 1 missing',
      '[report]   every finding links back to its page',
    ],
    inspect: [
      '{ pages: 6, text_layer: true }',
      '{ chunks: 14, tables: 2 }',
      '{ doc_type: "syllabus", confidence: 0.94 }',
      '{ criterion: "C4", verdict: "missing", searched: 14 }',
      '{ met: 3, partial: 2, missing: 1 }',
    ],
    findings: [
      { criterion: 'C1', verdict: 'met', page: 1, note: { en: 'Five outcomes listed under "What you will learn".', es: 'Cinco resultados listados en "Qué aprenderás".' } },
      { criterion: 'C2', verdict: 'met', page: 2, note: { en: 'Outcome table points to program objectives.', es: 'Una tabla vincula cada resultado con los objetivos del programa.' } },
      { criterion: 'C3', verdict: 'met', page: 3, note: { en: 'Exams, labs and project with their weights.', es: 'Exámenes, laboratorios y proyecto con sus pesos.' } },
      { criterion: 'C4', verdict: 'missing', note: { en: 'No graded sample or rubric is attached.', es: 'No se adjunta ninguna muestra calificada ni rúbrica.' } },
      { criterion: 'C5', verdict: 'partial', page: 6, note: { en: 'Changes are mentioned, but not why they were made.', es: 'Se mencionan cambios, pero no por qué se hicieron.' } },
      { criterion: 'C6', verdict: 'partial', page: 1, note: { en: 'Instructor named; qualifications not stated.', es: 'Se nombra al docente; no se indica su calificación.' } },
    ],
  },
  {
    id: 'evidence',
    file: 'evidence-pack-capstone.pdf',
    title: { en: 'Evidence pack · Capstone project', es: 'Paquete de evidencias · Proyecto final' },
    pages: 18,
    log: [
      '[read]     18 pages · 11 scanned',
      '[convert]  OCR on 11 pages · 4 rubrics found',
      '[analyze]  phase 2/2 · matching chunks to criteria',
      '[audit]    6 criteria checked · 3 met · 1 partial · 2 missing',
      '[report]   every finding links back to its page',
    ],
    inspect: [
      '{ pages: 18, scanned: 11 }',
      '{ chunks: 41, ocr_pages: 11 }',
      '{ chunk: "p.09 §1", criterion: "C4" }',
      '{ criterion: "C4", verdict: "met", source: "p.09" }',
      '{ met: 3, partial: 1, missing: 2 }',
    ],
    findings: [
      { criterion: 'C1', verdict: 'met', page: 2, note: { en: 'Outcomes restated in the project brief.', es: 'Los resultados se repiten en el enunciado del proyecto.' } },
      { criterion: 'C2', verdict: 'partial', page: 3, note: { en: 'Two of five outcomes are mapped.', es: 'Solo dos de cinco resultados están vinculados.' } },
      { criterion: 'C3', verdict: 'met', page: 5, note: { en: 'Grading rubric with four levels.', es: 'Rúbrica de calificación con cuatro niveles.' } },
      { criterion: 'C4', verdict: 'met', page: 9, note: { en: 'Three graded reports at different levels.', es: 'Tres informes calificados en distintos niveles.' } },
      { criterion: 'C5', verdict: 'missing', note: { en: 'No record of changes after last term.', es: 'No hay registro de cambios tras el último ciclo.' } },
      { criterion: 'C6', verdict: 'missing', note: { en: 'Not covered by this document.', es: 'Este documento no lo cubre.' } },
    ],
  },
  {
    id: 'cv',
    file: 'instructor-cv-synthetic.pdf',
    title: { en: 'Instructor CV · synthetic', es: 'CV de docente · sintético' },
    pages: 4,
    log: [
      '[read]     4 pages · text layer found',
      '[convert]  no OCR needed · 1 table kept as rows',
      '[analyze]  phase 1/2 · classified as instructor CV',
      '[audit]    1 criterion applies · 1 met · 5 not applicable',
      '[report]   every finding links back to its page',
    ],
    inspect: [
      '{ pages: 4, text_layer: true }',
      '{ chunks: 9, tables: 1 }',
      '{ doc_type: "cv", confidence: 0.97 }',
      '{ criterion: "C6", verdict: "met", source: "p.01" }',
      '{ met: 1, not_applicable: 5 }',
    ],
    findings: [
      { criterion: 'C1', verdict: 'na', note: { en: 'A CV does not state course outcomes.', es: 'Un CV no declara resultados de un curso.' } },
      { criterion: 'C2', verdict: 'na', note: { en: 'Not applicable to a CV.', es: 'No aplica a un CV.' } },
      { criterion: 'C3', verdict: 'na', note: { en: 'Not applicable to a CV.', es: 'No aplica a un CV.' } },
      { criterion: 'C4', verdict: 'na', note: { en: 'Not applicable to a CV.', es: 'No aplica a un CV.' } },
      { criterion: 'C5', verdict: 'na', note: { en: 'Not applicable to a CV.', es: 'No aplica a un CV.' } },
      { criterion: 'C6', verdict: 'met', page: 1, note: { en: 'Degrees, field and teaching years listed.', es: 'Grados, área y años de docencia listados.' } },
    ],
  },
];
