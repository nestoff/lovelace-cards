import { describe, expect, it } from "vitest";
import {
  createHttpAuthRequest,
  createHttpAuthCacheKey,
  HttpAuthCredentialCache,
  type HttpAuthChallenge
} from "./httpAuthCache";

const challenge: HttpAuthChallenge = {
  url: "http://10.20.100.105/rmt.html",
  host: "10.20.100.105",
  port: 80,
  realm: "Please enter your ID and password.",
  scheme: "digest",
  isProxy: false,
  webContentsId: 12
};

describe("HttpAuthCredentialCache", () => {
  it("preserves the requesting guest ID in the renderer auth request", () => {
    expect(createHttpAuthRequest("request-1", challenge)).toEqual({
      requestId: "request-1",
      url: "http://10.20.100.105/rmt.html",
      host: "10.20.100.105",
      port: 80,
      realm: "Please enter your ID and password.",
      scheme: "digest",
      isProxy: false,
      webContentsId: 12
    });
  });

  it("omits the guest ID from renderer auth requests when Electron has none", () => {
    const { webContentsId: _webContentsId, ...challengeWithoutGuest } = challenge;

    expect(createHttpAuthRequest("request-2", challengeWithoutGuest)).not.toHaveProperty(
      "webContentsId"
    );
  });

  it("keys cached credentials by the requesting webview and digest challenge", () => {
    expect(createHttpAuthCacheKey(challenge)).toBe(
      createHttpAuthCacheKey({
        ...challenge,
        url: "http://10.20.100.105/"
      })
    );
    expect(createHttpAuthCacheKey(challenge)).not.toBe(
      createHttpAuthCacheKey({
        ...challenge,
        webContentsId: 13
      })
    );
    expect(createHttpAuthCacheKey(challenge)).not.toBe(
      createHttpAuthCacheKey({
        ...challenge,
        host: "10.20.100.108"
      })
    );
  });

  it("returns cached credentials until the short auth burst expires", () => {
    let now = 10_000;
    const cache = new HttpAuthCredentialCache(30_000, () => now);

    cache.set(challenge, { username: "admin", password: "secret" });

    expect(cache.get(challenge)).toEqual({ username: "admin", password: "secret" });

    now = 40_001;
    expect(cache.get(challenge)).toBeNull();
  });

  it("does not cache empty cancellation responses", () => {
    const cache = new HttpAuthCredentialCache();

    cache.set(challenge, {});

    expect(cache.get(challenge)).toBeNull();
  });

  it("can be cleared when the active job or camera list changes", () => {
    const cache = new HttpAuthCredentialCache();

    cache.set(challenge, { username: "admin", password: "secret" });
    cache.clear();

    expect(cache.get(challenge)).toBeNull();
  });
});
