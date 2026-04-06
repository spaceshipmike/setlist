# Setlist — Changelog

## 2026-04-06T13:00:00Z — write_fields MCP tool
<!-- Enables any producer (Chorus, fctry, user) to write extended fields to projects via MCP -->
- Appendix D: [modified] Added `write_fields` tool — write extended fields (short_description, medium_description, tech_stack, etc.) to a project with producer ownership. Wraps existing `registry.updateFields()`.
- Spec version: 0.4 → 0.5
(0 added, 1 modified, 0 removed)

## 2026-04-06T12:00:00Z — Portfolio intelligence support (observation type + portfolio_brief)
<!-- Step 2 of integration architecture: setlist provides the memory substrate for orchestrator continuity -->
- `#portfolio-memory` (2.12): [modified] Added `observation` memory type — cross-project findings from portfolio intelligence. Portfolio-scoped by default, carries verified/inferred confidence tag, decay rate 0.5
- `#portfolio-memory` (2.12): [modified] Added `portfolio_brief` agent tool — structured portfolio snapshot (active projects, portfolio memories, health indicators, pending observations) for session start
- `#scope` (4.1): [modified] Added portfolio intelligence support to scope coverage
- Appendix D: [modified] Added `portfolio_brief` to Memory — Agent tool reference
- Spec version: 0.3 → 0.4
(0 added, 4 modified, 0 removed)
