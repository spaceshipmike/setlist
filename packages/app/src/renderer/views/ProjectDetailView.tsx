import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useProject } from '../hooks/useProject';
import { ProjectHeader } from '../components/ProjectHeader';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { MemoryTab } from '../components/tabs/MemoryTab';
import { CapabilitiesTab } from '../components/tabs/CapabilitiesTab';
import { PortsTab } from '../components/tabs/PortsTab';
import { EditProjectForm } from '../components/EditProjectForm';
import { ArchiveConfirmDialog } from '../components/ArchiveConfirmDialog';
import { RenameDialog } from '../components/RenameDialog';

interface ProjectDetailViewProps {
  projectName: string;
  onBack: () => void;
  onNavigate?: (name: string) => void;
}

export function ProjectDetailView({ projectName, onBack, onNavigate }: ProjectDetailViewProps) {
  const { project, capabilities, ports, memories, loading, error, refresh } = useProject(projectName);
  const [editing, setEditing] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showRename, setShowRename] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-text-tertiary)]">Loading...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="py-8">
        <button
          onClick={onBack}
          className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-sm mb-4"
        >
          &larr; Back to projects
        </button>
        <div className="text-[var(--color-error)]">{error || 'Project not found'}</div>
      </div>
    );
  }

  return (
    <div>
      <ProjectHeader
        name={project.name}
        displayName={project.display_name}
        type={project.type}
        status={project.status}
        description={project.description ?? ''}
        onBack={onBack}
        onEdit={() => setEditing(true)}
        onArchive={() => setShowArchive(true)}
        onRename={() => setShowRename(true)}
      />

      {editing && (
        <div className="mb-6">
          <EditProjectForm
            name={project.name}
            currentValues={{
              display_name: project.display_name,
              status: project.status,
              description: project.description ?? '',
              goals: Array.isArray(project.goals) ? project.goals.join(', ') : (project.goals ?? ''),
              area: project.area ?? null,
              parent_project: project.parent_project ?? null,
            }}
            projectType={project.type}
            onSave={() => { setEditing(false); refresh(); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      <Tabs.Root defaultValue="overview">
        <Tabs.List className="flex gap-1 border-b border-[var(--color-border)] mb-4">
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="memory">
            Memory {memories.length > 0 && <Count n={memories.length} />}
          </TabTrigger>
          <TabTrigger value="capabilities">
            Capabilities {capabilities.length > 0 && <Count n={capabilities.length} />}
          </TabTrigger>
          <TabTrigger value="ports">
            Ports {ports.length > 0 && <Count n={ports.length} />}
          </TabTrigger>
        </Tabs.List>

        <Tabs.Content value="overview">
          <OverviewTab project={project} />
        </Tabs.Content>
        <Tabs.Content value="memory">
          <MemoryTab memories={memories} />
        </Tabs.Content>
        <Tabs.Content value="capabilities">
          <CapabilitiesTab capabilities={capabilities} />
        </Tabs.Content>
        <Tabs.Content value="ports">
          <PortsTab ports={ports} />
        </Tabs.Content>
      </Tabs.Root>

      <ArchiveConfirmDialog
        open={showArchive}
        onOpenChange={setShowArchive}
        projectName={project.name}
        onSuccess={onBack}
      />

      <RenameDialog
        open={showRename}
        onOpenChange={setShowRename}
        currentName={project.name}
        onSuccess={(newName) => {
          if (onNavigate) onNavigate(newName);
          else refresh();
        }}
      />
    </div>
  );
}

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="px-3 py-2 text-sm text-[var(--color-text-tertiary)]
        hover:text-[var(--color-text-secondary)]
        data-[state=active]:text-[var(--color-accent)]
        data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)]
        data-[state=active]:-mb-px
        transition-colors"
    >
      {children}
    </Tabs.Trigger>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)]">
      {n}
    </span>
  );
}
