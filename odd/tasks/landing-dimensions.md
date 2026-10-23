# landing-dimensions

Objective: rebuild the luciel.dev landing on the "Paper & Machine" identity with a global Surface/Depth dimension switch.
Branch: `feat/landing-dimensions` · Delivery: ask-on-risk · Test runner: `pnpm --filter @luciel/landing test` (astro build + node:test)

## Specs

- S1 Identity "Paper & Machine" as approved in the moodboard (https://claude.ai/artifact/GAXJQESpMshtvVFVKAeuv4), user: "Me gusta dale como está asi". Surface = paper (light), Depth = machine (dark); one shared signal accent; Geist body in both, display Newsreader (Surface) / Geist Mono (Depth); fonts self-hosted; text contrast ≥ 4.5:1 in both dimensions.
- S2 The dimension switch is global, user: "Que sea algo global". It works on every page, by button or key, user: "el cambio de dimensión se hace por tecla o botón y cambia a la otra dimensión". No flash of the wrong dimension on load; choice persists per visitor; reduced motion = instant cut; inactive content is not reachable by keyboard or screen readers.
- S3 No scroll abuse, user: "No abuses del scrol, no cada parte tiene que ser web scroll". No scroll-driven narrative or scroll-jacking on the landing.
- S4 Landing structure (proposed, accepted with "si dale"): hero (thesis + lab door CTA), lab door, selected work, about + readouts, contact. Each section has a Surface and a Depth reading; landing Depth shows how the site itself is built, project Depth shows architecture.
- S5 Thesis, user: "no sirve de nada la tecnología si no encuentra utilidad en el mundo real". Bilingual (en/es) like the current site.
- S6 Every public claim stays true (readouts name their source; the client-JS readout matches reality).
- Out of scope here: the `/lab/acreditacion` demo itself (separate feature); the lab door links nowhere until it exists.

## Tasks

- [x] T1 S1 — tokens for both dimensions, self-hosted fonts, contrast tests · inline · GREEN 80/80
- [x] T2 S2 S3 S6 — dimension mechanism (pre-paint attribute, toggle, D key, view transition, CSS-hidden inactive reading) in the shell · inline · GREEN 84/84, inline JS ~990 B
- [x] T3 S4 S5 S6 — home content restructure with Surface/Depth readings, en/es copy, tests · inline · GREEN 89/89

## Log

- L1 (2026-10-22) User: "Vamls a comenzar, queremos seri mejorando o mejor dicho panteter de verdad como debe ser la web de Luciel.dev, como en teoría es mi portafolio de proyectos, y la idea es que se muestren mis capacidades, ya sea con proyectos de plegadora, animación , 3d como web carísimas, con gráfico ,un súper ux o UI, que transmita un experiencia".
- L2 Discovery decisions: two dimensions (Surface/Depth), identity A chosen, global switch, landing first then lab. User on the root package.json pnpm bump: "no se si el pack es importate si no no lo comites" → left uncommitted.
- L3 Route: inline (no writer trigger: tasks depend on each other).
- L4 T1–T3 done on `feat/landing-dimensions`, 89/89 tests green. Inline client JS ≈ 990 B (the "< 1 kB" readout stays true). Browser check pending: Claude in Chrome extension not connected; the switch's runtime behavior (click, D key, view transition, persistence) is covered only by static tests on the built HTML.
- L5 Next: user review in a real browser, then the `/lab/acreditacion` feature.
- L6 Browser proof: headless Chrome over CDP, 11/11 checks (switch by button and D, persistence across reload, Ctrl+D and typing ignored, reduced motion = no view transition, no horizontal scroll at 390 px in both dimensions, no runtime errors); also recorded in the user's Chrome (luciel-dimension-jump.gif).
- L7 Native review review-152b671173a0eeab (resilience, readability, reliability) on 0c12a30..3ed2df5: approved, acknowledged. Advisory acted on: the lockfile carried a pnpm 12.11.2 self-pin document from the user's uncommitted bump → removed in 8587a0d; that commit was dropped when rebasing onto the pnpm 12 upgrade (PR #45), where the self-pin is intended. Lockfile now differs from main only by the font packages. Other advisories left as follow-ups: hide the D hint on touch screens, Depth unreachable without JS, minified switch script readability, #trajectory id now holds the About block.
