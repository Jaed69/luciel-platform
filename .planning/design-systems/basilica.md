# Design System — Basílica (referencia visual para luciel-platform)

> Sistema de diseño warm-devocional colonial-café extraído de la marca Basílica (Cusco).
> Aplicar como base visual para los módulos del grupo (café, tours, hotel).
> En el panel Tours (02.1) se adapta con densidad de tablas contables y menos ornamentación, pero conserva paleta warm wine/cream, Playfair Display + Nunito Sans, pill buttons, y contenido sobre peach-cream.

## Tokens

### Colors

| Token | Hex | Uso |
|---|---|---|
| `primary` (Basílica Wine) | `#6B1E1C` | Brand dominante, headings, CTAs filled |
| `wine-bright` | `#8C2B26` | Hover/active de Wine buttons |
| `espresso-wine` | `#2E1512` | Footer y feature bands oscuras |
| `wine-muted` | `#4A2320` | Acentos decorativos, bordes |
| `blush-cream` | `#F3DCC4` | Tints de estado válido, utility surfaces pálidas |
| `gold` | `#C9A15A` | Trim, bordes, hairlines, ceremony moments (NUNCA fill plano) |
| `gold-light` | `#DFC08A` | Variantes claras de gold |
| `gold-lightest` | `#FBF2E3` | Page-surface wash en heritage sections |
| `canvas` | `#FFFFFF` | Card y modal surface primaria |
| `peach-cream` | `#F7E9D3` | Canvas de página principal, hero zones |
| `stone-wall` | `#EDE1CC` | Zone separators, section washes |
| `dusty-mauve` | `#C9B3AC` | Secondary warm-neutral (banquettes), quote callouts |
| `amber-glow` | `#E8B563` | Lighting effect detrás de arch dividers (no solid fill) |
| `text-espresso` | `rgba(46,21,18,0.90)` | Headings + body en light surfaces |
| `text-espresso-soft` | `rgba(46,21,18,0.62)` | Metadata, captions en light surfaces |
| `text-gold` | `#C9A15A` | Small ceremony labels en dark surfaces |
| `on-primary` | `#FFFFFF` | Texto sobre Wine |
| `on-dark` | `#FFFFFF` | Texto sobre dark bands |
| `on-dark-soft` | `rgba(255,255,255,0.72)` | Secundario en dark bands |
| `chili-red` | `#9C2B2B` | Error/destructive (separado de brand wine) |
| `amber-warning` | `#E0A83E` | Warning state (familia gold) |
| `wine-light-tint` | `hsl(4 55% 30% / 8%)` | Field válido bg tint |
| `chili-tint` | `hsl(4 62% 40% / 6%)` | Field inválido bg tint |

### Typography

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---:|---:|---:|---:|
| Hero Display | Playfair Display | 88px | 700 | 1.10 | 0.01em |
| Product Display (H1) | Playfair Display | 51px | 700 | 1.20 | 0.01em |
| Section Heading (H2) | Playfair Display | 38px | 600 | 1.25 | 0 |
| Script Accent | Yeseva One | 40px | 400 | 1.30 | 0 |
| Card Heading | Playfair Display | 28px | 600 | 1.25 | 0 |
| Body Large | Nunito Sans | 19px | 400 | 1.60 | 0 |
| Body | Nunito Sans | 16px | 400 | 1.50 | 0 |
| Button | Nunito Sans | 16px | 600 | 1.40 | 0 |
| Small | Nunito Sans | 14px | 600 | 1.50 | 0 |
| Micro | Nunito Sans | 13px | 400 | 1.50 | 0 |

**Reglas tipográficas:**
- Serif (Playfair Display) lleva emotional weight; sans (Nunito Sans) lleva información. Nunca mezclar dentro del mismo bloque.
- Script (Yeseva One): solo short labels y pull-quotes, nunca párrafos ni nav.
- Body nunca es pure black; vive en `rgba(46,21,18,0.90)` (warm near-black).

### Radius

| Token | Value | Role |
|---|---:|---|
| `xs` | 8px | Form inputs, utility small |
| `sm` | 12px | Thumbnails, compact chips |
| `md` | 16px | Default content cards |
| `lg` | 24px | Larger media cards |
| `xl` | 32px | Arch niche dividers |
| `pill` | 50px | CTAs |
| `full` | 9999px | Seal badge, signatures |

### Spacing

| Token | px |
|---|---:|
| `xxs` | 4 |
| `xs` | 8 |
| `sm` | 12 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `xxl` | 48 |
| `section` | 80 |

8px base scaling. Section vertical padding 64-96px desktop, 40-56px mobile. Card grid gaps 24px desktop / 16px mobile. Outer gutter 16→24→40 (mobile→tablet→desktop).

## Components

### Buttons

- **`button-primary`**: Wine fill, `on-primary` text, pill 50px, padding `12px 24px`, Nunito Sans 16/600. Hover: wine-bright + `scale(0.97)`. Uso: CTA único dominante.
- **`button-outlined`**: Transparent bg, Wine text, `1.5px solid` Gold border. Companion en light surfaces ("Ver la carta", "Conoce más").
- **`button-gold-trim`**: White bg, Wine text, `1.5px solid` Gold border. Lighter CTA contra cream canvas.
- **`button-inverted-dark`**: White bg, Wine text, `1px solid` white. Primary action en Wine/Espresso bands.
- **`button-outlined-dark`**: Transparent bg, white text, `1px solid rgba(255,255,255,0.7)`. Companion en dark bands.

### Surface Components

