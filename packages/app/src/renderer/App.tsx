import { useState, useCallback, useRef } from 'react';
import { HomeView } from './views/HomeView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { SettingsView } from './views/SettingsView';
import { RegisterProjectDialog } from './components/RegisterProjectDialog';
import type { SortField } from './hooks/useProjects';

type View =
  | { kind: 'home' }
  | { kind: 'detail'; projectName: string }
  | { kind: 'settings' };

export function App(): JSX.Element {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [showRegister, setShowRegister] = useState(false);
  const refreshRef = useRef<(() => void) | null>(null);

  // Persistent filter/sort state
  const [filter, setFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortField>('name');

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
            sort={sort} onSortChange={setSort}
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
    </div>
  );
}
