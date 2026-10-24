---
name: luciel.dev
description: A warm grey photographic studio where paper becomes data, with a dark machine dimension underneath.
colors:
  paper-ground: "#f8f8f7"
  paper-white: "#ffffff"
  paper-raise: "#ecebe8"
  paper-line: "#dcdad6"
  sheet-paper: "#f1f2f2"
  studio: "#766f6a"
  studio-shadow: "#2a2724"
  ink: "#1c1a17"
  ink-muted: "#5b554c"
  ink-faint: "#635c52"
  hero-ink: "#ffffff"
  bone-button: "#f1f0ee"
  signal-fill: "#ff6a2b"
  signal-text: "#a8350b"
  live: "#3f6b2a"
  verdict-partial: "#855400"
  depth-ground: "#0d1014"
  depth-surface: "#151a21"
  depth-raise: "#1b212a"
  depth-line: "#2a323d"
  depth-ink: "#e8e4da"
  depth-muted: "#9aa3ae"
  depth-faint: "#8a939e"
  depth-live: "#8bc48a"
typography:
  hero-name:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "calc(56 * var(--u))"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.012em"
  hero-role:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "calc(35 * var(--u))"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  hero-lead:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "calc(31 * var(--u))"
    fontWeight: 300
    lineHeight: 1.13
    letterSpacing: "-0.012em"
  display:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 1.6rem + 3vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 1.9vw, 2.75rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  headline-depth:
    fontFamily: "Geist Mono Variable, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "clamp(1.7rem, 1.45rem + 1vw, 2.4rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 1.3rem + 1.2vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title-sm:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(0.98rem, 0.95rem + 0.15vw, 1.06rem)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Roboto Flex Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
    lineHeight: 1.6
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "clamp(0.78rem, 0.76rem + 0.1vw, 0.84rem)"
    fontWeight: 400
rounded:
  hairline: "3px"
  key: "4px"
  cell: "8px"
  tile: "10px"
  panel: "18px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 48px)"
  section: "clamp(3.5rem, 7vw, 6rem)"
  container: "1172px"
  comp-frame: "1376px"
  comp-unit: "min(100cqw / 1376, 1px)"
components:
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.3rem"
    height: "44px"
  button-light:
    backgroundColor: "{colors.bone-button}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.3rem"
    height: "44px"
  button-light-hover:
    backgroundColor: "{colors.paper-white}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-ground}"
    rounded: "{rounded.pill}"
    padding: "0 1.3rem"
    height: "44px"
  case-paper:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "clamp(1.4rem, 3vw, 2.25rem)"
  case-studio:
    backgroundColor: "{colors.studio}"
    textColor: "{colors.hero-ink}"
    rounded: "{rounded.panel}"
    padding: "clamp(1.4rem, 3vw, 2.25rem)"
  lab-door:
    backgroundColor: "{colors.studio-shadow}"
    textColor: "{colors.bone-button}"
    rounded: "{rounded.panel}"
    padding: "clamp(1.5rem, 4vw, 3rem)"
  receipt-sheet:
    backgroundColor: "{colors.sheet-paper}"
    textColor: "#1d2426"
    rounded: "{rounded.cell}"
    padding: "1.1rem 1.3rem 0.4rem"
  glass-card:
    backgroundColor: "rgb(232 230 227 / 0.62)"
    textColor: "#1f1c1a"
    rounded: "{rounded.cell}"
    padding: "calc(11 * var(--u)) calc(16 * var(--u))"
  data-cell:
    backgroundColor: "rgb(236 242 243 / 0.72)"
    textColor: "#1d2426"
    rounded: "calc(6 * var(--u))"
    padding: "calc(8 * var(--u)) calc(10 * var(--u))"
  nav-link:
    textColor: "{colors.ink-muted}"
    typography: "{typography.mono}"
  nav-link-over-hero:
    textColor: "{colors.hero-ink}"
    typography: "{typography.body}"
---

# Design System: luciel.dev

## Overview

**Creative North Star: "The Studio and the Machine"**

The Surface dimension is a warm grey photographic studio. A giant sculpted LUCIEL wordmark is the wall, a photoreal stack of real-shaped documents sits in front of it, and one fictitious tour booking lifts off the paper as frosted-glass data cells. Below the hero the studio carries down the page: documents are white or sheet paper, scenes are the studio grey and its shadow, and rhythm comes from space instead of rules between sections. Type is one variable face, Roboto Flex, set light and large, with no ornament.

The Depth dimension is the same page read as the machine that builds it: a near-black blue-grey ground, Geist Mono display type, hairline tables of facts, and the shared signal orange. Both dimensions keep one grid, one body face and one signal accent; only the material changes. The switch is global (button or the D key), and only the active reading is rendered, so Surface stands complete on its own and without JavaScript.

The identity mark is the winged L: an inscriptional capital whose stem grows one wing, Luciel before the fall. It ships in two forms, a plain mark for small sizes and a haloed mark for large ones.

**Key Characteristics:**
- Image-led hero measured in comp pixels on a 1376 px frame, never scaling past it.
- Two dimensions, Surface (studio) and Depth (machine), sharing grid, body face and signal.
- Paper and studio materials: white and sheet paper for documents, studio grey and shadow for scenes.
- Frosted glass only where data lifts off paper (hero cells and cards).
- One variable sans in Surface; mono enters with the machine.
- Motion tells the paper-to-data story once, then stays out of the way.

## Colors

A restrained warm-neutral studio with a single orange signal, mirrored by a cool near-black machine palette in Depth.

### Primary
- **Signal Orange** (signal-fill): the one accent both dimensions share. On paper it is a fill and mark color only (the current-page nav underline, pipeline connectors). In Depth it is also the text accent and focus ring color.
- **Kiln Red** (signal-text): the text-safe form of the signal on paper: links, focus outlines, "in development" status, the "missing" verdict.

### Secondary
- **Studio Grey** (studio): the photographed wall's tone, used for scene panels such as the second work case, with white type (about 4.9:1).
- **Studio Shadow** (studio-shadow): the darkest studio tone, the lab door panel that holds the replayed audit sheet.

### Tertiary
- **Field Green** (live / depth-live): "live" status and the "met" verdict.
- **Ochre** (verdict-partial): the "partial" verdict on the audit receipt only.

### Neutral
- **Paper Ground** (paper-ground): the Surface page background below the hero.
- **Paper White** (paper-white): document panels, the first work case.
- **Sheet Paper** (sheet-paper): the printed sheet laid on the lab door (the audit receipt).
- **Paper Raise** (paper-raise) and **Paper Line** (paper-line): inline code and chip fills; hairlines inside records.
- **Ink** (ink), **Ink Muted** (ink-muted), **Ink Faint** (ink-faint): text on paper, each at 4.5:1 or better on ground, surface and raise.
- **Hero Ink** (hero-ink, with an 86% white soft variant): all type set over the hero and closing photographs.
- **Bone** (bone-button): the light button and the lab door's text tone.
- **Depth Ground / Surface / Raise / Line / Ink / Muted / Faint**: the machine palette, swapped in under `html[data-dimension="depth"]` through the same custom-property names.

### Named Rules
**The One Signal Rule.** Signal Orange is the only accent, and on paper it never carries text; text that needs the accent uses Kiln Red.

**The Same Names, Two Materials Rule.** Colors are referenced by role (`--color-bg`, `--color-fg`, `--color-line`...), never by dimension; Depth redefines the roles, components do not branch on dimension for color.

## Typography

**Display Font:** Roboto Flex Variable (with Segoe UI, system-ui)
**Body Font:** Roboto Flex Variable (with Segoe UI, system-ui)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace, Cascadia Mono, Consolas). Both are self-hosted through Fontsource; nothing loads from another domain.

