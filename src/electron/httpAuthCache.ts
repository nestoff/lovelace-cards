import type { HttpAuthRequest, HttpAuthResponse } from "../shared/httpAuth.js";

export interface HttpAuthChallenge {
  url: string;
  host: string;
  port: number;
  realm?: string;
  scheme?: string;
  isProxy?: boolean;
  webContentsId?: number;
}

export function createHttpAuthRequest(
  requestId: string,
  challenge: HttpAuthChallenge
): HttpAuthRequest {
  return {
    requestId,
    url: challenge.url,
    host: challenge.host,
    port: challenge.port,
    ...(challenge.realm ? { realm: challenge.realm } : {}),
    ...(challenge.scheme ? { scheme: challenge.scheme } : {}),
    ...(challenge.isProxy !== undefined ? { isProxy: challenge.isProxy } : {}),
    ...(challenge.webContentsId !== undefined
      ? { webContentsId: challenge.webContentsId }
      : {})
  };
}

interface CachedHttpAuthCredential {
  username: string;
  password: string;
  expiresAt: number;
}

const defaultCacheTtlMs = 30_000;
const keySeparator = "\u001f";

function normalizedProtocol(url: string): string {
  try {
    return new URL(url).protocol.toLowerCase();
  } catch {
    return "";
  }
}

export function createHttpAuthCacheKey(challenge: HttpAuthChallenge): string {
  return [
    challenge.webContentsId ?? "app",
    challenge.isProxy ? "proxy" : "server",
    normalizedProtocol(challenge.url),
    challenge.scheme?.toLowerCase() ?? "",
    challenge.host.toLowerCase(),
    Number.isFinite(challenge.port) ? challenge.port : "",
    challenge.realm ?? ""
  ].join(keySeparator);
}

export class HttpAuthCredentialCache {
  private readonly credentials = new Map<string, CachedHttpAuthCredential>();

  constructor(
    private readonly ttlMs = defaultCacheTtlMs,
    private readonly now = (): number => Date.now()
  ) {}

  get(challenge: HttpAuthChallenge): HttpAuthResponse | null {
    const key = createHttpAuthCacheKey(challenge);
    const credential = this.credentials.get(key);
    if (!credential) {
      return null;
    }

    if (credential.expiresAt <= this.now()) {
      this.credentials.delete(key);
      return null;
    }

    return {
      username: credential.username,
      password: credential.password
    };
  }

  set(challenge: HttpAuthChallenge, response: HttpAuthResponse): void {
    if (typeof response.username !== "string" || typeof response.password !== "string") {
      return;
    }

    this.credentials.set(createHttpAuthCacheKey(challenge), {
      username: response.username,
      password: response.password,
      expiresAt: this.now() + this.ttlMs
    });
  }

  clear(): void {
    this.credentials.clear();
  }
}
