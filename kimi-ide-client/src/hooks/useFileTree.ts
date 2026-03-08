import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useFileStore } from '../state/fileStore';
import type { FileInfo } from '../types/file-explorer';

/**
 * Hook: call once in FileExplorer to set up WebSocket listener
 * and trigger initial root tree load.
 */
export function useFileTreeListener() {
  const ws = useWorkspaceStore((state) => state.ws);
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const initializedRef = useRef(false);

  // Listen for file-related WebSocket responses
  useEffect(() => {
    if (!ws) return;

    function handleMessage(event: MessageEvent) {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'file_tree_response') {
          useFileStore.getState().setLoading(false);
          if (msg.success) {
            if (!msg.path || msg.path === '') {
              useFileStore.getState().setRootNodes(msg.nodes);
            } else {
              useFileStore.getState().setFolderChildren(msg.path, msg.nodes);
              useFileStore.getState().expandFolder(msg.path);
            }
          } else {
            useFileStore.getState().setError(msg.error || 'Failed to load file tree');
          }
        }

        if (msg.type === 'file_content_response') {
          useFileStore.getState().setLoading(false);
          if (msg.success) {
            const pending = useFileStore.getState().pendingFile;
            if (pending) {
              useFileStore.getState().openFile(pending, msg.content);
              useFileStore.getState().setPendingFile(null);
            }
          } else {
            useFileStore.getState().setError(msg.error || 'Failed to load file');
          }
        }
      } catch (_) {
        // Not our message or parse error
      }
    }

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  // Load root tree on first mount when workspace is 'code'
  useEffect(() => {
    if (ws && currentWorkspace === 'code' && !initializedRef.current) {
      initializedRef.current = true;
      loadRootTree();
    }
  }, [ws, currentWorkspace]);
}

// --- Standalone send functions (no hooks, safe to call anywhere) ---

export function loadRootTree() {
  const ws = useWorkspaceStore.getState().ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  useFileStore.getState().setLoading(true);
  useFileStore.getState().setError(null);
  ws.send(JSON.stringify({
    type: 'file_tree_request',
    workspace: 'code',
  }));
}

export function loadFolder(path: string) {
  const ws = useWorkspaceStore.getState().ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  useFileStore.getState().setLoading(true);
  useFileStore.getState().setError(null);
  ws.send(JSON.stringify({
    type: 'file_tree_request',
    workspace: 'code',
    path,
  }));
}

export function loadFileContent(file: FileInfo) {
  const ws = useWorkspaceStore.getState().ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  useFileStore.getState().setLoading(true);
  useFileStore.getState().setError(null);
  useFileStore.getState().setPendingFile(file);
  ws.send(JSON.stringify({
    type: 'file_content_request',
    workspace: 'code',
    path: file.path,
  }));
}
