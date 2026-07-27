import { useEffect, useRef } from "react";
import type { WorkspaceState } from "../../shared/types";

interface UseDebouncedWorkspaceSaveOptions {
  loaded: boolean;
  workspace: WorkspaceState;
  saveWorkspace: (workspace: WorkspaceState) => Promise<void> | void;
  delayMs?: number;
}

export function useDebouncedWorkspaceSave({
  loaded,
  workspace,
  saveWorkspace,
  delayMs = 250
}: UseDebouncedWorkspaceSaveOptions): void {
  const latestWorkspaceRef = useRef(workspace);
  const loadedRef = useRef(loaded);
  const saveWorkspaceRef = useRef(saveWorkspace);
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef(false);

  latestWorkspaceRef.current = workspace;
  loadedRef.current = loaded;
  saveWorkspaceRef.current = saveWorkspace;

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      if (saveTimerRef.current === saveTimer) {
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = false;
      void saveWorkspaceRef.current(latestWorkspaceRef.current);
    }, delayMs);
    saveTimerRef.current = saveTimer;
    pendingSaveRef.current = true;

    return () => {
      if (saveTimerRef.current === saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimerRef.current = null;
      }
    };
  }, [delayMs, loaded, saveWorkspace, workspace]);

  useEffect(() => {
    const flushPendingSave = (): void => {
      if (!loadedRef.current || !pendingSaveRef.current) {
        return;
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = false;
      void saveWorkspaceRef.current(latestWorkspaceRef.current);
    };

    window.addEventListener("pagehide", flushPendingSave);
    window.addEventListener("beforeunload", flushPendingSave);

    return () => {
      window.removeEventListener("pagehide", flushPendingSave);
      window.removeEventListener("beforeunload", flushPendingSave);
      flushPendingSave();
    };
  }, []);
}
