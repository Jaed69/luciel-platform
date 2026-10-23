# lab-accreditation

Objective: the `/lab/accreditation` demo of the accreditation assistant, in both dimensions — phase 1 replays prepared runs of synthetic samples.
Branch: `feat/lab-accreditation` · Delivery: ask-on-risk · Test runner: `pnpm --filter @luciel/landing test`

## Specs

- S1 Separate page, form first, user: "sería mejor si fuera como una nueva pestaña, en dónde la primera vista sea el formulario, y el cambio de dimensión se hace por tecla o botón y cambia a la otra dimensión".
- S2 Surface shows the client story, user: "se muestra que podnaq tu documento y el restado todo feliz"; Depth shows the same document walking the pipeline, user: "se ve de forma visual como los el documento paso por la lectura , por al cobveriaona texto, por el web o la IA y asi , como si recorriera nosods con una animación , hasta dar el resultado, y como si mostarrass el back o el diagrama de flujo pero animado".
- S3 One state, two views: switching dimension mid-run keeps the same step (accepted design).
- S4 Hybrid processing (accepted): sample documents with prepared results now; "your own file", processed on the device, is phase 2.
- S5 Criteria, user: "Si usa unos genericos" — generic, labelled illustrative; samples are synthetic.
- S6 No scroll abuse (landing-dimensions S3) and every public claim stays true (client-JS readout).
- Out of scope: phase 2 (pdf.js, OCR, in-browser embeddings/LLM).

## Tasks

- [x] T1 S1–S6 — lab route (en/es), data module, view with both readings, replay runner, lab door link, JS claim update, tests · inline · GREEN 98/98, lab inline JS 1596 B

## Log

- L1 (2026-10-23) User: "Si dale" (start the lab), then on criteria: "Si usa unos genericos".
- L2 Route: inline, one unit (no writer trigger). Phase 1 runner is CSS-driven: JS only sets data-sample/data-step/data-state, so client JS stays small.
- L3 The lab needs ~1.6 kB of inline JS per page, so the public readout moved from "< 1 kB on this site" to "< 2 kB on any page of this site" (and the redesign test budget to 2048 B) to stay true.
- L4 Browser proof (headless Chrome, CDP), 9/9: idle start, sample pick, run announces steps, picks ignored mid-run, D mid-run keeps run and step, done shows only the chosen sample's findings in both dimensions, no horizontal scroll at 390 px, no runtime errors.
- L5 Next: phase 2 (own PDF on device: pdf.js, OCR, in-browser embeddings), which will revisit the JS readout.
