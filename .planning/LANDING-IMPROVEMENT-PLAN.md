# Plan de mejora — luciel.dev (landing / Content Hub)

**Fecha:** 2026-09-25
**Alcance:** revisión completa del repo + plan para construir el sitio raíz `luciel.dev` (Phase 2 Content Hub → Phase 3 Legal/AdSense).
**Estado:** propuesta — requiere confirmación del Paso 0 antes de escribir código (regla "Fase 0 = gate").

---

## 1. Diagnóstico del repo

### Qué hay hoy

| Área | Estado | Nota |
|---|---|---|
| Infra (Traefik v3.7.5 + Compose + LE HTTP-01) | ✅ En producción | Phase 1 completa. Wildcard DNS + cert por subdominio. |
| CI/CD (`release.yml`) | ✅ Funciona | Matriz arm64 → GHCR → deploy SSH. Solo corre en push a `main`. |
| `apps/landing` (Astro 7 + Tailwind 4 + MDX + sitemap) | ⚠️ Placeholder | 1 sola página "Under construction", en inglés. Compila OK (`pnpm build` ✓, 914 ms). |
| `apps/tours` (Next 16 + FastAPI + SQLite) | ✅ Avanzado | Panel contable privado (login). Fases 02.1 / 02.1.1 + incrementos D-35/D-36. |
| `apps/lemon` (Astro + Supabase) | ✅ Live | Sitio-regalo personal con subida pública de fotos/video. Sin fase en el roadmap. |
| Blog | ❌ Vacío | `src/content/blog/.gitkeep`, sin schema de colección, sin artículos. |
| Legal / 404 / robots / favicon / OG | ❌ No existen | nginx apunta a `/404.html` que no se genera. |

### Hallazgos (ordenados por impacto)

