import type { WorkspaceId } from '../types';
import { WORKSPACE_CONFIGS } from '../types';

interface ContentAreaProps {
  workspace: WorkspaceId;
}

export function ContentArea({ workspace }: ContentAreaProps) {
  const config = WORKSPACE_CONFIGS[workspace];
  
  return (
    <main className="content-area">
      <div className="workspace-placeholder">
        <h3 style={{ color: 'var(--theme-primary)', marginBottom: '16px' }}>
          {config.name}
        </h3>
        <p style={{ color: 'var(--text-dim)' }}>
          Content area for {config.name.toLowerCase()} workspace.<br /><br />
          This area will display:
        </p>
        <ul style={{ color: 'var(--text-dim)', marginTop: '12px', paddingLeft: '20px' }}>
          <li>File diffs</li>
          <li>Code previews</li>
          <li>Pipeline visualizations</li>
          <li>Documentation</li>
        </ul>
      </div>
    </main>
  );
}
