# Tile Host Ping Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live reachability dot and round-trip latency in every camera tile by sending one minimal ICMP request to each unique camera host every five seconds.

**Architecture:** Parse only the hostname from each camera URL in shared code, then ask the Electron main process to run macOS `/sbin/ping` without a shell. A renderer hook deduplicates hosts, polls immediately and every `5_000ms`, and passes transient status into a focused tile-header component; no ping state enters workspace persistence or webview navigation.

**Tech Stack:** Electron 42, Node.js `execFile`, React 19, TypeScript, Lucide React, Vitest, Testing Library, Playwright, macOS `/sbin/ping`.

## Global Constraints

- Ping the URL hostname only; never send the page path, query, fragment, credentials, or port to `/sbin/ping`.
- Send exactly one ICMP request with a `16`-byte data payload per unique host every `5_000ms`; `16` bytes is the smallest macOS payload that still reports round-trip time.
- Use a `1_000ms` ping wait and a bounded child-process timeout so unreachable cameras cannot accumulate processes.
- Invoke `/sbin/ping` with `execFile` and validated arguments; never use a shell or construct a command string from camera data.
- Render reachable as green with current latency, unreachable as red with `Offline`, and initial checks as neutral gray.
- Keep polling and results transient. Do not alter saved jobs, lists, cameras, tiles, URLs, cookies, credentials, or zoom state.
- Do not reload, navigate, mount, or unmount a webview because of a ping result.
- Deduplicate cameras that resolve to the same host so they share one packet and one result per interval.

---

### Task 1: Add the host parser and secure macOS ping service

**Files:**
- Create: `src/shared/hostPing.ts`
- Create: `src/shared/hostPing.test.ts`
- Create: `src/electron/hostPing.ts`
- Create: `src/electron/hostPing.test.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.cts`
- Modify: `src/renderer/state/workspaceStorage.ts`

**Interfaces:**
- Produces: `cameraHostFromUrl(url: string): string | null`.
- Produces: `HostPingResult` with `host`, `reachable`, `latencyMs`, and `checkedAt`.
- Produces: `pingHost(host: string, run?, now?): Promise<HostPingResult>`.
- Exposes: `window.ditbrowse.pingHost(host: string): Promise<HostPingResult>` through `host:ping` IPC.

- [ ] **Step 1: Write failing shared host-parser tests**

```ts
import { describe, expect, it } from "vitest";
import { cameraHostFromUrl } from "./hostPing";

describe("cameraHostFromUrl", () => {
  it("extracts only the base host from a full camera page", () => {
    expect(cameraHostFromUrl("http://10.20.100.108/rmt.html?mode=1#camera")).toBe(
      "10.20.100.108"
    );
  });

  it("drops credentials and ports from the ping target", () => {
    expect(cameraHostFromUrl("https://admin:secret@camera.local:8443/index")).toBe(
      "camera.local"
    );
  });

  it("rejects non-network and malformed URLs", () => {
    expect(cameraHostFromUrl("data:text/plain,hello")).toBeNull();
    expect(cameraHostFromUrl("not a camera URL")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the shared test and verify it fails**

Run: `npx vitest run src/shared/hostPing.test.ts`

Expected: FAIL because `src/shared/hostPing.ts` does not exist.

- [ ] **Step 3: Implement the shared contract and hostname parser**

```ts
import { normalizeCameraUrl } from "./url.js";

export interface HostPingResult {
  host: string;
  reachable: boolean;
  latencyMs: number | null;
  checkedAt: number;
}

export type HostPingStatus =
  | { state: "checking"; host: string }
  | ({ state: "online" } & HostPingResult)
  | ({ state: "offline" } & HostPingResult);

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
```

- [ ] **Step 4: Write failing ping command tests**

Test exact command construction, hostname validation, latency parsing, successful timing, and timeout/error behavior:

```ts
it("uses one 16-byte packet with a one-second wait", () => {
  expect(buildPingCommand("10.20.100.108")).toEqual({
    file: "/sbin/ping",
    args: ["-n", "-c", "1", "-W", "1000", "-s", "16", "10.20.100.108"]
  });
});

it("reports parsed round-trip latency", async () => {
  const run = vi.fn(async () =>
    "24 bytes from 10.20.100.108: icmp_seq=0 ttl=64 time=4.27 ms"
  );

  await expect(pingHost("10.20.100.108", run, () => 1234)).resolves.toEqual({
    host: "10.20.100.108",
    reachable: true,
    latencyMs: 4.27,
    checkedAt: 1234
  });
});

