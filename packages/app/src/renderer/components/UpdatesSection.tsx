// @fctry: #auto-update
// Settings > Updates section. Shows current version, a Stable/Beta
// channel toggle, Check now button, and a persistent status line
// that survives launches (S90). The status line is the *only* durable
// in-app record of update activity — no history list, no log.
//
// In dev mode, the section shows "Updates disabled in development" and
// hides the interactive controls (S81 criterion: "either indicates
// 'Updates disabled in development' or hides check-related controls").

import { useCallback, useEffect, useState } from 'react';
import api, {
  type UpdateChannel,
  type UpdateStatus,
  type UpdateEventPayload,
  type LastCheck,
  type UpdateOutcome,
} from '../lib/api';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  // Fall back to ISO date for anything older than a week.
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function describeOutcome(check: LastCheck): string {
  switch (check.outcome) {
    case 'checking':
      return 'Checking for updates…';
    case 'up-to-date':
      return 'Up to date';
    case 'update-available':
      return check.version
        ? `Update available — v${check.version}`
        : 'Update available';
    case 'downloading':
      return check.version
        ? `Downloading v${check.version}…`
        : 'Downloading update…';
    case 'downloaded':
      return check.version
        ? `Update ready — v${check.version} will install on next quit`
        : 'Update ready — install on next quit';
    case 'error':
      return check.message ? `Check failed: ${check.message}` : 'Check failed';
    default:
      return check.outcome;
  }
}

function outcomeColor(outcome: UpdateOutcome): string {
  switch (outcome) {
    case 'error':
      return 'var(--color-error)';
    case 'downloaded':
    case 'update-available':
      return 'var(--color-accent)';
    default:
      return 'var(--color-text-secondary)';
  }
}

export function UpdatesSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveCheck, setLiveCheck] = useState<LastCheck | null>(null);
  const [toggling, setToggling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getUpdateStatus();
      setStatus(s);
      setLiveCheck(s.last_check);
    } catch (err) {
      console.error('[updates-section] failed to load status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Live-update the status line as events arrive (S90 "updates in place").
    const unsubscribe = api.onUpdateEvent((payload: UpdateEventPayload) => {
      setLiveCheck({
        timestamp: payload.timestamp,
        outcome: payload.outcome,
        ...(payload.message !== undefined ? { message: payload.message } : {}),
        ...(payload.version !== undefined ? { version: payload.version } : {}),
      });
    });
    return () => unsubscribe();
  }, []);

  const handleChannelChange = async (channel: UpdateChannel) => {
    if (!status || status.channel === channel) return;
    setToggling(true);
    try {
      await api.setUpdateChannel(channel);
      await refresh();
    } finally {
      setToggling(false);
    }
  };

  const handleCheckNow = async () => {
    await api.checkForUpdates();
    await refresh();
  };

  if (loading) {
    return (
      <div className="mt-8">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">Updates</h2>
        <div className="text-sm text-[var(--color-text-tertiary)]">Loading…</div>
      </div>
    );
  }

  if (!status) return <></>;

  const devMode = status.dev_mode;
  const showStatus = liveCheck ?? status.last_check;

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Updates</h2>
      <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
        Setlist checks GitHub Releases periodically. Quiet by default — updates install on next quit.
      </p>

      <div className="py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">Current version</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5 font-mono">
            v{status.version}
          </div>
        </div>
      </div>

      {devMode ? (
        <div className="py-3 border-b border-[var(--color-border)]">
          <div className="text-sm text-[var(--color-text-secondary)]">
            Updates disabled in development.
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Update checks and channel switching are only active in packaged builds.
          </div>
        </div>
      ) : (
        <>
          <div className="py-3 border-b border-[var(--color-border)]">
            <div className="text-sm font-medium text-[var(--color-text-primary)] mb-0.5">Channel</div>
            <div className="text-xs text-[var(--color-text-tertiary)] mb-2">
              Stable is recommended. Beta delivers prereleases earlier — expect rougher edges.
            </div>
            <div
              role="radiogroup"
              aria-label="Update channel"
              className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden"
            >
              {(['stable', 'beta'] as const).map((ch) => {
                const selected = status.channel === ch;
                return (
                  <button
                    key={ch}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleChannelChange(ch)}
                    disabled={toggling}
                    className={
                      selected
                        ? 'px-3 py-1 text-xs font-medium bg-[var(--color-accent)] text-white'
                        : 'px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors'
                    }
                  >
                    {ch === 'stable' ? 'Stable' : 'Beta'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  Last checked
                </div>
                {showStatus ? (
                  <>
                    <div
                      className="text-sm mt-0.5"
                      style={{ color: outcomeColor(showStatus.outcome) }}
                    >
                      {describeOutcome(showStatus)}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {formatTimestamp(showStatus.timestamp)}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5 italic">
                    No checks this session yet
                  </div>
                )}
              </div>
              <button
                onClick={handleCheckNow}
                disabled={status.in_flight || showStatus?.outcome === 'checking'}
                className="px-3 py-1 rounded text-xs
                  bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
                  border border-[var(--color-border)] hover:border-[var(--color-border-strong)]
                  disabled:opacity-50 transition-colors shrink-0"
              >
                {status.in_flight || showStatus?.outcome === 'checking' ? 'Checking…' : 'Check now'}
              </button>
            </div>
          </div>

          {status.downloaded && (
            <div className="py-3 border-b border-[var(--color-border)]">
              <div className="text-sm text-[var(--color-accent)] font-medium">
                Update staged
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {status.downloaded_version
                  ? `v${status.downloaded_version} will install when you quit — you'll be asked to confirm.`
                  : 'A new version will install when you quit — you\'ll be asked to confirm.'}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
