# Proposal: Area vs Project Distinction

**Date:** 2026-04-09
**Status:** SUPERSEDED — incorporated into spec 0.13 (2026-04-15). See §2.12 (canonical areas), §2.14 (Home view grouped lanes), §3.2 (Areas + sub-project relationships), §3.3 (rules), and §5.2 (v10→v11 migration). Retained for historical reasoning.
**Affects:** Section 2.14 (Desktop Control Panel), Section 3.2 (Entities), Section 3.3 (Rules and Logic), Schema

## Problem

Areas of focus and projects share the same field model. Areas have "goals" that don't make sense — areas are ongoing domains of responsibility, not time-bound efforts with completion criteria. There's no way to express that a project belongs to an area. The home view treats everything as a flat list.

## Design Decisions

1. **Areas get different profile fields.** Replace `goals` with `responsibilities` (what the area is accountable for) and `domains` (subject matter the area covers). Areas don't converge or complete — they persist.

2. **Projects get an optional `area` field.** A project can declare which area of focus it belongs to. Every project has an area but not every area has projects. The link is optional to avoid forcing cleanup of existing data.

3. **Home view gets an optional grouped-by-area view.** Alongside the current flat list, the user can toggle a view that groups projects under their parent area. Areas without projects still appear. Ungrouped projects (no area set) appear in their own section.

## Schema Impact

- `projects` table: add `area TEXT` column (nullable, references another project's `name` where `type = 'area_of_focus'`)
- `projects` table: add `responsibilities TEXT NOT NULL DEFAULT '[]'` and `domains TEXT NOT NULL DEFAULT '[]'` columns (JSON arrays, used only when `type = 'area_of_focus'`)
- `goals` remains on the table but is semantically irrelevant for areas — migration can copy existing area goals into responsibilities

## Status Validation Changes

- Areas: `active`, `paused` (unchanged)
- Projects: `idea`, `draft`, `active`, `paused`, `complete`, `archived` (unchanged)
- Areas cannot be `archived` or `complete` (unchanged, but worth restating given the new distinction)

## UI Changes

- Edit form: show `responsibilities`/`domains` for areas, `goals` for projects
- Edit form: project type shows an `area` dropdown (populated from registered areas)
- Home view: add a view toggle (flat list / grouped by area)
- Detail view: area projects show a "Projects in this area" section; project detail shows parent area link

## MCP Tool Changes

- `register_project`: accept optional `area` field
- `update_project`: accept optional `area` field
- `write_fields`: support `responsibilities` and `domains` for areas
- `list_projects`: support `area` filter