- **`seal-badge`**: 56px standard (40px mini), 2px Gold ring, Wine/white fill. Marker repetitivo de marca (certificaciones, "15 años").
- **`content-card`**: White, 16px radius, warm shadow `0 2px 8px rgba(107,30,28,0.08), 0 1px 2px rgba(107,30,28,0.10)`, 24px padding. Default grid card.
- **`mauve-accent-card`**: Dusty Mauve bg, mismo spec. Pull-quotes, narrativa "Nosotros".
- **`heritage-card`**: Gold Lightest bg, Gold top hairline, narrative + photo. Storytelling.
- **`location-card`**: White bg, Gold pin/clock icon, address en text-espresso-soft, "Ver mapa" como button-outlined pill.
- **`arch-niche-divider`**: Arch shape + Amber Glow radial backdrop. Anchor decorativo sobre headers.
- **`quote-callout`**: Mauve/Gold Lightest bg, Yeseva One o Playfair italic, comilla Gold grande, 48-64px vertical padding.
- **`feature-band`**: Full-width Wine/Espresso band. Headline Playfair + Gold hairline + body on-dark-soft + CTAs.

### Form & Nav

- **`floating-label-input`**: Label floats on focus/fill. Border `1px solid rgba(46,21,18,0.2)`, focus `1.5px solid #6B1E1C`. 8px radius, `12px 16px` padding. Valid → wine-light-tint bg; invalid → chili-tint bg.
- **`global-nav`**: Peach Cream bg o transparent-over-hero. Crest logo izq, links Nunito 600 centro/derecha, button-primary CTA derecha. Shadow `0 2px 8px rgba(46,21,18,0.08)` on scroll. Hamburger drawer < tablet; CTA persists.

## Responsiveness

| Breakpoint | Width | Cambios |
|---|---:|---|
| Mobile | <768px | Nav drawer, hero stacked, grid 1-up |
| Tablet | 768-1023px | Grid 2-up, nav inline empieza |
| Desktop | 1024-1439px | Full nav, grid 3-up, feature bands 50/50 |
| XLarge | 1440px+ | Container max-width, cream margin lateral |

## Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, peach-cream/white field | Hero copy, narrative, editorial |
| Bordered | 1px Gold hairline low opacity o `rgba(46,21,18,0.2)` | Feature dividers, form fields |
| Warm Shadow | `0 2px 8px rgba(107,30,28,0.08) + 0 1px 2px rgba(107,30,28,0.10)` | Content cards |
| Dark Product Field | Wine/Espresso full-width band | Feature bands, footer |
| Glow | Radial Amber Glow detrás arch shapes | Arch niches, product photography |

Todo sombra warm-tinted. Cero cool gray/blue drop shadows.

## Do's and Don'ts

### Do

- Peach Cream o Stone Wall como canvas default; Wine/Espresso en feature bands y footer
- Primary CTAs pill Wine-filled en light surfaces
- Gold estrictamente para borders, dividers, hairlines, ceremony callouts (NUNCA fill)
- Dusty Mauve para secondary surfaces warm-neutral
- Todas sombras warm-tinted
- Arch motif en dividers y image framing como signature shape
- Yeseva One solo en short accent moments

### Don't

- Gold como flat background fill (regla de marca #1)
- Cool-toned drop shadows (blue/gray)
- Mezclar Playfair y Nunito Sans en mismo text block
- Yeseva One en párrafos o nav
- Cards < 8px radius para media/content major
- Reemplazar serif/script/sans por un único sans-serif genérico
- Inventar variantes de interacción no documentadas

## Adaptación para Panel Tours (Phase 02.1)

El panel contable Tours es un ERP interno — no un marketing site. Adaptación:

- **Mantener:** Peach Cream canvas / Wine accents / GoldTrim en borders + hairlines / Playfair para headers de página y card headings / Nunito Sans para todo body, tables, forms / pill buttons / floating-label-inputs.
- **Moderar:** Script Yeseva One solo en login hero o brand stamp (no en tablas/forms); arch-niche-divider solo en login header (no en dashboard denso); seal-badge solo para "Tours" branding en nav.
- **Tablas contables densas:** Nunito Sans 13-14px (micro/small) en celdas, row height 36-40px,_LINES zebradas con `stone-wall` muy sutil (#EDE1CC a 30% opacity), headers con Wine text + Gold bottom hairline. Sticky header. Pagination pill.
- **Dashboard (saldo por cuenta):** Cards `content-card` con saldo grande Playfair 28px (card-heading), label Nunito 14 small. NO charts. Tabla filtrable debajo.
- **Forms (venta tour, liquidaciones, catálogos):** floating-label-input en 2-column layout desktop, 1-column mobile. Buttons en footer card: button-primary para "Guardar", button-outlined para "Cancelar".
- **Modales (auditoría, confirmar cierre liquidación):** content-card max-w-md con shadow warm, pill primary + outlined.
- **Estados vacíos:** ilustración simple + Nunito 16 body-espresso-soft + button-outlined "Registrar primero".
- **Estados loading:** skeleton shimmer warm (gold-light a stone-wall), no spinners fríos.
- **Estados error:** chili-red text + chili-tint field bg; toast bar top con chili-red left border.
- **RBAC visibility:** vendedor no ve nav items "Usuarios", "Auditoría", "Totales globales". Esconder nav items, no sólo bloquear routes.
- **Currency display:** S/ para PEN, $ para USD. Nunito Sans tabular-nums. Negativos en chili-red.
- **Date format:** DD/MM/YYYY en UI, ISO YYYY-MM-DD en API.
- **Idioma:** Castellano (Perú). Labels, buttons, errors, ayuda — todo en español. Code identifiers en inglés.