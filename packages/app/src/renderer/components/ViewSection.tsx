// @fctry: #desktop-app
//
// View Settings section (spec 0.26 §2.14). Persists column visibility, row
// density, sort, and default landing view via the preferences module.

import { useEffect, useState } from 'react';
import {
  type ColumnVisibility, type RowDensity, type LandingView,
  getColumns, setColumns, getDensity, setDensity, getLanding, setLanding,
  DEFAULT_COLUMNS,
} from '../lib/preferences';

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  status: 'Status',
  health: 'Health',
  type: 'Type',
  updated_at: 'Updated',
  area: 'Area',
};

export function ViewSection() {
  const [cols, setCols] = useState<ColumnVisibility>(DEFAULT_COLUMNS);
  const [density, setDensityState] = useState<RowDensity>('spacious');
  const [landing, setLandingState] = useState<LandingView>('grouped');

  useEffect(() => {
    setCols(getColumns());
    setDensityState(getDensity());
    setLandingState(getLanding());
  }, []);

  const toggleCol = (key: keyof ColumnVisibility) => {
    const next = { ...cols, [key]: !cols[key] };
    setCols(next);
    setColumns(next);
  };

  const pickDensity = (d: RowDensity) => {
    setDensityState(d);
    setDensity(d);
  };

  const pickLanding = (v: LandingView) => {
    setLandingState(v);
    setLanding(v);
  };

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">View</h2>

      <div className="border border-[var(--color-border)] rounded-md p-4 space-y-5">
        {/* Columns */}
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Columns</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mb-3">
            The Name column is always shown.
          </div>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(COLUMN_LABELS) as (keyof ColumnVisibility)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={cols[key]}
                  onChange={() => toggleCol(key)}
                  className="accent-[var(--color-accent)]"
                />
                {COLUMN_LABELS[key]}
              </label>
            ))}
          </div>
        </div>

        {/* Density */}
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Row density</div>
          <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => pickDensity('compact')}
              className={`px-3 py-1.5 text-xs ${density === 'compact'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'}`}
            >
              Compact
            </button>
            <button
              onClick={() => pickDensity('spacious')}
              className={`px-3 py-1.5 text-xs ${density === 'spacious'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'}`}
            >
              Spacious
            </button>
          </div>
        </div>

        {/* Default landing view */}
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Default landing view</div>
          <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => pickLanding('grouped')}
              className={`px-3 py-1.5 text-xs ${landing === 'grouped'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'}`}
            >
              Grouped lanes
            </button>
            <button
              onClick={() => pickLanding('flat')}
              className={`px-3 py-1.5 text-xs ${landing === 'flat'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'}`}
            >
              Flat grid
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
