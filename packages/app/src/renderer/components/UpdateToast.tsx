// @fctry: #auto-update
// Non-blocking toast surfaced when an update finishes downloading.
// One toast per version (dedupe via ref) — duplicate `update-downloaded`
// events don't stack (S88). The toast is not shown during the download
// phase (S87 silent background download); only the single completion event
// produces user-visible UI.

import { useEffect, useRef, useState } from 'react';
import api, { type UpdateEventPayload } from '../lib/api';

export function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const lastVersionRef = useRef<string | null>(null);

  useEffect(() => {
    // Check current status on mount — if an update is already staged when
    // the window opens (e.g., downloaded earlier this session, user closed
    // a previous window), surface the toast.
    api.getUpdateStatus().then((s) => {
      if (s.downloaded && s.downloaded_version && lastVersionRef.current !== s.downloaded_version) {
        lastVersionRef.current = s.downloaded_version;
        setVersion(s.downloaded_version);
        setVisible(true);
      }
    }).catch(() => {});

    const unsubscribe = api.onUpdateEvent((payload: UpdateEventPayload) => {
      if (payload.outcome === 'downloaded') {
        const v = payload.version ?? null;
        // Dedupe: if the same version fires again, don't re-open.
        if (lastVersionRef.current === v && visible) return;
        lastVersionRef.current = v;
        setVersion(v);
        setVisible(true);
      }
    });
    return () => unsubscribe();
    // `visible` intentionally omitted — we only want to re-wire on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const handleQuitInstall = async () => {
    setInstalling(true);
    try {
      await api.quitAndInstallUpdate();
    } catch {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    // Dismissing leaves the update staged — it installs on next natural quit
    // via the S89 quit prompt.
    setVisible(false);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm
        rounded-lg border border-[var(--color-border)]
        bg-[var(--color-bg-card)] shadow-lg
        p-4 flex flex-col gap-3 titlebar-no-drag"
    >
      <div>
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          Update ready — install on next quit
        </div>
        {version && (
          <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            Version {version}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleQuitInstall}
          disabled={installing}
          className="px-3 py-1.5 rounded text-xs font-medium
            bg-[var(--color-accent)] text-white
            hover:bg-[var(--color-accent-hover)]
            disabled:opacity-50 transition-colors"
        >
          {installing ? 'Quitting…' : 'Quit and install'}
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded text-xs
            text-[var(--color-text-secondary)]
            hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
