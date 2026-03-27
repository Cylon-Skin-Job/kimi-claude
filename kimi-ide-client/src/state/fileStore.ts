import { create } from 'zustand';
import type { FileTreeNode, FileInfo } from '../types/file-explorer';

interface FileState {
  // View state
  viewMode: 'tree' | 'viewer';
  selectedFile: FileInfo | null;
  fileContent: string;
  fileSize: number;

  // Tree state
  rootNodes: FileTreeNode[];
  expandedFolders: Set<string>;
  
  // Folder children cache - stores children for each expanded folder path
  // This persists when navigating between tree and viewer
  folderChildren: Map<string, FileTreeNode[]>;

  // Pending file request (set before WS request, consumed on response)
  pendingFile: FileInfo | null;

  // Loading / error
  isLoading: boolean;
  error: string | null;

  // Actions
  setRootNodes: (nodes: FileTreeNode[]) => void;
  setPendingFile: (file: FileInfo | null) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  toggleFolder: (path: string) => void;
  setFolderChildren: (path: string, children: FileTreeNode[]) => void;
  getFolderChildren: (path: string) => FileTreeNode[] | undefined;
  openFile: (file: FileInfo, content: string, size?: number) => void;
  closeFile: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  viewMode: 'tree',
  selectedFile: null,
  fileContent: '',
  fileSize: 0,
  pendingFile: null,
  rootNodes: [],
  expandedFolders: new Set(),
  folderChildren: new Map(),
  isLoading: false,
  error: null,

  setRootNodes: (nodes) => set({ rootNodes: nodes }),
  setPendingFile: (file) => set({ pendingFile: file }),

  expandFolder: (path) => set((state) => {
    const next = new Set(state.expandedFolders);
    next.add(path);
    return { expandedFolders: next };
  }),

  collapseFolder: (path) => set((state) => {
    const next = new Set(state.expandedFolders);
    next.delete(path);
    return { expandedFolders: next };
  }),

  setFolderChildren: (path, children) => set((state) => {
    const next = new Map(state.folderChildren);
    next.set(path, children);
    return { folderChildren: next };
  }),

  getFolderChildren: (path) => {
    return get().folderChildren.get(path);
  },

  toggleFolder: (path) => {
    const { expandedFolders } = get();
    if (expandedFolders.has(path)) {
      get().collapseFolder(path);
    } else {
      get().expandFolder(path);
    }
  },

  openFile: (file, content, size = 0) => set({
    viewMode: 'viewer',
    selectedFile: file,
    fileContent: content,
    fileSize: size,
    error: null,
  }),

  closeFile: () => set({
    viewMode: 'tree',
    selectedFile: null,
    fileContent: '',
    fileSize: 0,
  }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  reset: () => set({
    viewMode: 'tree',
    selectedFile: null,
    fileContent: '',
    fileSize: 0,
    pendingFile: null,
    rootNodes: [],
    expandedFolders: new Set(),
    folderChildren: new Map(),
    isLoading: false,
    error: null,
  }),
}));
