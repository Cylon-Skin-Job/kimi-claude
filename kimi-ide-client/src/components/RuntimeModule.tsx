/**
 * @module RuntimeModule
 * @role React wrapper for runtime-loaded workspace ui/ modules
 *
 * Renders a container div, loads the workspace's ui/ folder contents
 * (template.html, styles.css, module.js), and manages the mount/unmount
 * lifecycle of the vanilla JS module.
 */

import { useEffect, useRef } from 'react';
import type { WorkspaceConfig } from '../lib/workspaces';
import { loadAndMount, unmountModule } from '../engine/runtime-module';
import { useWorkspaceStore } from '../state/workspaceStore';

interface RuntimeModuleProps {
  workspace: string;
  config: WorkspaceConfig;
}

export function RuntimeModule({ workspace, config }: RuntimeModuleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ws = useWorkspaceStore((s) => s.ws);
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (mountedRef.current) return;

    mountedRef.current = true;

    loadAndMount(config, el).catch((err) => {
      console.error(`[RuntimeModule] Failed to load ${workspace}:`, err);
      el.innerHTML = `
        <div style="padding: 24px; color: var(--text-dim, #888);">
          <p>Failed to load workspace plugin</p>
          <p style="font-size: 0.8rem; opacity: 0.6;">${err.message}</p>
        </div>
      `;
    });

    return () => {
      mountedRef.current = false;
      unmountModule(workspace);
    };
  }, [ws, workspace, config]);

  return (
    <div
      ref={containerRef}
      className="runtime-module-container"
      data-workspace={workspace}
      style={{ width: '100%', height: '100%', overflow: 'auto' }}
    />
  );
}
