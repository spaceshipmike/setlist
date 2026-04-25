// @fctry: #desktop-app
//
// Compact / spacious row-density toggle for the project list (spec 0.26 §2.14).

import { type RowDensity } from '../lib/preferences';

interface Props {
  density: RowDensity;
  onChange: (next: RowDensity) => void;
}

export function DensityToggle({ density, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden"
      role="group"
      aria-label="Row density"
    >
      <button
        onClick={() => onChange('compact')}
        title="Compact rows"
        aria-pressed={density === 'compact'}
        className={`px-2.5 py-1.5 text-xs ${density === 'compact'
          ? 'bg-[var(--color-accent)] text-white'
          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'}`}
      >
        Compact
      </button>
      <button
        onClick={() => onChange('spacious')}
        title="Spacious rows"
        aria-pressed={density === 'spacious'}
        className={`px-2.5 py-1.5 text-xs ${density === 'spacious'
          ? 'bg-[var(--color-accent)] text-white'
          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'}`}
      >
        Spacious
      </button>
    </div>
  );
}
