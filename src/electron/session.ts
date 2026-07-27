import { session } from "electron";
import type { ClearDataOptions } from "electron";

const RESET_DATA_TYPES: NonNullable<ClearDataOptions["dataTypes"]> = [
  "backgroundFetch",
  "cache",
  "cookies",
  "fileSystems",
  "indexedDB",
  "localStorage",
  "serviceWorkers",
  "webSQL"
];

export async function resetCameraSessionData(
  partition: string,
  origin: string
): Promise<void> {
  const target = session.fromPartition(partition);
  await target.clearData({
    origins: [origin],
    dataTypes: RESET_DATA_TYPES,
    avoidClosingConnections: false
  });
  await target.clearAuthCache();
}

export async function resetListSessionData(partition: string): Promise<void> {
  const target = session.fromPartition(partition);
  await target.clearData({
    dataTypes: RESET_DATA_TYPES,
    avoidClosingConnections: false
  });
  await target.clearAuthCache();
  await target.closeAllConnections();
}
