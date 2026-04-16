# Build Trace — Auto-Update (spec 0.14, S81–S90)

**Run ID:** run-auto-update-20260416
**Target spec section:** `#auto-update` (§2.14.1), `#hard-constraints` (§4.3), `#ts-decisions` (§5.3)
**Scenarios:** S81–S90
**Spec version at build:** 0.14
**Status:** completed (with one documented gap — S82 positive branch)
**Chunks:** 6/6 completed, all tagged

## Chunk Ledger

| # | Chunk | Scenarios | Commit | Tag |
|---|-------|-----------|--------|-----|
| 1 | Update preferences storage | S83, S90 | d9d527a | v0.1.27 |
| 2 | electron-updater integration + dev-skip | S81, S84 | 68f8277 | v0.1.28 |
| 3 | Settings > Updates UI + toast | S87, S88, S90 | a451535 | v0.1.29 |
| 4 | macOS App menu (About + Check for Updates…) | S85, S86 | 0070a91 | v0.1.30 |
| 5 | Failure handling + quit-prompt flow | S89 | 1df0a39 | v0.1.31 |
| 6 | Release pipeline + signing/notarization | S82 (negative) | 34eb9ee | v0.1.32 |

## What Changed

**New files (9):**
- `packages/app/src/main/prefs.ts` — typed JSON-backed prefs (channel + last-check)
- `packages/app/src/main/menu.ts` — macOS app menu with About + Check for Updates…
- `packages/app/src/main/quit-prompt.ts` — before-quit install/skip prompt
- `packages/app/src/renderer/components/UpdateToast.tsx` — downloaded-update toast
- `packages/app/src/renderer/components/UpdatesSection.tsx` — Settings > Updates
- `packages/app/build/entitlements.mac.plist` — hardened-runtime entitlements
- `packages/app/README.md` — release setup docs

**Modified (6):**
- `packages/app/src/main/auto-update.ts` — refactored to event-emitting subsystem reading channel from prefs
- `packages/app/src/main/index.ts` — wire prefs, menu, quit-prompt, dev-skip guard
- `packages/app/src/main/ipc.ts` — 4 new IPC handlers
- `packages/app/src/preload/index.ts` — expose update API + event subscription
- `packages/app/src/renderer/lib/api.ts` — typed wrappers for update API
- `packages/app/src/renderer/views/SettingsView.tsx` — mount UpdatesSection
- `packages/app/src/renderer/App.tsx` — mount UpdateToast
- `packages/app/electron-builder.yml` — `notarize: true`, hardened runtime, entitlements reference
- `.github/workflows/release.yml` — credential verification step + secrets wiring

## Scenario Coverage

| ID | Status | Notes |
|----|--------|-------|
| S81 | satisfied | Dev-skip guard in index.ts + IPC `checkForUpdates` returns `{dev_skip: true}` + menu item disabled in dev |
| S82 | partial | Negative branch (hard-fail on missing creds) verified via shell dry-run. Positive branch pending user wiring Apple Developer credentials as GitHub secrets |
| S83 | satisfied | Channel persists via `~/Library/Application Support/Setlist/update-prefs.json`, loaded in app.whenReady() |
| S84 | satisfied | `autoUpdater.channel` + `autoUpdater.allowPrerelease` both set in applyChannel() |
| S85 | satisfied | Menu item calls handleMenuCheckForUpdates; isCheckInFlight() guards duplicates |
| S86 | satisfied | app.setAboutPanelOptions with applicationVersion="vX.Y.Z (Channel)" and version=build date |
| S87 | satisfied | No UI during download phase — only `downloaded` outcome produces a toast |
| S88 | satisfied | UpdateToast dedupes by version ref — one toast per download |
| S89 | satisfied | before-quit handler with autoInstallOnAppQuit=false ensures prompt is authoritative |
| S90 | satisfied | Persisted last-check with plain-language errors, status line updates in place, no toasts on failure |

## Resumption Context

**Tried and confirmed:**
- `autoUpdater.channel` + `autoUpdater.allowPrerelease` together (both required for GitHub provider).
- Atomic JSON writes (tmp + rename) in prefs.ts — avoids half-written files on crash.
- `autoInstallOnAppQuit = false` + explicit before-quit handler — gives a real install-or-skip choice.
- Disabling `gatekeeperAssess` in electron-builder.yml — CI Gatekeeper can be unreliable; notarization + staple is the actual contract.

**Deferred insights:**
- The MemoryRetrieval `recall()` call in `ipc.ts:116` has a pre-existing shape mismatch (passes `project` where the type expects `project_id`). Out of scope for this build but worth noting — it compiles via vite's esbuild but fails isolated tsc.
- The workspace typecheck script skips the app package. Adding a per-package typecheck target would catch app-level TS errors before build.
- UpdateToast currently shows only on the currently-focused window's renderer context. If the user opens multiple windows simultaneously in the future, toast dedupe would need a main-process coordinator.

## Wins

- Clean 6-chunk run: every chunk compiled + built on first attempt, no retries.
- New infrastructure (menu, quit-prompt, prefs) integrated with zero changes to unrelated subsystems — the adapter boundary between update concerns and the rest of the app held.
- Experience language stays consistent across Settings UI, toast, quit dialog, About panel — "Stable / Beta", "Update ready — install on next quit", "Install and quit / Skip".
- Release workflow hard-fail behavior verified via local shell dry-run before committing, so we know the S82 negative path works end-to-end even without pushing a tag.

## Gap: S82 Positive Branch

S82 positive branch requires a real signed + notarized `.app` from a tagged release, inspected on a Gatekeeper-enforced machine with all of: `codesign -dv`, `codesign --verify`, `spctl -a`, `stapler validate`.

The pipeline is wired to produce that artifact once the user configures these GitHub repo secrets:
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `CSC_LINK` (base64-encoded Developer ID `.p12`)
- `CSC_KEY_PASSWORD`

Credential acquisition is a user-managed step. Until those secrets exist, a tag push causes the workflow's `Verify signing credentials` step to exit 1 with explicit `missing required env var: $NAME` messages — the S82 negative branch behavior. Once the secrets are in place, the next tag push will produce a signed + notarized artifact and S82 positive becomes observable.
