import type { Capability } from '../../lib/api';

interface CapabilitiesTabProps {
  capabilities: Capability[];
}

export function CapabilitiesTab({ capabilities }: CapabilitiesTabProps) {
  if (capabilities.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-tertiary)]">
        No capabilities declared
      </div>
    );
  }

  // Group by type
  const grouped: Record<string, Capability[]> = {};
  for (const cap of capabilities) {
    const type = cap.type || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(cap);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, caps]) => (
        <div key={type}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
            {type} ({caps.length})
          </h3>
          <div className="space-y-2">
            {caps.map((cap) => (
              <div
                key={cap.name}
                className="p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-[var(--color-text-primary)]">
                    {cap.name}
                  </span>
                  {cap.requires_auth && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-warning)] text-[var(--color-bg)]">
                      auth
                    </span>
                  )}
                </div>
                {cap.description && (
                  <p className="text-xs text-[var(--color-text-secondary)]">{cap.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
