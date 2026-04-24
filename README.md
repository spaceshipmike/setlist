# Setlist

A personal project registry and intelligence hub. Setlist is the structured memory of every project, area of life, and tool I work on — usable from agents (via MCP), from the terminal (via a CLI), from any Node.js process (via a library import), and from a native macOS app.

This is built primarily for my own workflow, but the architecture is general. The repo is public so the auto-update path can reach the running app from GitHub Releases.

## What it does

Setlist holds a small SQLite database (~/.local/share/project-registry/registry.db) and exposes it through four interfaces. The database tracks:

- **Project identity** — every project I work on, with paths, tech stack, goals, status, and free-form descriptions agents can read
- **Canonical areas** — every project lives under one of seven areas (Work, Family, Home, Health, Finance, Personal, Infrastructure), with optional parent-child sub-project relationships
- **Capability declarations** — what an MCP server exposes, what CLI commands a tool offers, what a library exports — so other agents can discover what's available without reading source
- **Portfolio memory** — typed observations across projects (insights, decisions, contradictions, procedural knowledge) with full-text search, belief classification, temporal validity, and area-scoped inheritance
- **Per-project essence digests** — short generated summaries of each project, useful for embedding, semantic matching, or dropping into another agent's context
- **Port allocation** — conflict-free local-port assignment for development services
- **Composite project health** — qualitative tier (Healthy / At risk / Stale) per project, computed from activity, profile completeness, and outcome signals

The point: an agent working on any project in my ecosystem can ask Setlist "what is this project, what depends on it, what have we learned about it" and get a structured, queryable answer.

## How to use it

**Download the desktop app** from [Releases](https://github.com/spaceshipmike/setlist/releases) — `.dmg` for macOS Apple Silicon. Signed, notarized, with in-app auto-update over a stable channel.

**As an MCP server**, point Claude Desktop at `@setlist/mcp` (39 tools covering everything above).

**As a Node.js library**, `npm install @setlist/core` and import directly — Chorus, Ensemble, and other tools in my ecosystem use this path rather than going through the MCP protocol.

**As a CLI**, `setlist` provides the same surface from the terminal (`setlist list`, `setlist register`, `setlist memory recall`, etc.).

## How it's built

Four npm workspace packages:

```
packages/
├── core/    @setlist/core  — library: SQLite + all registry logic
├── mcp/     @setlist/mcp   — MCP server (39 tools, stdio transport)
├── cli/     @setlist/cli   — CLI commands + async worker
└── app/     @setlist/app   — Electron desktop control panel
```

**Stack:** TypeScript, better-sqlite3 (synchronous native bindings), the official `@modelcontextprotocol/sdk`, Electron 35 + React 19 + Tailwind CSS 4 + Radix UI for the desktop app. ESM-only, no CJS. Schema v12 (20 tables, FTS5 for memory search, WAL mode).

**Architecture decisions worth knowing:**

- `@setlist/core` is the primary interface; MCP, CLI, and the desktop app are thin wrappers over it. The Electron main process imports `@setlist/core` directly via an IPC bridge — no API server sits between the UI and the database.
- The desktop app and the MCP server need different native ABIs for `better-sqlite3` (Electron's Node vs. standalone Node). A wrapper script swaps binaries between dev/build/start steps and a session-start hook checks ABI integrity.
- The desktop app shares a design system (`chorus-ui`) with another personal app (Chorus) — same surfaces, accents, typography, status colors. The information architecture is Setlist's own.

**Spec-driven, not test-driven.** Setlist is built using a workflow called [fctry](https://github.com/spaceshipmike/fctry) (factory). The complete behavioral contract is described in plain English in `.fctry/spec.md` (NLSpec v2 format) and validated by 118 end-to-end scenarios in `.fctry/scenarios.md`. The scenarios are evaluated by an LLM-as-judge — they're the holdout set, not test fixtures shown to the coding agent during builds. Vitest runs alongside as a fast local canary, but it's not the truth signal.

What this means in practice:
- I describe behavior in user-facing language; the coding agent picks the implementation
- Every change starts with a spec evolution, then code follows
- Pull requests don't pass because tests pass — they pass because the relevant scenarios still satisfy under LLM evaluation

The full contract: [`.fctry/spec.md`](.fctry/spec.md) (~6500 lines describing every surface, dimension, and invariant) and [`.fctry/scenarios.md`](.fctry/scenarios.md) (118 scenarios).

## Develop

```bash
git clone https://github.com/spaceshipmike/setlist.git
cd setlist
npm install
npm run typecheck
npm test
npm run build       # builds core → cli → mcp (dependency order)
```

For the desktop app:

```bash
cd packages/app
npm run dev         # electron-vite live reload
npm run build       # production build
npm start           # launch the built app
```

## Release

Tagging `vX.Y.Z` triggers the GitHub Actions workflow in [`.github/workflows/release.yml`](.github/workflows/release.yml). It signs with a Developer ID certificate, notarizes via Apple's notary service, staples the ticket, and publishes a GitHub Release containing the `.dmg` + `.zip` + `latest-mac.yml` update metadata. The running app's `electron-updater` reads `latest-mac.yml` to detect updates.

See [`packages/app/README.md`](packages/app/README.md) for credential setup and signing details.

## Status

Spec version 0.25, external version reflects the latest tag. 118 scenarios all satisfied. The project is actively developed against my own usage; APIs and schema may shift between minor versions until 1.0.

## License

No formal license yet — this is personal infrastructure published openly. If you want to use any of the code beyond reading it, open an issue and we'll figure something out.
