import { useEffect, useRef } from 'react';
import { RenderEngine } from '../lib/renderEngine';
import { registerEngine, unregisterEngine } from '../lib/engineRegistry';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { WorkspaceId } from '../types';

/**
 * Bridge between RenderEngine and React/Zustand.
 * 
 * Engine is created immediately but doesn't start until
 * turn_begin arrives from backend.
 */
export function useEngineBridge(workspace: WorkspaceId): RenderEngine {
  const engineRef = useRef<RenderEngine>(new RenderEngine());
  const setEngineState = useWorkspaceStore((s) => s.setEngineState);

  useEffect(() => {
    const engine = engineRef.current;

    registerEngine(workspace, engine);

    const unsub = engine.subscribe((state) => {
      setEngineState(workspace, state);
    });

    return () => {
      unsub();
      engine.stop();
      engine.reset();
      unregisterEngine(workspace);
    };
  }, [workspace, setEngineState]);

  return engineRef.current;
}