1. **El orden de fases se invirtió.** El roadmap y `PITFALLS.md #2` dicen "contenido raíz antes que herramientas". Se construyeron `tours` y `lemon` y la raíz sigue en "Under construction". Sin contenido raíz no hay revisión de AdSense posible → Phase 2 es ahora la prioridad absoluta.
2. **`DESIGN.md` es el sistema de diseño de Cohere** (`name: Cohere-design-analysis`, token `cohere-black`, fuentes CohereText/Unica77). Sirvió como andamiaje, pero usar la identidad visual de otra empresa para una marca personal genera confusión de marca y no diferencia a luciel.dev. **Recomendación:** definir un sistema propio "luciel" (se puede conservar la estructura de tokens: escala tipográfica, spacing, radios).
3. **`lemon.luciel.dev` y AdSense.** Contenido personal + subida pública sin moderación (UGC) bajo el mismo dominio que se someterá a revisión. **Recomendación:** `noindex` + `robots` Disallow en lemon, no enlazarlo desde el directorio público, y no ponerle anuncios.
4. **`tours.luciel.dev` es privado.** No aporta contenido indexable; sí puede aparecer como **caso de estudio** en el blog/proyectos (problema real: reemplazar Excel+VBA por partida doble auditada) sin exponer datos del cliente.
5. **Documentación de estado desactualizada.** `STATE.md` dice "executing 02.1.1 plan 1 of 2" y el ROADMAP tiene los plans de 02.1.1 sin marcar, pero el git log muestra trabajo posterior (D-35, D-36). `AGENTS.md` dice "Empty scaffold repository". `config.json` apunta a `./.claude/CLAUDE.md`, que no existe. `PROJECT.md` cita `luciel-platform-brief.md` como fuente de verdad, pero no está versionado.
6. **Sin red de seguridad en CI.** No hay job de build/lint en PRs: una landing rota se descubre en producción. Añadir `pnpm --filter @luciel/landing build` + chequeo de enlaces en `pull_request`.
7. **nginx de la landing** sin cabeceras de caché para `/_astro/*` (assets con hash → `immutable`), sin cabeceras de seguridad básicas, y con `error_page 404` hacia un archivo inexistente.
8. **Menores:** `traefik.yml` tiene el email de LE hardcodeado (justificado en comentario, pero contradice la regla "secretos en `.env"`); `<html lang="en">` fijo en el Layout.

---

## 2. Paso 0 — decisiones a confirmar (gate)

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Idioma del sitio | **Español como principal** (`lang="es"`). Menos competencia SEO en nicho técnico hispano; el contenido existente ya está en español. Inglés = v2 (i18n de Astro) si hay demanda. |
| D2 | Identidad visual | **Sistema propio "luciel"** reemplazando DESIGN.md de Cohere (ver §4). |
| D3 | Nombre/bio pública | El usuario provee: nombre a mostrar, rol, foto (opcional), enlaces (GitHub, LinkedIn, email de contacto). |
| D4 | Artículos iniciales (5-8) | Ver §3.3. El usuario aporta material fuente (notas, diagramas, código); el agente redacta borradores que el usuario revisa. **No se publica texto no revisado.** |
| D5 | ¿Tours y Lemon en el directorio? | Tours: sí, como caso de estudio (sin link al panel). Lemon: no. |
| D6 | Contacto | `mailto:` + página de contacto estática (sin backend). Formulario → v2. |

---

## 3. Arquitectura de información

### 3.1 Mapa del sitio

```
/                       Home: intro + filosofía + últimos posts + herramientas destacadas
/sobre-mi               Presentación personal, trayectoria, stack
/proyectos              Directorio de herramientas (live / próximamente) + casos de estudio
/blog                   Listado paginado por fecha, con tags
/blog/[slug]            Artículo (MDX, Shiki, tiempo de lectura, JSON-LD Article)
/blog/tags/[tag]        (opcional, si hay ≥ 2 posts por tag)
/contacto               Email + redes
/privacidad             Política de privacidad (cookies + AdSense)     ← Phase 3
/terminos               Términos de uso                                ← Phase 3
/404                    Página 404 propia
/rss.xml  /sitemap-index.xml  /robots.txt  /favicon.svg  /og-default.png
```

### 3.2 Componentes (Astro, zero-JS)

`BaseHead` (title, description, canonical, OG/Twitter, lang) · `Header` (nav + estado activo) · `Footer` (nav + legales + RSS) · `ToolCard` (nombre, descripción, estado, stack) · `PostCard` · `PostLayout` (TOC opcional, fecha, tags) · `Prose` (estilos tipográficos para MDX).
JS en cliente: ninguno por defecto. Toggle de tema claro/oscuro solo si se decide en D2 (script inline de < 1 KB).

### 3.3 Contenido inicial propuesto (basado en proyectos reales)

1. Arquitectura del simulador de tráfico multi-agente
2. Diseño de red de AGRODROID
3. Construyendo un sistema RAG: decisiones y errores
4. Pipeline ABET: automatizar evidencia de acreditación
5. De Excel con macros a partida doble: caso tours.luciel.dev
6. Self-hosting con Traefik v3: un subdominio por herramienta (esta misma infra)
7. (opcional) SQLite en producción con WAL y Docker
8. (opcional) Por qué Astro para un sitio que quiere pasar AdSense

Cada artículo: ≥ 1 000 palabras de texto original, código real, diagramas propios.

### 3.4 Directorio de herramientas (datos en `src/data/tools.ts`)

| Herramienta | Estado | Enlace |
|---|---|---|
| tours — panel contable | Caso de estudio (privado) | → artículo #5 |
| rtk — optimizador de tokens | Próximamente | — |
| graph — visualizador de código | Próximamente | — |
| hackathons — radar | Próximamente | — |

---

## 4. Dirección de diseño (a desarrollar en la siguiente etapa)

Propuesta para sustituir DESIGN.md (Cohere) por un sistema propio, manteniendo la estructura de tokens en `tokens.css`:

- **Carácter:** editorial-técnico. Mucho blanco, lectura cómoda (medida 65-72 ch), acentos mínimos. El protagonista es el texto y el código.
- **Tipografía:** sans para UI/títulos + mono para labels/código. Fuentes libres autohospedadas (p. ej. Inter/Geist + JetBrains Mono) vía `@fontsource` — sin Google Fonts en runtime (privacidad + CWV).
- **Color:** neutro cálido + **un** acento de marca propio (a definir; evitar el coral/verde de Cohere). Modo oscuro vía `prefers-color-scheme`.
- **Escala:** reutilizar la escala actual de tokens (96/72/60/48/32/24/18/16/14/12) y spacing 8-pt.
- **Entregables del diseño:** `DESIGN.md` nuevo (tokens + reglas), `tokens.css` actualizado, mockups de Home, Post y Proyectos antes de maquetar.

---

## 5. Plan de ejecución por olas

Cada ola termina con build verde, deploy y verificación en `https://luciel.dev`.

### Ola A — Fundaciones (Phase 2)
- [ ] Nuevo `DESIGN.md` propio + `tokens.css` (tras aprobar D2)
- [ ] `BaseHead` con SEO/OG/canonical, `lang` según D1
- [ ] `Header` + `Footer` + layout base
- [ ] `404.astro`, `favicon.svg`, imagen OG por defecto
- [ ] nginx: caché `immutable` para `/_astro/*`, cabeceras de seguridad, 404 funcional
- [ ] CI: job `pull_request` que construye la landing (y valida enlaces internos)

### Ola B — Páginas principales (Phase 2)
- [ ] Home (intro, filosofía, posts recientes, herramientas)
- [ ] `/sobre-mi` con contenido real del usuario (D3)
- [ ] `/proyectos` alimentado por `tools.ts`
- [ ] `/contacto`

### Ola C — Blog (Phase 2)
- [ ] Content collection `blog` con schema tipado (title, description, pubDate, updatedDate, tags, draft, heroImage)
- [ ] `/blog`, `/blog/[slug]`, Shiki con tema claro/oscuro, tiempo de lectura
- [ ] `/rss.xml` con `@astrojs/rss`
- [ ] 5-8 artículos revisados por el usuario (§3.3)

### Ola D — Legal + AdSense readiness (Phase 3)
- [ ] `/privacidad` (cookies + AdSense + terceros), `/terminos`
- [ ] `robots.txt` (incl. `Mediapartners-Google`), sitemap enlazado
- [ ] JSON-LD `Article` + `Person`/`WebSite`, meta description única por post
- [ ] Lighthouse/CWV ≥ 95 en Home y un post
- [ ] Verificación en Google Search Console (usuario) · `ads.txt` cuando exista el ID
- [ ] Lemon: `noindex` + robots Disallow

### Ola E — Limpieza de documentación (en paralelo, bajo costo)
- [ ] Actualizar `STATE.md` y ROADMAP (02.1.1 real, D-35/D-36)
- [ ] Reescribir `AGENTS.md` (ya no es "empty scaffold"; documentar apps y comandos)
- [ ] Versionar el brief o actualizar la referencia en `PROJECT.md`
- [ ] Registrar `lemon` en el ROADMAP (o como fuera de alcance explícito)

---

## 6. Criterios de "hecho" para luciel.dev (Phase 2 + 3)

1. Todas las páginas de §3.1 existen, enlazadas desde header/footer, **0 enlaces rotos**.
2. ≥ 5 artículos publicados, originales y revisados.
3. `/rss.xml`, `/sitemap-index.xml`, `/robots.txt` válidos.
4. OG tags en todas las páginas (preview correcto al compartir).
5. Cero JS de framework en páginas de contenido; Lighthouse ≥ 95 (Perf/SEO/A11y).
6. Legales publicadas → listo para que **el usuario** solicite AdSense manualmente.

## 7. Siguiente paso

Confirmar D1-D6 → arrancar con la **etapa de diseño** (§4: DESIGN.md propio + mockups) → Ola A.
