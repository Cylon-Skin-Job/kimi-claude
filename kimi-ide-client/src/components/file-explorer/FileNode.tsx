import type { FileTreeNode } from '../../types/file-explorer';
import { getFileIcon, formatFileName } from '../../lib/file-utils';
import { useFileStore } from '../../state/fileStore';
import { loadFileContent } from '../../hooks/useFileTree';

interface FileNodeProps {
  node: FileTreeNode;
  depth: number;
}

export function FileNode({ node, depth }: FileNodeProps) {
  const isLoading = useFileStore((s) => s.isLoading);

  const icon = getFileIcon(node.extension);
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  function handleClick() {
    if (isLoading) return;
    loadFileContent({
      name: node.name,
      path: node.path,
      type: 'file',
      extension: node.extension,
    });
  }

  return (
    <div
      className={`file-tree-item${isLoading ? ' disabled' : ''}`}
      style={{ paddingLeft }}
      onClick={handleClick}
    >
      <span className="material-symbols-outlined tree-icon">
        {icon}
      </span>
      <span className="tree-label">{formatFileName(node.name)}</span>
    </div>
  );
}
