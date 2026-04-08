interface EmptyStateProps {
  onRegister: () => void;
}

export function EmptyState({ onRegister }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-4 opacity-40">
        { /* Simple project icon using CSS */ }
        <div className="w-16 h-16 mx-auto rounded-lg border-2 border-dashed border-[var(--color-border-strong)]" />
      </div>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
        No projects yet
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-sm">
        Register your first project to start managing your portfolio.
      </p>
      <button
        onClick={onRegister}
        className="px-4 py-2 rounded-md text-sm font-medium
          bg-[var(--color-accent)] text-white
          hover:bg-[var(--color-accent-hover)]
          transition-colors"
      >
        Register a project
      </button>
    </div>
  );
}