**Character:** In Surface a single variable sans does everything, set at weights 300 to 500 with slight negative tracking, so headings read as calm print rather than marketing. In Depth the display role switches to Geist Mono with tighter tracking (-0.04em), and mono takes over labels, facts and the rail.

### Hierarchy
- **Hero name / role / lead** (400 / 400 / 300, 56 / 35 / 31 comp px): the first viewport's left column only, in comp pixels.
- **Display** (400, clamp 2.4 to 4.5rem, 1.02): the closing panel heading.
- **Headline** (400, clamp 2 to 2.75rem, 1.1, max 22ch): Surface section headings. In Depth, headings use the mono headline-depth role.
- **Title** (400, clamp 1.7 to 2.25rem, 1.1): work case headings. **Title small** (400, 1.2 to 1.5rem): lab-next items, method principles, trajectory stops, sub-headings.
- **Body** (400, 0.98 to 1.06rem fluid, 1.6): running text, muted ink for secondary paragraphs, held to 52 to 64ch.
- **Label** (500, 0.82rem): record field names and status words, sentence case, no tracking.
- **Mono** (400, 0.78 to 0.84rem): footer, Depth facts and readouts, chips, the D key hint.

### Named Rules
**The One Face Rule.** Surface uses Roboto Flex for every role, the hero and headings included; Geist Mono appears in Surface only for file names, code and chips.

