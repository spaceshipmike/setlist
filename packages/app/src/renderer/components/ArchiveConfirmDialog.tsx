import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import api from '../lib/api';
import { friendlyError } from '../lib/errors';

interface ArchiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onSuccess: () => void;
}

export function ArchiveConfirmDialog({ open, onOpenChange, projectName, onSuccess }: ArchiveConfirmDialogProps) {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setError(null);
    try {
      setArchiving(true);
      await api.archiveProject(projectName);
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setArchiving(false);
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
          <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Archive {projectName}?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-secondary)] mb-6">
            This will set the project to archived status, release all ports, and clear capabilities.
            The project data is preserved and can be restored.
          </Dialog.Description>

          {error && (
            <div className="text-sm text-[var(--color-error)] bg-[var(--color-bg-card)] rounded-md p-2 mb-4">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)]
                hover:bg-[var(--color-bg-card)] transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="px-4 py-2 rounded-md text-sm font-medium
                bg-[var(--color-error)] text-white
                hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {archiving ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