it("reports an unreachable host without throwing", async () => {
  const run = vi.fn(async () => Promise.reject(new Error("timeout")));

  await expect(pingHost("10.20.100.108", run, () => 1234)).resolves.toEqual({
    host: "10.20.100.108",
    reachable: false,
    latencyMs: null,
    checkedAt: 1234
  });
});
```

- [ ] **Step 5: Implement the secure ping runner**

Use `node:net` to accept IPv4 literals and a strict DNS-label expression for hostnames. Reject IPv6 literals because the approved macOS `/sbin/ping` flags are IPv4-specific. Build fixed arguments and execute without a shell:

```ts
execFile(file, args, { timeout: 1_500, maxBuffer: 16_384 }, (error, stdout) => {
  if (error) {
    reject(error);
    return;
  }
  resolve(stdout);
});
```

Parse `time=4.27 ms` or `time<1 ms`. Treat a zero-exit response as reachable even if latency text is absent, and return `latencyMs: null` in that case.

- [ ] **Step 6: Expose the IPC method**

Register in `createWindow`:

```ts
ipcMain.handle("host:ping", (_event, host: string) => pingHost(host));
```

Expose in `preload.cts`:

```ts
pingHost: (host: string) =>
  ipcRenderer.invoke("host:ping", host) as Promise<HostPingResult>,
```

Add the matching optional method to `Window.ditbrowse` in `workspaceStorage.ts`.

- [ ] **Step 7: Run focused service tests and typecheck**

Run: `npx vitest run src/shared/hostPing.test.ts src/electron/hostPing.test.ts`

Run: `npm run typecheck`

Expected: all new tests pass and both TypeScript projects compile.

- [ ] **Step 8: Commit the ping service**

```bash
git add src/shared/hostPing.ts src/shared/hostPing.test.ts src/electron/hostPing.ts src/electron/hostPing.test.ts src/electron/main.ts src/electron/preload.cts src/renderer/state/workspaceStorage.ts
git commit -m "feat: add secure camera host ping service"
```

---

### Task 2: Poll unique hosts and render compact tile status

**Files:**
- Create: `src/renderer/state/useHostPingStatuses.ts`
- Create: `src/renderer/state/useHostPingStatuses.test.tsx`
- Create: `src/renderer/components/HostPingIndicator.tsx`
- Create: `src/renderer/components/HostPingIndicator.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/TileGrid.tsx`
- Modify: `src/renderer/components/TileGrid.test.tsx`
- Modify: `src/renderer/components/WebviewTile.tsx`
- Modify: `src/renderer/components/WebviewTile.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces: `useHostPingStatuses(urls: readonly string[]): ReadonlyMap<string, HostPingStatus>`.
- Consumes: `window.ditbrowse.pingHost` and `cameraHostFromUrl`.
- Produces: `HostPingIndicator({ status }: { status: HostPingStatus })`.
- Extends: `TileGridProps.pingStatusesByHost` and `WebviewTileProps.pingStatus`.

- [ ] **Step 1: Write failing polling tests**

Use fake timers and `renderHook` to prove immediate polling, host deduplication, and the five-second refresh:

```tsx
it("pings each unique base host immediately and every five seconds", async () => {
  vi.useFakeTimers();
  window.ditbrowse.pingHost = vi.fn(async (host) => ({
    host,
    reachable: true,
    latencyMs: 3.5,
    checkedAt: 100
  }));

  renderHook(() =>
    useHostPingStatuses([
      "http://10.20.100.101/rmt.html",
      "http://10.20.100.101/index",
      "http://10.20.100.102/"
    ])
  );

  await waitFor(() => expect(window.ditbrowse.pingHost).toHaveBeenCalledTimes(2));
  await act(async () => vi.advanceTimersByTimeAsync(5_000));
  expect(window.ditbrowse.pingHost).toHaveBeenCalledTimes(4);
});
```

Also verify rejected IPC calls become `offline`, stale results are ignored after URL changes, and no timer starts when the Electron ping method is unavailable.

- [ ] **Step 2: Implement the polling hook**

Export `HOST_PING_INTERVAL_MS = 5_000`. Derive a sorted, unique host list from URLs. On mount or host change, seed missing entries as `checking`, perform an immediate concurrent check, then schedule `window.setInterval(check, HOST_PING_INTERVAL_MS)`. Guard each cycle with `running` and each effect with `disposed` so checks cannot overlap or write stale state.

Map each result as:

```ts
result.reachable
  ? { state: "online", ...result }
  : { state: "offline", ...result }
```

- [ ] **Step 3: Write failing indicator tests**

