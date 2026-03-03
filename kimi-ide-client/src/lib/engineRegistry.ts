import type { RenderEngine } from './renderEngine';
import type { WorkspaceId } from '../types';

const engines = new Map<WorkspaceId, RenderEngine>();

export function registerEngine(workspace: WorkspaceId, engine: RenderEngine): void {
  engines.set(workspace, engine);
}

export function unregisterEngine(workspace: WorkspaceId): void {
  engines.delete(workspace);
}

export function getEngine(workspace: WorkspaceId): RenderEngine | undefined {
  return engines.get(workspace);
}
