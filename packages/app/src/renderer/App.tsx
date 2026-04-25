import { useState, useCallback, useEffect, useRef } from 'react';
import { HomeView } from './views/HomeView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { SettingsView } from './views/SettingsView';
import { RegisterProjectDialog } from './components/RegisterProjectDialog';
import { UpdateToast } from './components/UpdateToast';
import type { SortField, SortDir } from './hooks/useProjects';
import {
  getSortKey, setSortKey, getSortDir, setSortDir as savePrefSortDir,
} from './lib/preferences';

type View =
  | { kind: 'home' }
  | { kind: 'detail'; projectName: string }
  | { kind: 'settings' };

export function App(): JSX.Element {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [showRegister, setShowRegister] = useState(false);
  const refreshRef = useRef<(() => void) | null>(null);

  // Persistent filter/sort state — sort persisted to localStorage (spec 0.26).
  const [filter, setFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortField>(() => getSortKey() as SortField);
  const [sortDir, setSortDir] = useState<SortDir>(() => getSortDir());

  // Spec 0.26 §S121: persist sort across sessions.
  useEffect(() => { setSortKey(sort); }, [sort]);
  useEffect(() => { savePrefSortDir(sortDir); }, [sortDir]);

  // Spec 0.26 §S123: Cmd-, navigates to Settings when on Home.
  // The IPC channel is registered by Step 8 once the menu accelerator lands.
  useEffect(() => {
    const onNavSettings = () => setView({ kind: 'settings' });
    const w = window.setlist as unknown as { onNavigateToSettings?: (h: () => void) => void };
    w.onNavigateToSettings?.(onNavSettings);
  }, []);

  const navigateToProject = (name: string) => setView({ kind: 'detail', projectName: name });
  const navigateHome = useCallback(() => {
    setView({ kind: 'home' });
    refreshRef.current?.();
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Title bar drag area */}
      <div className="titlebar-drag h-8 shrink-0" />

      {/* Main content */}
      <main className="flex-1 overflow-auto px-6 pb-6">
        {view.kind === 'home' ? (
          <HomeView
            onProjectClick={navigateToProject}
            onRegister={() => setShowRegister(true)}
            onSettings={() => setView({ kind: 'settings' })}
            filter={filter} onFilterChange={setFilter}
            statusFilters={statusFilters} onStatusFiltersChange={setStatusFilters}
            sort={sort} sortDir={sortDir} onSortChange={setSort} onSortDirChange={setSortDir}
            onRefreshRef={(fn) => { refreshRef.current = fn; }}
          />
        ) : view.kind === 'settings' ? (
          <SettingsView onBack={navigateHome} />
        ) : (
          <ProjectDetailView
            projectName={view.projectName}
            onBack={navigateHome}
            onNavigate={navigateToProject}
          />
        )}
      </main>

      <RegisterProjectDialog
        open={showRegister}
        onOpenChange={setShowRegister}
        onSuccess={() => refreshRef.current?.()}
      />

      <UpdateToast />
    </div>
  );
}
