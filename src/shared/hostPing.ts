import { normalizeCameraUrl } from "./url.js";

export const DEFAULT_HOST_PING_INTERVAL_SECONDS = 5;
export const MIN_HOST_PING_INTERVAL_SECONDS = 1;
export const MAX_HOST_PING_INTERVAL_SECONDS = 300;

export function normalizeHostPingIntervalSeconds(value: unknown): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_HOST_PING_INTERVAL_SECONDS;
  return Math.min(
    MAX_HOST_PING_INTERVAL_SECONDS,
    Math.max(MIN_HOST_PING_INTERVAL_SECONDS, Math.round(numeric))
  );
}

export interface HostPingResult {
  host: string;
  reachable: boolean;
  latencyMs: number | null;
  checkedAt: number;
}

export type HostPingStatus =
  | { state: "checking"; host: string }
  | ({ state: "online" } & HostPingResult)
  | ({ state: "offline"; offlineSince: number } & HostPingResult);

export function cameraHostFromUrl(input: string): string | null {
  try {
    const parsed = new URL(normalizeCameraUrl(input));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.hostname.replace(/^\[|\]$/g, "") || null;
  } catch {
    return null;
  }
}
