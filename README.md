# GitHubble

**Your telescopic view into repo galaxies.**

GitHubble is a visual discovery interface for public GitHub repositories. Instead of scrolling
search-result lists, you explore repositories as a navigable galaxy:

- **Every repository is a star.** More GitHub stars → a larger, brighter star (log scale).
- **Similar repositories sit near each other.** Categories form neighborhoods along spiral arms.
- **Search and filters** light up matching stars and dim the rest, so the surrounding
  neighborhood stays visible as context.

Two views of the same galaxy:

1. **Telescope**: an immersive perspective view you orbit and zoom like a telescope mount.
2. **Above the Plane**: a top-down map of the same coordinates.

## Status

**Phase 1: Fake Universe** (in progress). The full visual experience runs on a local sample
dataset of well-known open-source repositories with approximate metadata. There is no backend and
no GitHub or Supabase connection yet. That is deliberate: this phase exists to answer whether
exploring repositories this way is genuinely compelling.

| Phase | Scope | Status |
| --- | --- | --- |
| 1. Fake Universe | Rendering, cameras, hover/select, card, search, filters, Show Similar on sample data | In progress |
| 2. Real Universe | Supabase + importer, real GitHub metadata | Planned |
| 3. Relationships | Similarity scoring, clustering, persisted spiral-arm layout | Planned |
| 4. Intelligence | Embeddings (pgvector), semantic search, star growth, trending | Planned |

## Getting started

Requires Node.js 20.9+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Three.js · React Three Fiber · Zustand
