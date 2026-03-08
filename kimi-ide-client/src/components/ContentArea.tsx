import type { WorkspaceId } from '../types';
import { WORKSPACE_CONFIGS } from '../types';
import { FileExplorer } from './file-explorer/FileExplorer';

interface ContentAreaProps {
  workspace: WorkspaceId;
}

export function ContentArea({ workspace }: ContentAreaProps) {
  const config = WORKSPACE_CONFIGS[workspace];

  // Code workspace shows the file explorer
  if (workspace === 'code') {
    return (
      <main className="content-area">
        <FileExplorer />
      </main>
    );
  }

  return (
    <main className="content-area">
      <div className="workspace-placeholder">
        <h3 style={{ color: 'var(--theme-primary)', marginBottom: '16px' }}>
          {config.name}
        </h3>
        <p style={{ color: 'var(--text-dim)' }}>
          Content area for {config.name.toLowerCase()} workspace.
        </p>
      </div>
    </main>
  );
}
