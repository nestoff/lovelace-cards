import { execFile } from "node:child_process";
import { isIP } from "node:net";
import type { HostPingResult } from "../shared/hostPing.js";

const PING_FILE = "/sbin/ping";
const PING_TIMEOUT_MS = 1_500;
const PING_MAX_BUFFER_BYTES = 16_384;
const DNS_HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export interface PingCommand {
  file: string;
  args: string[];
}

export type PingCommandRunner = (file: string, args: readonly string[]) => Promise<string>;

export function normalizePingHost(input: string): string | null {
  const host = input.trim().replace(/\.$/, "").toLowerCase();
  if (!host || isIP(host) === 6) {
    return null;
  }

  if (isIP(host) === 4) {
    return host;
  }

  if (/^[\d.]+$/.test(host) || !DNS_HOST_PATTERN.test(host)) {
    return null;
  }

  return host;
}

export function buildPingCommand(input: string): PingCommand | null {
  const host = normalizePingHost(input);
  if (!host) {
    return null;
  }

  return {
    file: PING_FILE,
    args: ["-n", "-c", "1", "-W", "1000", "-s", "16", host]
  };
}

export function parsePingLatency(output: string): number | null {
  const match = output.match(/\btime\s*([=<])\s*(\d+(?:\.\d+)?)\s*ms\b/i);
  if (!match) {
    return null;
  }

  const value = Number(match[2]);
  if (!Number.isFinite(value)) {
    return null;
  }

  return match[1] === "<" ? value / 2 : value;
}

function runPingCommand(file: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      [...args],
      { timeout: PING_TIMEOUT_MS, maxBuffer: PING_MAX_BUFFER_BYTES },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout);
      }
    );
  });
}

export async function pingHost(
  input: string,
  run: PingCommandRunner = runPingCommand,
  now: () => number = Date.now
): Promise<HostPingResult> {
  const command = buildPingCommand(input);
  const host = normalizePingHost(input) ?? input.trim();
  if (!command) {
    return {
      host,
      reachable: false,
      latencyMs: null,
      checkedAt: now()
    };
  }

  try {
    const output = await run(command.file, command.args);
    return {
      host,
      reachable: true,
      latencyMs: parsePingLatency(output),
      checkedAt: now()
    };
  } catch {
    return {
      host,
      reachable: false,
      latencyMs: null,
      checkedAt: now()
    };
  }
}