**The Sentence Case Label Rule.** Labels on Surface are sentence case at 0.82rem / 500 with no letter-spacing; uppercase tracked mono is Depth's machine voice only (facts, tool tags).

## Layout

The hero is a fixed composition measured on the approved comp at 1376 px wide. Every box is written in comp pixels and scaled by one unit, `--u = min(100cqw / 1376, 1px)`, so the composition keeps its proportions as the window narrows and stops growing past 1376 px. Wider windows center the frame (`--x`), fill the sides with the same backdrop blurred 28 px, and fade the frame's edges with a 9% mask. The over-hero rail uses the same capped unit and centers on the same 1376 px frame.

Below 1024 px the comp cannot shrink and stay legible, so it unstacks: fixed rem sizes, copy first, then the paper object cropped in its own comp-pixel unit, then the cards as a plain list; 640 to 1023 px runs two columns (copy and cards beside the object). The rail drops to fixed sizes on two rows and the switch names only the active dimension.

Below the hero, content sits in a 1172 px container with a fluid gutter (16 to 48 px). Sections are separated by space (clamp 3.5 to 6rem top padding) with no rule between them. Work runs in two columns from 860 px; the lab door splits heading and sheet from 860 px; trajectory sets its heading beside its rows from 960 px. Grids otherwise use `auto-fit` with `min(260px, 100%)`-style minimums.

### Named Rules
**The Comp Pixel Rule.** The hero and the over-hero rail are positioned in comp pixels on a 1376 px frame, capped at one CSS pixel per comp pixel; below 1024 px they switch to fixed sizes instead of shrinking further.

**The Space Between Rule.** Sections are separated by space, never by full-width rules; hairlines live inside records (facet rows, receipt lines, trajectory rows, tool lists) where they separate fields of one thing.

## Elevation & Depth

Depth is mostly photographic and material, with soft, long, low-opacity ambient shadows that seat paper on the studio floor. There are no hard offset shadows. Document panels (work cases) carry a wide soft drop (0 24px 48px -32px), the audit sheet a deeper one and a -1.2 degree tilt as if laid on the panel. Frosted glass (backdrop blur 6 to 12 px over translucent warm or cool white with a 1 px white edge) is reserved for the hero's data cells and cards, the material of data lifted off paper. The Depth dimension replaces drop shadows with a 1 px line ring plus a dark ambient drop.

### Named Rules
**The Glass Is Data Rule.** Frosted glass marks only things that were lifted off a document: the booking cells and the hero cards. Panels below the hero are opaque paper or studio.

## Shapes

Corners scale with what the object is: 3 px for inline code, chips and locale links; 4 px for the key hint; 8 px for glass cards and the paper sheet (6 comp px for the small booking cells); 10 px for Depth tiles (pipeline nodes, readouts); 18 px for panels (work cases, lab door, closing stage); full pills for buttons, the switch track and status capsules. Borders are 1 px hairlines in the line color, or translucent white on glass and studio panels. The identity mark is the winged L, a single-path silhouette that inherits `currentColor`; its haloed form adds a tilted ellipse (-6 degrees) on the stem axis.

## Components

