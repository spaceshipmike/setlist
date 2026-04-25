// @fctry: #desktop-app
//
// Home view "Columns" popover (spec 0.26 §2.14). Lets the user toggle
// optional column visibility from the project list. Reads/writes the
// preferences module — same source of truth as the Settings panel.

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { type ColumnVisibility } from '../lib/preferences';

interface ColumnsControlProps {
  columns: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
}

const LABELS: Record<keyof ColumnVisibility, string> = {
  status: 'Status',
  health: 'Health',
  type: 'Type',
  updated_at: 'Updated',
  area: 'Area',
};

export function ColumnsControl({ columns, onChange }: ColumnsControlProps) {
  const toggle = (key: keyof ColumnVisibility) => {
    onChange({ ...columns, [key]: !columns[key] });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="px-3 py-1.5 rounded-md text-sm
            bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
            border border-[var(--color-border)]
            hover:border-[var(--color-border-strong)]
            focus:outline-none focus:border-[var(--color-accent-subtle)]
            transition-colors"
        >
          Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="min-w-[160px] rounded-md p-1
            bg-[var(--color-bg-elevated)] border border-[var(--color-border)]
            shadow-lg z-50"
        >
          {(Object.keys(LABELS) as (keyof ColumnVisibility)[]).map((key) => (
            <DropdownMenu.CheckboxItem
              key={key}
              checked={columns[key]}
              onCheckedChange={() => toggle(key)}
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded
                text-[var(--color-text-secondary)]
                hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]
                outline-none cursor-default select-none"
            >
              <span className={`w-3 h-3 rounded border flex items-center justify-center
                ${columns[key]
                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                  : 'border-[var(--color-border-strong)]'}`}
              >
                {columns[key] && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span>{LABELS[key]}</span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
