# Configurable Ping and Offline Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user save a global interval between camera-host pings and offer a compact per-tile reload control after a host has stayed unreachable for ten seconds.

**Architecture:** Store the ping interval in `WorkspaceState` so the existing debounced workspace persistence saves it between launches, and normalize legacy workspaces to the five-second default. Extend the transient host status with the start of the current offline period; the tile indicator owns a ten-second presentation timer and calls the tile's existing base-address reload helper without changing URLs or remounting other webviews.

**Tech Stack:** Electron 42, React 19, TypeScript, Lucide React, Vitest, Testing Library, Playwright.

## Global Constraints

- Default to one ping every `5` seconds and allow saved whole-second intervals from `1` through `300` seconds.
- Continue sending one `16`-byte ICMP packet per unique base host per interval.
- A host must remain continuously offline for `10_000ms` before its tile offers reload.
- Reload only the affected tile and use `reloadWebviewFromCameraRoot(webview, tile.url)` so the camera can redirect from its base IP again.
- A successful ping resets the offline timer and removes the reload control.
- Do not change camera URLs, cookies, credentials, zoom, webview mounts, or the state of any other tile.
- Use the existing `Button`, `Tooltip`, and Lucide `RotateCw` UI patterns with an accessible label and explanatory tooltip.

---

### Task 1: Persist a configurable ping interval

**Files:**
- Modify: `src/shared/hostPing.ts`
- Modify: `src/shared/hostPing.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/sampleData.ts`
- Modify: `src/renderer/state/workspaceReducer.ts`
- Modify: `src/renderer/state/workspaceReducer.test.ts`
- Modify: `src/renderer/components/WorkspaceSettings.tsx`
- Modify: `src/renderer/components/WorkspaceSettings.test.tsx`
- Modify: `src/renderer/components/CameraListEditor.test.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: `DEFAULT_HOST_PING_INTERVAL_SECONDS`, minimum/maximum constants, and `normalizeHostPingIntervalSeconds(value)`.
- Extends: `WorkspaceState.pingIntervalSeconds: number`.
- Adds: `WorkspaceAction` variant `{ type: "setPingIntervalSeconds"; seconds: number }`.
- Extends: `WorkspaceSettingsProps` with the current interval and an update callback.

- [ ] **Step 1: Write failing normalization, hydration, reducer, and settings tests**

```ts
expect(normalizeHostPingIntervalSeconds(undefined)).toBe(5);
expect(normalizeHostPingIntervalSeconds(0)).toBe(1);
expect(normalizeHostPingIntervalSeconds(301)).toBe(300);

const state = workspaceReducer(sampleWorkspace, {
  type: "setPingIntervalSeconds",
  seconds: 12
});
expect(state.pingIntervalSeconds).toBe(12);
```

Render `WorkspaceSettings`, enter `12`, submit `Save Interval`, and assert `onSetPingIntervalSeconds(12)`. Also assert invalid fractional and out-of-range values show an error and do not call the callback.

- [ ] **Step 2: Run the focused tests and verify the new contract fails**

Run: `npx vitest run src/shared/hostPing.test.ts src/renderer/state/workspaceReducer.test.ts src/renderer/components/WorkspaceSettings.test.tsx`

Expected: FAIL because the interval contract and settings controls do not exist.

- [ ] **Step 3: Implement constants, state migration, reducer action, and settings form**

```ts
export const DEFAULT_HOST_PING_INTERVAL_SECONDS = 5;
export const MIN_HOST_PING_INTERVAL_SECONDS = 1;
export const MAX_HOST_PING_INTERVAL_SECONDS = 300;

export function normalizeHostPingIntervalSeconds(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 5;
  return Math.min(300, Math.max(1, Math.round(numeric)));
}
```

Hydration must apply the normalizer so old saved workspaces receive `5`. The settings form keeps a draft, requires a whole number from `1` to `300`, and dispatches only when the user submits it.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run src/shared/hostPing.test.ts src/renderer/state/workspaceReducer.test.ts src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx`

Run: `npm run typecheck`

Expected: all pass.

- [ ] **Step 5: Commit the saved interval**

```bash
git add src/shared/hostPing.ts src/shared/hostPing.test.ts src/shared/types.ts src/shared/sampleData.ts src/renderer/state/workspaceReducer.ts src/renderer/state/workspaceReducer.test.ts src/renderer/components/WorkspaceSettings.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/App.tsx
git commit -m "feat: make camera ping interval configurable"
```

---

### Task 2: Track continuous offline time and offer per-tile reload

