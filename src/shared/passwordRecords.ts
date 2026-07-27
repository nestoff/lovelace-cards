import type { PasswordRecord } from "./types.js";
import { normalizeCredentialUrl } from "./credentials.js";

export interface PasswordLookup {
  jobId: string;
  cameraListId: string;
  cameraId?: string | null;
  url: string;
  username: string;
}

export interface CameraCredentialScope {
  jobId: string;
  cameraListId: string;
  cameraId: string | null;
  url: string;
}

export interface CameraListCredentialScope {
  jobId: string;
  cameraListId: string;
}

export function findPasswordRecord(
  records: PasswordRecord[],
  lookup: PasswordLookup
): PasswordRecord | null {
  return (
    records.find(
      (record) =>
        record.jobId === lookup.jobId &&
        record.cameraListId === lookup.cameraListId &&
        (!lookup.cameraId || record.cameraId === lookup.cameraId) &&
        record.url === lookup.url &&
        record.username === lookup.username
    ) ?? null
  );
}

export function forgetCameraCredential(
  records: PasswordRecord[],
  scope: CameraCredentialScope
): PasswordRecord[] {
  const origin = normalizeCredentialUrl(scope.url);
  return records.filter((record) => {
    if (record.jobId !== scope.jobId || record.cameraListId !== scope.cameraListId) {
      return true;
    }

    const linkedMatch = !!scope.cameraId && record.cameraId === scope.cameraId;
    const legacyOriginMatch =
      record.cameraId === null && normalizeCredentialUrl(record.url) === origin;
    return !linkedMatch && !legacyOriginMatch;
  });
}

export function forgetCameraListCredentials(
  records: PasswordRecord[],
  scope: CameraListCredentialScope
): PasswordRecord[] {
  return records.filter(
    (record) => record.jobId !== scope.jobId || record.cameraListId !== scope.cameraListId
  );
}
