import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import api from '../lib/api';
import { friendlyError } from '../lib/errors';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSuccess: (newName: string) => void;
}

export function RenameDialog({ open, onOpenChange, currentName, onSuccess }: RenameDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setNewName(currentName);
      setError(null);
      setDuplicateWarning(null);
    }
  }, [open, currentName]);

  // Debounced duplicate check
  useEffect(() => {
    const trimmed = newName.trim();
    setDuplicateWarning(null);

    if (!trimmed || trimmed === currentName || !/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) return;

    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const existing = await api.getProject(trimmed, 'minimal');
        if (existing) {
          setDuplicateWarning(`A project named "${trimmed}" already exists. Choose a different name.`);
        }
      } catch {
        // Ignore — check is best-effort
      }
    }, 300);

    return () => clearTimeout(checkTimer.current);
  }, [newName, currentName]);

  const formatError = (): string | null => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) return null;
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) {
      return 'Name must be lowercase, start with a letter or number, and contain only letters, numbers, hyphens, and underscores.';
    }
    return null;
  };

  const validationError = formatError();

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName || validationError || duplicateWarning) return;

    try {
      setSaving(true);
      await api.renameProject(currentName, trimmed);
      onOpenChange(false);
      onSuccess(trimmed);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-sm p-6 rounded-xl
          bg-[var(--color-bg-elevated)] border border-[var(--color-border)]
          shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Rename project
          </Dialog.Title>

          <form onSubmit={handleRename} className="space-y-4">
            <label className="block">
              <span className="text-xs text-[var(--color-text-tertiary)] mb-1 block">New name</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="input-field font-mono"
                autoFocus
              />
            </label>

            {(validationError || duplicateWarning) && (
              <div className="text-sm text-[var(--color-warning)] bg-[var(--color-bg-card)] rounded-md p-2">
                {validationError || duplicateWarning}
              </div>
            )}

            {error && (
              <div className="text-sm text-[var(--color-error)] bg-[var(--color-bg-card)] rounded-md p-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)]
                    hover:bg-[var(--color-bg-card)] transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={saving || !newName.trim() || newName.trim() === currentName || !!validationError || !!duplicateWarning}
                className="px-4 py-2 rounded-md text-sm font-medium
                  bg-[var(--color-accent)] text-white
                  hover:bg-[var(--color-accent-hover)]
                  disabled:opacity-50 transition-colors"
              >
                {saving ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