**Files:**
- Modify: `src/shared/hostPing.ts`
- Modify: `src/renderer/state/useHostPingStatuses.ts`
- Modify: `src/renderer/state/useHostPingStatuses.test.tsx`
- Modify: `src/renderer/components/HostPingIndicator.tsx`
- Modify: `src/renderer/components/HostPingIndicator.test.tsx`
- Modify: `src/renderer/components/WebviewTile.tsx`
- Modify: `src/renderer/components/WebviewTile.test.tsx`
- Modify: `src/renderer/components/TileGrid.tsx`
- Modify: `src/renderer/components/TileGrid.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Changes: `useHostPingStatuses(urls, intervalMs)` polls at the saved interval.
- Extends: offline `HostPingStatus` with `offlineSince`.
- Changes: `HostPingIndicator` accepts `pingIntervalSeconds` and `onReload`.
- Changes: `WebviewTile` and `TileGrid` receive the interval and route reload to the correct webview.

- [ ] **Step 1: Write failing polling and continuous-offline tests**

Verify a custom `12_000ms` interval schedules the next cycle at 12 seconds. Verify consecutive failures preserve the original `offlineSince`, an online result resets it, and a later failure starts a new period.

- [ ] **Step 2: Write failing indicator and tile reload tests**

Use fake time to prove the reload button is absent at 9,999ms, appears at 10,000ms, disappears on an online status, and invokes `onReload`. In `WebviewTile`, mock `loadURL` and assert the control reloads only that webview from the base camera URL.

- [ ] **Step 3: Implement polling interval and offline-period preservation**

```ts
setStatuses((current) => new Map(results.map((result) => {
  const previous = current.get(result.host);
  return [result.host, result.reachable
    ? { state: "online", ...result }
    : {
        state: "offline",
        ...result,
        offlineSince: previous?.state === "offline"
          ? previous.offlineSince
          : result.checkedAt
      }];
})));
```

Use the normalized workspace interval in `setInterval`; keep the existing no-overlap and stale-result guards.

- [ ] **Step 4: Implement the delayed icon-only reload control**

`HostPingIndicator` schedules one timeout for `offlineSince + 10_000`. After it fires, render a 16px icon button with `RotateCw`, label it `Reload camera at HOST`, and explain in the tooltip that it reloads only that camera from its base address. `WebviewTile` passes a callback that calls `reloadWebviewFromCameraRoot` for its own ref.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx vitest run src/renderer/state/useHostPingStatuses.test.tsx src/renderer/components/HostPingIndicator.test.tsx src/renderer/components/WebviewTile.test.tsx src/renderer/components/TileGrid.test.tsx`

Run: `npm run typecheck`

Expected: all pass.

- [ ] **Step 6: Commit offline reload controls**

```bash
git add src/shared/hostPing.ts src/renderer/state/useHostPingStatuses.ts src/renderer/state/useHostPingStatuses.test.tsx src/renderer/components/HostPingIndicator.tsx src/renderer/components/HostPingIndicator.test.tsx src/renderer/components/WebviewTile.tsx src/renderer/components/WebviewTile.test.tsx src/renderer/components/TileGrid.tsx src/renderer/components/TileGrid.test.tsx src/renderer/styles.css
git commit -m "feat: offer reload for offline camera tiles"
```

---

### Task 3: Verify and install the production app

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`

**Interfaces:**
- Verifies: saved interval settings, delayed per-tile reload visibility, header fit, and webview retention.

- [ ] **Step 1: Add browser coverage for settings and delayed reload UI**

Mock ping replies deterministically, change the saved interval in Workspace Settings, and confirm the tile status remains visible. Drive an offline status for ten seconds and assert only the corresponding tile gains a reload button.

- [ ] **Step 2: Run all automated verification**

Run: `npm test`

Run: `npm run typecheck`

Run: the complete browser Playwright suite and Electron integration suite using the repository's existing commands.

Expected: every required test passes.

- [ ] **Step 3: Build, sign, verify, and install**

Run: `npm run package:mac:signed`

Verify the app and DMG with `codesign --verify`, back up the existing `/Applications/DITBrowse.app`, install the new bundle with `ditto`, compare `app.asar` hashes, and launch it.

- [ ] **Step 4: Visually inspect the running app**

Capture the production window after at least one polling cycle. Confirm tile headers do not clip, the offline reload icon is compact, and the settings form aligns with the existing command strip.

- [ ] **Step 5: Commit verification coverage**

```bash
git add tests/e2e/workspace.spec.ts docs/superpowers/plans/2026-07-17-configurable-ping-reload.md
git commit -m "test: cover configurable ping recovery"
```
