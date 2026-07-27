import { useEffect, useMemo, useState } from "react";
import {
  cameraHostFromUrl,
  normalizeHostPingIntervalSeconds,
  type HostPingResult,
  type HostPingStatus
} from "../../shared/hostPing";

export const HOST_PING_INTERVAL_MS = 5_000;

function uniqueHosts(urls: readonly string[]): string[] {
  return Array.from(
    new Set(urls.map(cameraHostFromUrl).filter((host): host is string => host !== null))
  ).sort();
}

function offlineResult(host: string): HostPingResult {
  return {
    host,
    reachable: false,
    latencyMs: null,
    checkedAt: Date.now()
  };
}

export function useHostPingStatuses(
  urls: readonly string[],
  intervalMs = HOST_PING_INTERVAL_MS
): ReadonlyMap<string, HostPingStatus> {
  const hostKey = uniqueHosts(urls).join("\n");
  const hosts = useMemo(() => (hostKey ? hostKey.split("\n") : []), [hostKey]);
  const pingHost = window.ditbrowse?.pingHost;
  const pollingIntervalMs =
    normalizeHostPingIntervalSeconds(intervalMs / 1_000) * 1_000;
  const [statuses, setStatuses] = useState<Map<string, HostPingStatus>>(new Map());

  useEffect(() => {
    if (!pingHost || hosts.length === 0) {
      setStatuses(new Map());
      return;
    }

    let disposed = false;
    let running = false;

    setStatuses((current) => {
      const next = new Map<string, HostPingStatus>();
      for (const host of hosts) {
        next.set(host, current.get(host) ?? { state: "checking", host });
      }
      return next;
    });

    const checkHosts = async (): Promise<void> => {
      if (disposed || running) {
        return;
      }

      running = true;
      const results = await Promise.all(
        hosts.map(async (host) => {
          try {
            return await pingHost(host);
          } catch {
            return offlineResult(host);
          }
        })
      );
      running = false;

      if (disposed) {
        return;
      }

      setStatuses((current) => {
        const next = new Map<string, HostPingStatus>();
        for (const result of results) {
          if (result.reachable) {
            next.set(result.host, { state: "online", ...result });
            continue;
          }

          const previous = current.get(result.host);
          next.set(result.host, {
            state: "offline",
            ...result,
            offlineSince:
              previous?.state === "offline"
                ? previous.offlineSince
                : result.checkedAt
          });
        }
        return next;
      });
    };

    void checkHosts();
    const interval = window.setInterval(
      () => void checkHosts(),
      pollingIntervalMs
    );

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [hostKey, hosts, pingHost, pollingIntervalMs]);

  return statuses;
}
