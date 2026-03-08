import type { FileTreeNode } from '../../types/file-explorer';
import { formatFolderName } from '../../lib/file-utils';
import { useFileStore } from '../../state/fileStore';
import { loadFolder } from '../../hooks/useFileTree';
import { FileTree } from './FileTree';

interface FolderNodeProps {
  node: FileTreeNode;
  depth: number;
}

export function FolderNode({ node, depth }: FolderNodeProps) {
  const expandedFolders = useFileStore((s) => s.expandedFolders);
  const folderChildren = useFileStore((s) => s.folderChildren);
  const isLoading = useFileStore((s) => s.isLoading);

  const isExpanded = expandedFolders.has(node.path);
  const children = folderChildren[node.path];
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  // Icon logic per spec
  let icon: string;
  let iconClass: string;
  if (isExpanded) {
    icon = 'folder_open';
    iconClass = 'tree-icon';
  } else if (node.hasChildren) {
    icon = 'folder';
    iconClass = 'tree-icon folder-filled';
  } else {
    icon = 'folder';
    iconClass = 'tree-icon folder-outline';
  }

  function handleClick() {
    if (isLoading) return;
    if (isExpanded) {
      useFileStore.getState().collapseFolder(node.path);
    } else {
      if (!children) {
        loadFolder(node.path);
      } else {
        useFileStore.getState().expandFolder(node.path);
      }
    }
  }

  return (
    <div className="folder-node">
      <div
        className={`file-tree-item${isLoading ? ' disabled' : ''}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        <span className={`material-symbols-outlined ${iconClass}`}>
          {icon}
        </span>
        <span className="tree-label">{formatFolderName(node.name)}</span>
      </div>
      {isExpanded && children && (
        <div className="folder-children">
          <FileTree nodes={children} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}
