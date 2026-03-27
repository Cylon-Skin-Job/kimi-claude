/**
 * @module ContentArea
 * @role Routes workspace ID to the correct content component
 *
 * Priority order:
 * 1. If workspace has ui/ folder (hasUiFolder) → RuntimeModule (plugin)
 * 2. If workspace has built-in component → static component
 * 3. Otherwise → placeholder
 */

import type { ComponentType } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { RuntimeModule } from './RuntimeModule';
import { FileExplorer } from './file-explorer/FileExplorer';
import { WikiExplorer } from './wiki/WikiExplorer';
import { TicketBoard } from './tickets/TicketBoard';
import { AgentTiles } from './agents/AgentTiles';
import { CaptureTiles } from './capture/CaptureTiles';

/** Built-in component map: workspace ID → content component */
const CONTENT_COMPONENTS: Record<string, ComponentType> = {
  capture: CaptureTiles,
  'coding-agent': FileExplorer,
  wiki: WikiExplorer,
  issues: TicketBoard,
  'background-agents': AgentTiles,
};

interface ContentAreaProps {
  workspace: string;
}

export function ContentArea({ workspace }: ContentAreaProps) {
  const config = useWorkspaceStore((s) => s.getWorkspaceConfig(workspace));

  // Priority 1: Runtime-loaded plugin (ui/ folder exists)
  if (config?.hasUiFolder) {
    return (
      <main className="content-area">
        <RuntimeModule workspace={workspace} config={config} />
      </main>
    );
  }

  // Priority 2: Built-in component
  const Component = CONTENT_COMPONENTS[workspace];
  if (Component) {
    return (
      <main className="content-area">
        <Component />
      </main>
    );
  }

  // Priority 3: Placeholder
  return (
    <main className="content-area">
      <div className="workspace-placeholder">
        <h3 style={{ color: 'var(--theme-primary)', marginBottom: '16px' }}>
          {config?.name || workspace}
        </h3>
        <p style={{ color: 'var(--text-dim)' }}>
          Content area for {(config?.name || workspace).toLowerCase()} workspace.
        </p>
      </div>
    </main>
  );
}
