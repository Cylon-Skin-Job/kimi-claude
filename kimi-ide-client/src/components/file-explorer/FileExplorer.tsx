import { useFileStore } from '../../state/fileStore';
import { useFileTreeListener } from '../../hooks/useFileTree';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';

export function FileExplorer() {
  const viewMode = useFileStore((s) => s.viewMode);
  const rootNodes = useFileStore((s) => s.rootNodes);
  const isLoading = useFileStore((s) => s.isLoading);
  const error = useFileStore((s) => s.error);

  // Single WebSocket listener for file operations
  useFileTreeListener();

  if (viewMode === 'viewer') {
    return <FileViewer />;
  }

  return (
    <div className="file-explorer">
      {error && (
        <div className="file-explorer-error">
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span>
          <span>{error}</span>
        </div>
      )}
      {isLoading && rootNodes.length === 0 ? (
        <div className="file-explorer-loading">
          <span style={{ color: 'var(--text-dim)' }}>Loading files...</span>
        </div>
      ) : (
        <FileTree nodes={rootNodes} />
      )}
    </div>
  );
}
