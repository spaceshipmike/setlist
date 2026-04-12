interface EmptyStateProps {
  onRegister: () => void;
}

export function EmptyState({ onRegister }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Stylized project stack illustration */}
      <div className="mb-6 relative">
        <div className="w-20 h-14 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] opacity-30 absolute -top-2 left-1/2 -translate-x-1/2 rotate-2" />
        <div className="w-20 h-14 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] opacity-50 absolute -top-1 left-1/2 -translate-x-1/2 -rotate-1" />
        <div className="w-20 h-14 rounded-lg border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-bg-card)] relative flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
      </div>

      <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
        Your project registry is empty
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-xs leading-relaxed">
        Register your first project to start managing your portfolio. Projects registered here are
        visible to all your tools and agents.
      </p>
      <button
        onClick={onRegister}
        className="px-5 py-2.5 rounded-lg text-sm font-medium
          bg-[var(--color-accent)] text-white
          hover:bg-[var(--color-accent-hover)]
          transition-colors shadow-sm"
      >
        Register your first project
      </button>
    </div>
  );
}
