// @fctry: #entities
//
// Curated 12-color palette for areas and project types (spec 0.26 §2.14).
// Presented as a click-to-select grid. Mirrors core/AREA_COLOR_PALETTE.

import { AREA_COLOR_PALETTE } from '../lib/api';

interface ColorPaletteProps {
  selected: string | null;
  onSelect: (color: string) => void;
}

export function ColorPalette({ selected, onSelect }: ColorPaletteProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {AREA_COLOR_PALETTE.map((color) => {
        const isSelected = color === selected;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            aria-label={`Pick ${color}`}
            className={`h-7 w-7 rounded-full transition-transform ${
              isSelected
                ? 'ring-2 ring-offset-2 ring-[var(--color-accent)] ring-offset-[var(--color-bg-base)] scale-110'
                : 'hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
