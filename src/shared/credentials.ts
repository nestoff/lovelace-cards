import type { PasswordRecord } from "./types.js";

export interface CredentialLookup {
  jobId: string;
  cameraListId: string;
  cameraId: string | null;
  url: string;
}

export interface CapturedCredential {
  url: string;
  username: string;
  password: string;
}

export interface CredentialFill {
  username: string;
  password: string;
}

function findLastMatchingRecord(
  records: PasswordRecord[],
  predicate: (record: PasswordRecord) => boolean
): PasswordRecord | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (predicate(record)) {
      return record;
    }
  }

  return null;
}

export function normalizeCredentialUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export function findCredentialRecord(
  records: PasswordRecord[],
  lookup: CredentialLookup
): PasswordRecord | null {
  const normalizedUrl = normalizeCredentialUrl(lookup.url);
  return (
    findLastMatchingRecord(
      records,
      (record) =>
        record.jobId === lookup.jobId &&
        record.cameraListId === lookup.cameraListId &&
        !!lookup.cameraId &&
        record.cameraId === lookup.cameraId
    ) ??
    findLastMatchingRecord(
      records,
      (record) =>
        record.jobId === lookup.jobId &&
        record.cameraListId === lookup.cameraListId &&
        normalizeCredentialUrl(record.url) === normalizedUrl
    ) ??
    null
  );
}
