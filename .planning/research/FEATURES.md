# Feature Landscape

**Domain:** Self-hosted monorepo platform with content hub + subdomain tools
**Researched:** 2026-07-02

## Table Stakes

Features users/Google expect. Missing = product feels incomplete or fails AdSense review.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| HTTPS with valid cert | Required by every modern browser and Google ranking. | Low | Traefik + Let's Encrypt handles this automatically per subdomain. |
| Responsive design | Mobile traffic > desktop. Google mobile-first indexing. | Low | Tailwind 4 + framework defaults make this standard. |
| Fast page load (Core Web Vitals) | Google ranking factor. AdSense page quality requirement. | Low-Med | Astro's zero-JS output gives excellent baseline. Next.js needs more optimization. |
| Privacy Policy | Required by law (GDPR, CCPA) and AdSense. | Low | Generate via Termly/iubenda. Link in footer. |
| Terms of Service | Legal requirement for a site with tools and ads. | Low | Standard boilerplate with tool-specific sections. |
| Contact page | Trust signal for users. Required by some ad networks. | Low | Simple form or email link. |
| Sitemap.xml | Required for Google Search Console and page indexing. | Low | `@astrojs/sitemap` auto-generates for landing. |
| RSS feed | Blog standard. Required by some RSS readers and aggregators. | Low | `@astrojs/rss` auto-generates from Content Collections. |
| Social meta tags (Open Graph) | Required for proper link previews on social media. | Low | Astro has built-in `<head>` control. |
| 404 page | Professionalism requirement. Prevents user frustration. | Low | Framework default pages work with customization. |
| Blog with searchable content | Core of the content strategy. AdSense needs substantial text. | Med | MDX in Content Collections. Syntax highlighting for code. |
| Tool has context/content page | Not just a bare widget. Google needs text around tools to index them. | Med | Each subdomain must have a landing page describing the tool. |
| Clear navigation | Users need to find tools, blog, and contact. AdSense review checks UX. | Low | Header nav + tool directory page. |

## Differentiators

Features that set the platform apart. Not expected by users, but reduce friction.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tool directory page | Shows all tools in one place. Helps users discover. | Low | List with descriptions and status (live/coming soon). |
| Per-tool "how it works" content | Content paired with each tool for AdSense compliance. | Med | Each subdomain needs a short article explaining the problem and solution. |
| Code snippets with syntax highlighting | Technical blog readers expect readable code. | Low | Shiki/bright for syntax highlighting in MDX. |
| "Built with" tech badges on tools | Social proof. Shows the tool is real and built with specific technologies. | Low | Simple component for tech stack display. |
| SEO-optimized tool content | Each tool page has unique meta description, title, and structured content. | Med | Unique metadata per subdomain. Avoid duplicate content across tools. |
| Tool-specific Open Graph images | Better link previews when sharing tools. | Med | Dynamic OG images or per-tool static images. |
| Quick deploy for new tools | Adding a new subdomain takes < 1 day. | High | This is the whole point of Phase 3/4. Requires documented pattern. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User authentication/login system | Not in scope. No user accounts needed. Adds complexity, security surface, and makes AdSense harder (logged-out users see no content). | Static content + anonymous tool usage. Auth if paid features are added (not planned). |
| Cookies/analytics/tracking (beyond AdSense) | GDPR consent complexity. Not needed for traffic validation. | Only Google AdSense scripts. No GA/Trackers until necessary. |
| Comments section (Disqus, Giscus) | Content moderation burden. Not needed for initial blog. | Focus on article quality. Add comments only if engagement metrics justify it. |
| Headless CMS (Strapi, Sanity, etc.) | Overhead for solo technical blog with < 100 articles. DB setup, webhooks, API keys. | MDX files in git. Content Collections handle type safety. |
| PostgreSQL | Not justified at this traffic level. Adds operational complexity. | SQLite WAL. Migrate only on proven write contention. |
| Cloudflare/nginx in front of Traefik | Unnecessary complexity for a single-VPS setup. Adds another layer to debug. | Let Traefik face the internet directly. |
| Webpack custom config | Turbopack is default in Next.js 16. Webpack configs are dead weight. | Use Turbopack with Next.js 16. |
| Kubernetes | The scale doesn't justify it. Docker Compose is simpler and correct. | Single-machine Docker Compose. |
| API monetization / paywalls | Complex, changes the product fundamentally. Not in project vision. | AdSense only for now. |
| Separate analytics service | Adds cookies, GDPR risk, cost. Not needed for MVPs. | AdSense built-in reports or manual log analysis. |

## Feature Dependencies

```
Domain + DNS (A+wildcard) → Traefik + Let's Encrypt → Docker Compose root
  ↓
Astro landing → HTTPS → Content (blog, pages)
  ↓
Content + AdSense approval → Tool subdomain pattern → More tools
  ↓
Tool needs backend → FastAPI + SQLite + WAL
  ↓
Tool needs frontend interactivity → Next.js App Router
```

## MVP Recommendation

Prioritize:

1. **HTTPS landing** (Phase 1) — Technical foundation. Nothing works without this.
2. **Blog with 5-8 real articles** (Phase 2) — Content is the product for AdSense. Use existing technical projects. Each article must be original, technical, and substantial.
3. **One working tool with context page** (Phase 3) — Validates the subdomain pattern end-to-end: Traefik labels → Docker → tool → content → AdSense slot.

Defer: **Additional tools** (Phase 4+): Only after the pattern is validated and documented. **Complex tools with external API dependencies**: After the simple pattern is proven (hackathons tool needs Tavily/SerpApi + LLM filtering + dedup DB).

## Sources

- Google AdSense Program Policies (constantly updated — re-verify before Phase 2 completion)
- Competitor analysis: self-hosted portfolio + tool sites (Dev.to, personal blogs with tools)
- Project brief requirements analysis