```tsx
it("shows a green latency result", () => {
  render(
    <HostPingIndicator
      status={{
        state: "online",
        host: "10.20.100.101",
        reachable: true,
        latencyMs: 4.27,
        checkedAt: 100
      }}
    />
  );

  expect(screen.getByLabelText("Ping 10.20.100.101: 4.3 milliseconds")).toHaveClass(
    "online"
  );
  expect(screen.getByText("4.3 ms")).toBeVisible();
});

it("shows an offline state without removing the tile", () => {
  render(
    <HostPingIndicator
      status={{
        state: "offline",
        host: "10.20.100.105",
        reachable: false,
        latencyMs: null,
        checkedAt: 100
      }}
    />
  );

  expect(screen.getByText("Offline")).toBeVisible();
});
```

- [ ] **Step 4: Implement the indicator and tile propagation**

Use Lucide `Circle` at `7px`, filled with `currentColor`, plus text formatted as `<1 ms`, one decimal below `10ms`, and a rounded integer at `10ms` or above. Wrap the focusable status in the existing `Tooltip` component with a descriptive sentence naming the host, result, and one-packet/five-second behavior.

Call `useHostPingStatuses(workspace.tiles.map((tile) => tile.url))` in `App`, pass the map through `TileGrid`, and resolve each tile with `cameraHostFromUrl(tile.url)`. Render the indicator in the right side of the existing three-column tile label and remove the empty balance span.

The hook must derive a stable sorted host key internally, so the inline URL array does not restart polling when ping state causes `App` to rerender.

- [ ] **Step 5: Add layout and propagation regressions**

Extend `TileGrid.test.tsx` to pass statuses by host and assert reordered tiles keep the correct status. Extend `WebviewTile.test.tsx` to assert the camera number remains centered while the ping status renders at the right edge. Add CSS with stable grid tracks, fixed dot dimensions, no wrapping, and green/red/neutral token colors.

- [ ] **Step 6: Run focused renderer tests**

Run: `npx vitest run src/renderer/state/useHostPingStatuses.test.tsx src/renderer/components/HostPingIndicator.test.tsx src/renderer/components/TileGrid.test.tsx src/renderer/components/WebviewTile.test.tsx src/renderer/App.test.tsx`

Expected: all polling, UI, propagation, and existing webview lifecycle tests pass.

- [ ] **Step 7: Commit the renderer feature**

```bash
git add src/renderer/state/useHostPingStatuses.ts src/renderer/state/useHostPingStatuses.test.tsx src/renderer/components/HostPingIndicator.tsx src/renderer/components/HostPingIndicator.test.tsx src/renderer/App.tsx src/renderer/components/TileGrid.tsx src/renderer/components/TileGrid.test.tsx src/renderer/components/WebviewTile.tsx src/renderer/components/WebviewTile.test.tsx src/renderer/styles.css
git commit -m "feat: show live ping status on camera tiles"
```

---

### Task 3: Verify, rebuild, and install the macOS app

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`
- Generated: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Generated: `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`
- Install: `/Applications/DITBrowse.app`

- [ ] **Step 1: Add a browser-shell layout regression**

Inject a deterministic `window.ditbrowse.pingHost` mock before `page.goto`, then assert a tile displays a green latency state without changing the webview count, selected tab, or tile dimensions. Verify the status remains visible in focus mode.

```ts
await page.addInitScript(() => {
  window.ditbrowse = {
    version: "e2e",
    pingHost: async (host) => ({
      host,
      reachable: true,
      latencyMs: 4.2,
      checkedAt: Date.now()
    })
  };
});
await page.goto("/");
await expect(page.getByText("4.2 ms").first()).toBeVisible();
await expect(page.locator("webview")).toHaveCount(12);
```

- [ ] **Step 2: Run all verification suites**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run test:e2e`

Run: `npm run test:electron`

Expected: typecheck, all Vitest tests, browser tests, and packaged Electron smoke tests pass.

- [ ] **Step 3: Commit the browser regression**

```bash
git add tests/e2e/workspace.spec.ts
git commit -m "test: cover camera tile ping status"
```

- [ ] **Step 4: Build and sign the macOS release**

Run: `npm run package:mac:signed`

Expected: app and DMG are Developer ID signed with Team ID `8BWXULM784`; notarization remains an explicit separate opt-in.

- [ ] **Step 5: Install without touching user data**

Quit DITBrowse, move the existing `/Applications/DITBrowse.app` to a timestamped backup under `~/Documents/DITBrowse App Backups`, and copy the verified candidate into `/Applications/DITBrowse.app`. Do not modify `~/Library/Application Support/ditbrowse`.

- [ ] **Step 6: Launch and smoke-test live ping status**

Open `/Applications/DITBrowse.app`. Confirm loaded cameras show green latency or red `Offline`, values refresh after five seconds, focus/grid transitions keep the status visible, and no webview reload occurs. Verify the installed app signature with `codesign --verify --deep --strict`.

- [ ] **Step 7: Record final repository state**

Run: `git status --short --branch`

Expected: clean source tree on `codex/tile-ping-status`; generated release artifacts remain ignored.
