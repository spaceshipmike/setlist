// @fctry: #entities
//
// Reassign-modal flow used before deleting an area or project_type that has
// attached projects (spec 0.26 §2.14). The user picks a replacement, the
// caller reassigns each project, and the delete proceeds.

import { useState } from 'react';

interface Option {
  id: number;
  name: string;
  count: number; // projects currently using this option
}

interface ReassignModalProps {
  title: string;
  description: string;
  options: Option[];
  onCancel: () => void;
  onConfirm: (newId: number) => void;
}

export function ReassignModal({ title, description, options, onCancel, onConfirm }: ReassignModalProps) {
  const [picked, setPicked] = useState<number | null>(options[0]?.id ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-6 w-[420px] max-w-[90vw]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{title}</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">{description}</p>

        <div className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-sm text-[var(--color-text-tertiary)] italic">
              No alternative available. Create one first, then come back.
            </div>
          ) : (
            options.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                  picked === opt.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg-elevated)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]'
                }`}
              >
                <input
                  type="radio"
                  checked={picked === opt.id}
                  onChange={() => setPicked(opt.id)}
                  className="accent-[var(--color-accent)]"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{opt.name}</div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    {opt.count} project{opt.count === 1 ? '' : 's'} attached
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-sm
              text-[var(--color-text-secondary)]
              hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => picked != null && onConfirm(picked)}
            disabled={picked == null}
            className="px-3 py-1.5 rounded text-sm font-medium
              bg-[var(--color-accent)] text-white
              hover:bg-[var(--color-accent-hover)]
              disabled:opacity-50 transition-colors"
          >
            Reassign and delete
          </button>
        </div>
      </div>
    </div>
  );
}
