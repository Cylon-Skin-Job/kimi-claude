/**
 * @module runtime-module
 * @role Loads workspace ui/module.js at runtime via WebSocket fetch
 *
 * Fetches module.js as text, creates a Blob URL, and dynamically imports it.
 * Manages the mount/unmount lifecycle for workspace plugin modules.
 *
 * When Electron is available, this can be swapped to use fs.readFileSync
 * for faster loading. The module contract stays the same.
 */

import { fetchWorkspaceFile } from '../lib/workspaces';
import { createContext, destroyContext, type WorkspaceContext } from './workspace-context';
import type { WorkspaceConfig } from '../lib/workspaces';
import { useWorkspaceStore } from '../state/workspaceStore';

/** The interface a workspace ui/module.js must export */
export interface WorkspaceModule {
  mount(el: HTMLElement, ctx: WorkspaceContext): void;
  unmount(el: HTMLElement, ctx: WorkspaceContext): void;
  onData?(el: HTMLElement, ctx: WorkspaceContext, msg: any): void;
}

/** Tracks a loaded runtime module instance */
interface LoadedModule {
  module: WorkspaceModule;
  ctx: WorkspaceContext;
  el: HTMLElement;
  blobUrl: string | null;
}

const loadedModules = new Map<string, LoadedModule>();

/**
 * Load and mount a workspace's ui/ folder contents.
 *
 * 1. Fetches ui/template.html, ui/styles.css, ui/module.js via WebSocket
 * 2. Injects template HTML into the container element
 * 3. Injects scoped CSS via ctx.injectStyles()
 * 4. Loads module.js via Blob URL + dynamic import
 * 5. Calls module.mount(el, ctx)
 */
export async function loadAndMount(
  config: WorkspaceConfig,
  containerEl: HTMLElement
): Promise<void> {
  const ws = useWorkspaceStore.getState().ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }

  // Unmount existing module for this workspace if any
  await unmountModule(config.id);

  // Create context
  const ctx = createContext(config);

  // Set data-workspace attribute for CSS scoping
  containerEl.setAttribute('data-workspace', config.id);

  // Load all three files in parallel (template and styles are optional)
  const [templateResult, stylesResult, moduleResult] = await Promise.allSettled([
    fetchWorkspaceFile(ws, config.id, 'ui/template.html'),
    fetchWorkspaceFile(ws, config.id, 'ui/styles.css'),
    fetchWorkspaceFile(ws, config.id, 'ui/module.js'),
  ]);

  // Inject template HTML (optional — module can build DOM itself)
  if (templateResult.status === 'fulfilled') {
    containerEl.innerHTML = templateResult.value;
  }

  // Inject scoped styles (optional)
  if (stylesResult.status === 'fulfilled') {
    ctx.injectStyles(stylesResult.value, `ws-plugin-${config.id}`);
  }

  // Module is required
  if (moduleResult.status === 'rejected') {
    containerEl.innerHTML = `
      <div style="padding: 24px; color: var(--text-dim, #888);">
        <p>Failed to load module for workspace "${config.name}"</p>
        <p style="font-size: 0.8rem; opacity: 0.6;">${moduleResult.reason?.message || 'Unknown error'}</p>
      </div>
    `;
    return;
  }

  // Load module.js via Blob URL + dynamic import
  const moduleCode = moduleResult.value;
  const blob = new Blob([moduleCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  let mod: WorkspaceModule;
  try {
    const imported = await import(/* @vite-ignore */ blobUrl);
    mod = imported as WorkspaceModule;
  } catch (err) {
    URL.revokeObjectURL(blobUrl);
    containerEl.innerHTML = `
      <div style="padding: 24px; color: var(--text-dim, #888);">
        <p>Error loading module for "${config.name}"</p>
        <p style="font-size: 0.8rem; opacity: 0.6;">${err instanceof Error ? err.message : 'Unknown error'}</p>
      </div>
    `;
    return;
  }

  // Verify module exports
  if (typeof mod.mount !== 'function') {
    URL.revokeObjectURL(blobUrl);
    containerEl.innerHTML = `
      <div style="padding: 24px; color: var(--text-dim, #888);">
        <p>Module for "${config.name}" is missing mount() export</p>
      </div>
    `;
    return;
  }

  // Track the loaded module
  loadedModules.set(config.id, {
    module: mod,
    ctx,
    el: containerEl,
    blobUrl,
  });

  // Mount
  try {
    mod.mount(containerEl, ctx);
  } catch (err) {
    console.error(`[RuntimeModule] mount() error for ${config.id}:`, err);
  }

  // If module has onData, wire it up as a listener
  if (typeof mod.onData === 'function') {
    ctx.on('file_content_response', (msg: any) => {
      if (msg.workspace === config.id) {
        try {
          mod.onData!(containerEl, ctx, msg);
        } catch (err) {
          console.error(`[RuntimeModule] onData() error for ${config.id}:`, err);
        }
      }
    });
  }
}

/**
 * Unmount and clean up a workspace's runtime module.
 */
export async function unmountModule(workspaceId: string): Promise<void> {
  const loaded = loadedModules.get(workspaceId);
  if (!loaded) return;

  // Call unmount
  if (typeof loaded.module.unmount === 'function') {
    try {
      loaded.module.unmount(loaded.el, loaded.ctx);
    } catch (err) {
      console.error(`[RuntimeModule] unmount() error for ${workspaceId}:`, err);
    }
  }

  // Revoke Blob URL
  if (loaded.blobUrl) {
    URL.revokeObjectURL(loaded.blobUrl);
  }

  // Destroy context (removes WS listeners, injected styles, state)
  destroyContext(workspaceId);

  // Clear container
  loaded.el.innerHTML = '';

  loadedModules.delete(workspaceId);
}

/**
 * Reload a workspace module (for hot reload support).
 * Unmounts current module, re-fetches files, mounts fresh.
 */
export async function reloadModule(
  config: WorkspaceConfig,
  containerEl: HTMLElement
): Promise<void> {
  await unmountModule(config.id);
  await loadAndMount(config, containerEl);
}

/**
 * Check if a workspace has an active runtime module.
 */
export function isModuleLoaded(workspaceId: string): boolean {
  return loadedModules.has(workspaceId);
}