### Buttons
- **Shape:** full pill (999px), minimum height 44 px, 1.3rem side padding, weight 500.
- **Outline:** 1 px ink border, ink text, transparent fill. Used for "view source" in Depth.
- **Light:** bone fill and border with ink text, white on hover. Used on dark studio panels (lab door, closing stage).
- **Primary:** ink fill, ground text. Used for the lab's run action.
- **Hover / Focus:** lift 1 px over 240 ms ease-out; focus is a 2 px signal-text outline offset 3 px (hero ink over photographs).
- **Text actions:** the hero's actions are plain text links whose 1 px underline draws in from the left on hover and focus (320 ms).

### Cards / Containers
- **Work case:** 18 px panel, no border, wide soft shadow. The first case is paper white; the second is studio grey with white type and translucent white hairlines. Each facet reads as a field on a record: label (0.82rem / 500) left, text right, hairline above.
- **Lab door:** studio shadow panel, heading and light button on the left, the replayed audit as a tilted sheet-paper receipt on the right (criterion, verdict colored met / partial / missing, source page).
- **Closing stage:** the hero backdrop again, darkened to 52% brightness, in an 18 px panel with display type and a light button, so the page ends in the studio it opened in.
- **Hero glass card:** translucent warm white over blur 12 px, 8 px corner, comp-pixel padding; hover and focus brighten the fill and lift 2 comp px.

### Chips
- **Style:** mono at 0.82em on the raise fill, 3 px corner. Depth stack groups only.

### Navigation
- **Rail:** sticky, translucent ground over blur 6 px, mono 0.78 to 0.84rem muted links; the current page is ink with a signal-orange underline offset 6 px; locale links EN / ES, the active one boxed in a hairline.
- **Over the hero (home):** absolute, transparent, Roboto Flex at 19 comp px in hero ink, nav centered, locales separated by a soft slash; hover underlines.
- **Brand:** the plain winged L at 1.6em (38 comp px over the hero, 28 px on phones) beside "luciel.dev".

### Dimension Switch
A text button: a pill track in ink with a ground-colored knob that slides 1.1em over 320 ms, the labels "Surface / Depth" with the active side in ink, and a D key hint hidden on touch screens and over the hero. Flipping wraps the change in a view transition: the old page lifts away like paper (520 ms, up 14 px, scale 0.985, dimmed) while the new one grows as a circle from the switch (720 ms). Without JavaScript the switch is not offered.

### Winged L Mark
- **A (plain):** used below 64 px: the header, `favicon.svg` (ink #1e1c1a, light #f1f0ee under a dark color scheme), the 180 px touch icon.
- **D (haloed):** used at 64 px and above: `public/brand/luciel-mark-halo.svg`, OG cards and large lockups.

## Do's and Don'ts

### Do:
- **Do** write every color as a role custom property so the Depth dimension can redefine it.
- **Do** position hero and over-hero elements in comp pixels (`calc(n * var(--u))`) on the 1376 px frame, and switch to fixed rem sizes below 1024 px.
- **Do** use the plain winged L below 64 px and the haloed form at 64 px and above.
- **Do** carry the studio below the hero: documents in paper white or sheet paper, scenes in studio grey (#766f6a) or studio shadow (#2a2724).
- **Do** fill every cell, card and plate with real content or one coherent fictitious record; state facts in full with their context.
- **Do** keep motion CSS-only under `prefers-reduced-motion: no-preference`, using `cubic-bezier(0.2, 0.7, 0.2, 1)`, with keyframes that start at opacity 0.4 so nothing is hidden at rest.
- **Do** darken photographs under type (brightness 0.74 in the hero, 0.6 on phones, 0.52 in the closing) and set that type in hero ink.

### Don't:
- **Don't** let the signal orange (#ff6a2b) carry text on paper; use Kiln Red (#a8350b).
- **Don't** separate sections with full-width rules; use space.
- **Don't** use frosted glass outside the hero's data cells and cards.
- **Don't** put invented or garbled lettering in a plate, or placeholder figures in a label (a bare "-90%" without what it measures).
- **Don't** add ornamental icons; the winged L and the 7 px status dot are the only drawn glyphs.
- **Don't** let the hero or the over-hero rail grow past 1376 comp pixels.
- **Don't** load fonts or images from another domain.
