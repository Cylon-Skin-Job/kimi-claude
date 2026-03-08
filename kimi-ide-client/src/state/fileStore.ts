import { create } from 'zustand';
import type { FileTreeNode, FileInfo } from '../types/file-explorer';

interface FileState {
  // View state
  viewMode: 'tree' | 'viewer';
  selectedFile: FileInfo | null;
  fileContent: string;

  // Tree state
  rootNodes: FileTreeNode[];
  folderChildren: Record<string, FileTreeNode[]>; // path -> children
  expandedFolders: Set<string>;

  // Pending file request (set before WS request, consumed on response)
  pendingFile: FileInfo | null;

  // Loading / error
  isLoading: boolean;
  error: string | null;

  // Actions
  setRootNodes: (nodes: FileTreeNode[]) => void;
  setPendingFile: (file: FileInfo | null) => void;
  setFolderChildren: (path: string, children: FileTreeNode[]) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  toggleFolder: (path: string) => void;
  openFile: (file: FileInfo, content: string) => void;
  closeFile: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  viewMode: 'tree',
  selectedFile: null,
  fileContent: '',
  pendingFile: null,
  rootNodes: [],
  folderChildren: {},
  expandedFolders: new Set(),
  isLoading: false,
  error: null,

  setRootNodes: (nodes) => set({ rootNodes: nodes }),
  setPendingFile: (file) => set({ pendingFile: file }),

  setFolderChildren: (path, children) => set((state) => ({
    folderChildren: { ...state.folderChildren, [path]: children },
  })),

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

  toggleFolder: (path) => {
    const { expandedFolders } = get();
    if (expandedFolders.has(path)) {
      get().collapseFolder(path);
    } else {
      get().expandFolder(path);
    }
  },

  openFile: (file, content) => set({
    viewMode: 'viewer',
    selectedFile: file,
    fileContent: content,
    error: null,
  }),

  closeFile: () => set({
    viewMode: 'tree',
    selectedFile: null,
    fileContent: '',
  }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  reset: () => set({
    viewMode: 'tree',
    selectedFile: null,
    fileContent: '',
    pendingFile: null,
    rootNodes: [],
    folderChildren: {},
    expandedFolders: new Set(),
    isLoading: false,
    error: null,
  }),
}));
