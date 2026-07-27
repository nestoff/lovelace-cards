import fs from "node:fs/promises";
import path from "node:path";
import { sampleWorkspace } from "../shared/sampleData.js";
import type { WorkspaceState } from "../shared/types.js";

export interface AppStorage {
  loadWorkspace(): Promise<WorkspaceState>;
  saveWorkspace(workspace: WorkspaceState): Promise<void>;
}

export function createJsonStorage(userDataPath: string): AppStorage {
  const statePath = path.join(userDataPath, "ditbrowse-workspace.json");

  return {
    async loadWorkspace() {
      try {
        const raw = await fs.readFile(statePath, "utf8");
        return JSON.parse(raw) as WorkspaceState;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return sampleWorkspace;
        }
        throw error;
      }
    },
    async saveWorkspace(workspace) {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, JSON.stringify(workspace, null, 2), "utf8");
    }
  };
}
