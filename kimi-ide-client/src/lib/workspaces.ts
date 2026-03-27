/**
 * @module workspaces
 * @role Shared workspace discovery and config loading
 * @reads ai/workspaces/workspaces.json, ai/workspaces/{id}/workspace.json
 *
 * Loads workspace definitions from the repo filesystem via WebSocket.
 * Knows nothing about any specific workspace type.
 */

// --- Types ---

export interface WorkspaceTheme {
  primary: string;
  sidebar_bg: string;
  content_bg: string;
  panel_border: string;
}

export type WorkspaceLayout = 'full' | 'chat-content' | 'sidebar-chat-content';

export interface WorkspaceConfig {
  id: string;
  name: string;
  description?: string;
  type: string;
  icon: string;
  hasChat: boolean;
  layout: WorkspaceLayout;
  theme: WorkspaceTheme;
  rank?: number;
  /** True if workspace has a ui/ folder with module.js (runtime-loaded plugin) */
  hasUiFolder?: boolean;
}

// --- Helpers ---

/**
 * Request a file from a workspace via WebSocket.
 * Returns a promise that resolves with the file content or rejects on error.
 */
export function fetchWorkspaceFile(ws: WebSocket, workspace: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_content_response' && msg.workspace === workspace && msg.path === filePath) {
          ws.removeEventListener('message', handleMessage);
          if (msg.success) {
            resolve(msg.content);
          } else {
            reject(new Error(msg.error || `Failed to load ${workspace}/${filePath}`));
          }
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({
      type: 'file_content_request',
      workspace,
      path: filePath,
    }));

    setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      reject(new Error(`Timeout loading ${workspace}/${filePath}`));
    }, 5000);
  });
}

/**
 * Load a single workspace's config from its workspace.json.
 */
export async function loadWorkspaceConfig(ws: WebSocket, workspaceId: string): Promise<WorkspaceConfig | null> {
  try {
    // Use __workspaces__ pseudo-workspace so the server always resolves to
    // ai/workspaces/{id}/workspace.json — even for coding-agent, which has
    // a special getWorkspacePath that maps to the project root.
    const raw = await fetchWorkspaceFile(ws, '__workspaces__', `${workspaceId}/workspace.json`);
    const json = JSON.parse(raw);
    const hasChat = json.hasChat ?? true;

    // Check if workspace has a ui/ folder with module.js
    const hasUiFolder = await fetchWorkspaceFile(ws, '__workspaces__', `${workspaceId}/ui/module.js`)
      .then(() => true)
      .catch(() => false);

    return {
      id: json.id || workspaceId,
      name: json.name || workspaceId,
      description: json.description,
      type: json.type || 'placeholder',
      icon: json.icon || 'folder',
      hasChat,
      layout: json.layout || (hasChat ? 'sidebar-chat-content' : 'full') as WorkspaceLayout,
      theme: {
        primary: json.theme?.primary || '#888888',
        sidebar_bg: json.theme?.sidebar_bg || '#111111',
        content_bg: json.theme?.content_bg || '#0d0d0d',
        panel_border: json.theme?.panel_border || '#88888833',
      },
      rank: json.rank,
      hasUiFolder,
    };
  } catch {
    return null;
  }
}

/**
 * Discover all workspaces by requesting the folder listing of ai/workspaces/.
 * Returns workspace IDs (folder names).
 */
export function discoverWorkspaces(ws: WebSocket): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_tree_response' && msg.workspace === '__workspaces__') {
          ws.removeEventListener('message', handleMessage);
          if (msg.success) {
            const folders = (msg.nodes || [])
              .filter((n: { type: string }) => n.type === 'directory' || n.type === 'folder')
              .map((n: { name: string }) => n.name);
            resolve(folders);
          } else {
            reject(new Error(msg.error || 'Failed to discover workspaces'));
          }
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({
      type: 'file_tree_request',
      workspace: '__workspaces__',
      path: '',
    }));

    setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      reject(new Error('Timeout discovering workspaces'));
    }, 5000);
  });
}

/**
 * Load all workspace configs. Discovers workspace folders, loads each config,
 * returns sorted by rank (from workspaces.json embedded rank or workspace.json order).
 */
export async function loadAllWorkspaces(ws: WebSocket): Promise<WorkspaceConfig[]> {
  const ids = await discoverWorkspaces(ws);
  const configs = await Promise.all(
    ids.map((id) => loadWorkspaceConfig(ws, id))
  );
  // Filter nulls and sort by rank (workspaces without rank go last)
  return configs
    .filter((c): c is WorkspaceConfig => c !== null)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}

/**
 * Apply a workspace theme as CSS custom properties on a target element.
 */
export function applyWorkspaceTheme(el: HTMLElement, theme: WorkspaceTheme) {
  el.style.setProperty('--ws-primary', theme.primary);
  el.style.setProperty('--ws-sidebar-bg', theme.sidebar_bg);
  el.style.setProperty('--ws-content-bg', theme.content_bg);
  el.style.setProperty('--ws-panel-border', theme.panel_border);
}
