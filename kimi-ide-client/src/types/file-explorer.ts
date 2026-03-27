// File Explorer Types
// See docs/FILE_EXPLORER_WEBSOCKET_SPEC.md for protocol details

export interface FileTreeNode {
  name: string;           // filename on disk: "architecture.md"
  path: string;           // full relative path: "docs/architecture.md"
  type: 'file' | 'folder';
  extension?: string;     // normalized lowercase: "md" (files only)
  hasChildren?: boolean;  // folders only: true if non-empty
  isSymlink?: boolean;    // true if entry is a symlink
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
}

export type FileErrorCode =
  | 'ENOENT'
  | 'EACCES'
  | 'ENOTDIR'
  | 'EISDIR'
  | 'ENOTWORKSPACE'
  | 'ETOOLARGE'
  | 'UNKNOWN';

// Client -> Server
export interface FileTreeRequest {
  type: 'file_tree_request';
  workspace: string;
  path?: string;
}

export interface FileContentRequest {
  type: 'file_content_request';
  workspace: string;
  path: string;
}

// Server -> Client (success)
export interface FileTreeResponse {
  type: 'file_tree_response';
  workspace: string;
  path: string;
  success: true;
  nodes: FileTreeNode[];
}

export interface FileContentResponse {
  type: 'file_content_response';
  workspace: string;
  path: string;
  success: true;
  content: string;
  size: number;
  lastModified: number;
}

// Server -> Client (error)
export interface FileOperationError {
  type: 'file_tree_response' | 'file_content_response';
  workspace: string;
  path: string;
  success: false;
  error: string;
  code: FileErrorCode;
}

// Server -> Client (file watching stub)
export interface FileChangedNotification {
  type: 'file_changed';
  workspace: string;
  path: string;
  change: 'created' | 'modified' | 'deleted';
  timestamp: number;
}

// Server -> Client (workspace configuration on connect)
export interface WorkspaceConfigMessage {
  type: 'workspace_config';
  workspace: string;
  projectRoot: string;
  projectName: string;
}
