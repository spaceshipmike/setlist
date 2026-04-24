# @setlist/app

Desktop control panel for the Setlist project registry. Electron shell,
React + Tailwind + Radix renderer, `@setlist/core` library in the main
process via IPC bridge.

## Develop

```bash
npm run dev         # electron-vite dev with live reload
npm run typecheck   # workspace typecheck
npm test            # unit tests (workspace)
npm run build       # electron-vite production build
npm start           # launch the built app
```

`scripts/with-electron-abi.sh` wraps `dev`/`build`/`preview`/`start` and
swaps `better-sqlite3`'s native binary between the Electron and Node
ABIs. If the MCP server ever fails with `NODE_MODULE_VERSION`, run
`npm run sqlite:node -w packages/app` to restore the Node binary.

## Release Setup

Releases are published to GitHub Releases and delivered via
`electron-updater` to users running the app. The release pipeline
(`.github/workflows/release.yml`) signs and notarizes the build — this
is mandatory for the auto-update path per spec `#hard-constraints`
(§4.3). A build without notarization is quarantined by macOS Gatekeeper
and the Squirrel.Mac install handoff fails.

### Required GitHub repository secrets

Configure these on the `setlist` repo under **Settings → Secrets and
variables → Actions**. The release workflow hard-fails with
`missing required env var: $NAME` if any are unset.

| Secret | What it is | 1Password reference |
|---|---|---|
| `APPLE_ID` | Apple ID email for the Developer account | `op://Dev/setlist-release/apple-id` |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated at [appleid.apple.com](https://appleid.apple.com) | `op://Dev/setlist-release/app-specific-password` |
| `APPLE_TEAM_ID` | 10-character Team ID from the Apple Developer portal | `op://Dev/setlist-release/team-id` |
| `CSC_LINK` | Base64-encoded `.p12` containing the Developer ID Application certificate + private key | `op://Dev/setlist-release/csc-link-base64` |
| `CSC_KEY_PASSWORD` | Password protecting the `.p12` | `op://Dev/setlist-release/csc-key-password` |

Exact 1Password item names above are placeholders — wire them to
whatever the vault uses. Never hardcode the values; the doctrine is
1Password-only for secrets.

### Generating `CSC_LINK`

```bash
# Export the Developer ID cert + key from Keychain as a .p12 in
# Keychain Access, then encode:
base64 -i Developer_ID_Application.p12 -o Developer_ID_Application.p12.b64
```

Paste the base64 string (one continuous line or multi-line, electron-
builder accepts both) into the `CSC_LINK` secret.

### Triggering a release

Push a tag matching `v*` (e.g., `v0.2.0`). The workflow:

1. Verifies all five signing credentials are set. Missing any → hard
   fail with `missing required env var: $NAME`. No silent skip.
2. `npm ci && npm run build`.
3. `electron-builder --mac --arm64 --publish always` signs with
   the Developer ID cert, notarizes via Apple's notary service, staples
   the ticket, and publishes the `.dmg` + `latest-mac.yml` /
   `beta-mac.yml` update metadata to the GitHub Release. Apple Silicon
   only — Intel builds were dropped at v0.2.4.

Non-prerelease tags feed the Stable channel; tags with a prerelease
component (`v0.2.0-beta.1`) feed the Beta channel. `electron-updater`
on the client reads `autoUpdater.allowPrerelease` to pick which tag
to honor — see `src/main/auto-update.ts`.

### Verifying a release locally

```bash
# Download the .dmg from the GitHub Release, mount it, then:
codesign -dv --verbose=4 /Volumes/Setlist/Setlist.app
codesign --verify --deep --strict /Volumes/Setlist/Setlist.app
spctl -a -vv /Volumes/Setlist/Setlist.app
xcrun stapler validate /Volumes/Setlist/Setlist.app
```

All four should pass. `spctl` should report `accepted` with source
`Notarized Developer ID`.

## Auto-update architecture

See `src/main/auto-update.ts`, `src/main/prefs.ts`,
`src/main/quit-prompt.ts`, and `src/main/menu.ts`. The renderer surfaces
are in `src/renderer/components/UpdatesSection.tsx` and
`src/renderer/components/UpdateToast.tsx`. Spec section: `#auto-update`
(§2.14.1) and scenarios S81–S90.
