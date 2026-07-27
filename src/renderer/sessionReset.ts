import type { TileState } from "../shared/types";
import {
  cameraBaseAddressFromUrl,
  type CameraBaseAddress
} from "../shared/url";

export interface SessionResetResult {
  tone: "success" | "partial";
  message: string;
  reloaded: number;
  skipped: number;
  failed: string[];
}

export interface SessionResetDependencies {
  clearRuntime(tileId: string): Promise<boolean>;
  resetCameraData(partition: string, origin: string): Promise<void>;
  resetListData(partition: string): Promise<void>;
  loadBase(tileId: string, baseUrl: string): Promise<boolean>;
  markManualAuth(tileIds: string[]): void;
  clearManualAuth(tileIds: string[]): void;
  isCurrent(operationKey: string): boolean;
  wait(delayMs: number): Promise<void>;
}

interface SelectedResetInput {
  tile: TileState;
  operationKey: string;
  onSessionCleared(): void;
}

interface ListResetInput {
  tiles: TileState[];
  partition: string;
  operationKey: string;
  onSessionCleared(): void;
}

interface ResetTarget {
  tile: TileState;
  address: CameraBaseAddress;
}

export async function resetSelectedCamera(
  input: SelectedResetInput,
  dependencies: SessionResetDependencies
): Promise<SessionResetResult> {
  const target = cameraBaseAddressFromUrl(input.tile.url);
  if (!target) {
    return {
      tone: "partial",
      message: "This tile does not have a camera web address to clear.",
      reloaded: 0,
      skipped: 1,
      failed: [input.tile.title]
    };
  }

  dependencies.markManualAuth([input.tile.id]);
  try {
    if (!(await dependencies.clearRuntime(input.tile.id))) {
      throw new Error(`Could not clear in-page data for ${input.tile.title}`);
    }

    await dependencies.resetCameraData(input.tile.partition, target.origin);
    input.onSessionCleared();
    if (!dependencies.isCurrent(input.operationKey)) {
      dependencies.clearManualAuth([input.tile.id]);
      return {
        tone: "partial",
        message: "Camera data was cleared, but the workspace changed before reload.",
        reloaded: 0,
        skipped: 1,
        failed: [input.tile.title]
      };
    }

    if (!(await dependencies.loadBase(input.tile.id, target.baseUrl))) {
      dependencies.clearManualAuth([input.tile.id]);
      return {
        tone: "partial",
        message: `Camera data was cleared, but ${input.tile.title} did not reload.`,
        reloaded: 0,
        skipped: 0,
        failed: [input.tile.title]
      };
    }

    return {
      tone: "success",
      message: `Cleared camera data and reloaded ${target.baseUrl}`,
      reloaded: 1,
      skipped: 0,
      failed: []
    };
  } catch (error) {
    dependencies.clearManualAuth([input.tile.id]);
    throw error;
  }
}

export async function resetCameraList(
  input: ListResetInput,
  dependencies: SessionResetDependencies
): Promise<SessionResetResult> {
  const mapped = input.tiles.map((tile) => ({
    tile,
    address: cameraBaseAddressFromUrl(tile.url)
  }));
  const targets = mapped.filter(
    (item): item is ResetTarget => item.address !== null
  );
  const invalid = mapped.filter((item) => item.address === null);
  const markedIds = targets.map((target) => target.tile.id);
  dependencies.markManualAuth(markedIds);

  try {
    const runtimeTargets = await Promise.all(
      targets.map(async (target) => ({
        ...target,
        runtimeCleared: await dependencies.clearRuntime(target.tile.id)
      }))
    );
    await dependencies.resetListData(input.partition);
    input.onSessionCleared();

    let reloaded = 0;
    let skipped = invalid.length;
    const failed = invalid.map((item) => item.tile.title);
    const readyTargets = runtimeTargets.filter((target) => {
      if (target.runtimeCleared) {
        return true;
      }

      skipped += 1;
      failed.push(target.tile.title);
      dependencies.clearManualAuth([target.tile.id]);
      return false;
    });

    if (!dependencies.isCurrent(input.operationKey)) {
      skipped += readyTargets.length;
      failed.push(...readyTargets.map((target) => target.tile.title));
      dependencies.clearManualAuth(readyTargets.map((target) => target.tile.id));
    } else {
      const reloadResults = await Promise.all(
        readyTargets.map(async (target, index) => {
          await dependencies.wait(index * 150);
          if (!dependencies.isCurrent(input.operationKey)) {
            return { target, outcome: "stale" as const };
          }

          const loaded = await dependencies.loadBase(
            target.tile.id,
            target.address.baseUrl
          );
          return { target, outcome: loaded ? ("loaded" as const) : ("failed" as const) };
        })
      );

      const staleIds: string[] = [];
      const failedLoadIds: string[] = [];
      for (const result of reloadResults) {
        if (result.outcome === "loaded") {
          reloaded += 1;
          continue;
        }

        failed.push(result.target.tile.title);
        if (result.outcome === "stale") {
          skipped += 1;
          staleIds.push(result.target.tile.id);
        } else {
          failedLoadIds.push(result.target.tile.id);
        }
      }
      if (staleIds.length > 0) {
        dependencies.clearManualAuth(staleIds);
      }
      if (failedLoadIds.length > 0) {
        dependencies.clearManualAuth(failedLoadIds);
      }
    }

    const tone = skipped === 0 && failed.length === 0 ? "success" : "partial";
    return {
      tone,
      message:
        tone === "success"
          ? `Cleared list data and reloaded ${reloaded} cameras.`
          : `Cleared list data; reloaded ${reloaded}, skipped ${skipped}, failed ${failed.length}.`,
      reloaded,
      skipped,
      failed
    };
  } catch (error) {
    dependencies.clearManualAuth(markedIds);
    throw error;
  }
}
