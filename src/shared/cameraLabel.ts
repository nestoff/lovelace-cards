import type { CameraEntry } from "./types.js";

function normalizeCameraIndex(camera: Pick<CameraEntry, "name" | "suffix">): string {
  return camera.name.trim() || camera.suffix.trim();
}

export function formatCameraLabel(
  camera: Pick<CameraEntry, "name" | "suffix"> &
    Partial<Pick<CameraEntry, "cameraType" | "lens" | "displayNote">>
): string {
  return [
    normalizeCameraIndex(camera),
    (camera.cameraType ?? "").trim(),
    (camera.lens ?? "").trim(),
    (camera.displayNote ?? "").trim()
  ]
    .filter(Boolean)
    .join(" • ");
}
