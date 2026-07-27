# Modern UI And Session Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep DITBrowse's current browser layout while applying the approved Codex-inspired visual system and making selected-camera and whole-list session clearing reliable across camera types.

**Architecture:** Add shared base-address and guest-webview reset helpers, expose thorough Electron session reset operations through preload IPC, and coordinate reset state plus queued HTTP-authentication prompts in React. Build a small reusable UI layer for buttons, tooltips, dialogs, and status notices, then migrate the existing browser chrome, tools, editor, and authentication UI without moving their layout positions.

**Tech Stack:** Electron 42, React 19, TypeScript 5.8, Vite 6, Vitest 3, Testing Library, Playwright, Lucide React, macOS arm64 packaging.

## Global Constraints

- macOS remains the only supported platform.
- Keep Electron, React DOM, and persistent Electron webviews; do not replace the app architecture.
- Keep the current tab row, command strip, and equal-size camera-grid information architecture.
- Keep camera webviews mounted during ordinary resizing, focus-mode changes, and UI restyling.
- Reset reloads must use each tile's current HTTP/HTTPS base address and must not silently save redirect destinations.
- Saved password records and credential presets must survive both reset scopes.
- The first HTTP-authentication challenge after reset must require an explicit **Sign in** action.
- No new runtime dependency is required; use React portals and existing Lucide icons.
- Controls must remain inside the window at the existing minimum size of 960x640.
- Use the approved near-black Codex-inspired tokens and avoid indiscriminate pill borders, gradients, or decorative effects.
- Main-process, preload, or IPC changes require a fresh packaged Electron app before verification is complete.

## File Map

**Create:**

- `src/electron/session.test.ts` - Electron session reset contract tests.
- `src/renderer/state/httpAuthQueue.ts` - FIFO authentication queue and one-shot manual-authentication gate.
- `src/renderer/state/httpAuthQueue.test.ts` - Queue and gate tests.
- `src/renderer/sessionReset.ts` - Selected-camera and whole-list reset coordinator.
- `src/renderer/sessionReset.test.ts` - Coordinator behavior and stale-operation tests.
- `src/renderer/components/ui/Button.tsx` - Reusable ghost, subtle, primary, and danger buttons.
- `src/renderer/components/ui/Tooltip.tsx` - Portal-based descriptive tooltip positioning.
- `src/renderer/components/ui/Dialog.tsx` - Shared accessible dialog shell.
- `src/renderer/components/ui/StatusNotice.tsx` - Busy, success, partial, and error feedback.
- `src/renderer/components/ui/uiPrimitives.test.tsx` - UI primitive interaction and accessibility tests.
- `tests/electron/session-reset.spec.ts` - Packaged Electron reset smoke test.
- `playwright.electron.config.ts` - Electron-only Playwright configuration.

**Modify:**

- `src/shared/url.ts` and `src/shared/url.test.ts` - strict base-address derivation.
- `src/renderer/browserControls.ts` and `src/renderer/browserControls.test.ts` - guest `sessionStorage` cleanup and direct base navigation.
- `src/electron/session.ts` - thorough camera/list session reset operations.
- `src/electron/main.ts` - reset IPC and temporary auth-cache coordination.
- `src/electron/preload.cts` - renderer reset bridge.
- `src/electron/httpAuthCache.ts` and `src/electron/httpAuthCache.test.ts` - explicit cache generation/clear assertions if needed by reset IPC.
- `src/renderer/state/workspaceStorage.ts` and `src/renderer/state/workspaceStorage.test.ts` - typed reset bridge wrappers.
- `src/renderer/App.tsx` and `src/renderer/App.test.tsx` - auth queue, one-shot manual sign-in, reset orchestration, confirmation, and status.
- `src/renderer/components/ui/IconButton.tsx` - compose the new button and tooltip primitives.
- `src/renderer/components/BrowserChrome.tsx` and `src/renderer/components/BrowserChrome.test.tsx` - modern controls and reset state plumbing.
- `src/renderer/components/BrowserToolbar.tsx` - Codex-style command actions and tooltip copy.
- `src/renderer/components/AddressBar.tsx` - modern input and icon actions.
- `src/renderer/components/GridControls.tsx` - compact soft-filled controls.
- `src/renderer/components/TabStrip.tsx` - modern flat tabs and hover actions.
- `src/renderer/components/CookieCommands.tsx` - camera/list reset commands and busy state.
- `src/renderer/components/BrowserToolsMenu.tsx` - whole-app surface migration.
- `src/renderer/components/JobListSelector.tsx` - modern controls and in-app confirmation path.
- `src/renderer/components/CameraListEditor.tsx` and its tests - modern editor controls without behavior regressions.
- `src/renderer/styles.css` and `src/renderer/toolbarLayout.test.ts` - approved tokens, responsive layout, dialogs, tooltips, and notices.
- `tests/e2e/mock-camera-server.ts` and `tests/e2e/workspace.spec.ts` - richer mock state plus UI/responsiveness coverage.
- `package.json` - Electron smoke-test script.

**Delete after all callers migrate:**

- `src/renderer/components/ui/PillButton.tsx`.

---

### Task 1: Base Address And Guest Runtime Reset Helpers

**Files:**
- Modify: `src/shared/url.ts`
- Modify: `src/shared/url.test.ts`
- Modify: `src/renderer/browserControls.ts`
- Modify: `src/renderer/browserControls.test.ts`

**Interfaces:**
- Produces: `cameraBaseAddressFromUrl(input: string): { baseUrl: string; origin: string } | null`.
- Produces: `clearTileRuntimeSession(tileId: string): Promise<boolean>`.
- Produces: `loadTileBaseAddress(tileId: string, baseUrl: string): Promise<boolean>`.

- [ ] **Step 1: Write failing base-address tests**

Add these cases to `src/shared/url.test.ts`:

```ts
import { cameraBaseAddressFromUrl } from "./url";

describe("cameraBaseAddressFromUrl", () => {
  it("returns an HTTP camera origin with an explicit root slash", () => {
    expect(cameraBaseAddressFromUrl("http://10.20.100.108/rmt.html?mode=1")).toEqual({
      origin: "http://10.20.100.108",
      baseUrl: "http://10.20.100.108/"
    });
  });

  it("preserves HTTPS, ports, and typed host text", () => {
    expect(cameraBaseAddressFromUrl("https://10.20.100.05:8443/index.html")).toEqual({
      origin: "https://10.20.100.05:8443",
      baseUrl: "https://10.20.100.05:8443/"
    });
  });

  it("rejects invalid and non-web URLs", () => {
    expect(cameraBaseAddressFromUrl("about:blank")).toBeNull();
    expect(cameraBaseAddressFromUrl("not a url")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the URL test and verify failure**

Run: `npm test -- src/shared/url.test.ts`  
Expected: FAIL because `cameraBaseAddressFromUrl` is not exported.

- [ ] **Step 3: Implement strict base-address derivation**

Add to `src/shared/url.ts`, reusing `normalizeCameraUrl` and `httpOriginPreservingHostText`:

```ts
export interface CameraBaseAddress {
  origin: string;
  baseUrl: string;
}

export function cameraBaseAddressFromUrl(input: string): CameraBaseAddress | null {
  const normalized = normalizeCameraUrl(input);

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const origin = httpOriginPreservingHostText(normalized) ?? parsed.origin;
    return { origin, baseUrl: `${origin}/` };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Write failing guest-runtime tests**

Extend the webview stub in `src/renderer/browserControls.test.ts` with `stop` and `executeJavaScript`, then add:

```ts
it("clears sessionStorage and stops the selected guest", async () => {
  const webview = addWebview("tile-1");
  webview.stop = vi.fn();
  webview.executeJavaScript = vi.fn(async () => undefined);

  await expect(clearTileRuntimeSession("tile-1")).resolves.toBe(true);

  expect(webview.stop).toHaveBeenCalledOnce();
  expect(webview.executeJavaScript).toHaveBeenCalledWith("sessionStorage.clear()", true);
});

it("reports a guest cleanup failure without throwing", async () => {
  const webview = addWebview("tile-1");
  webview.stop = vi.fn();
  webview.executeJavaScript = vi.fn(async () => {
    throw new Error("guest unavailable");
  });

  await expect(clearTileRuntimeSession("tile-1")).resolves.toBe(false);
});

it("loads an exact base address into one tile", async () => {
  const webview = addWebview("tile-1");

  await expect(loadTileBaseAddress("tile-1", "http://10.20.100.108/")).resolves.toBe(true);
  expect(webview.loadURL).toHaveBeenCalledWith("http://10.20.100.108/");
});
```

- [ ] **Step 5: Run the browser-control test and verify failure**

Run: `npm test -- src/renderer/browserControls.test.ts`  
Expected: FAIL because the new helpers are not exported.

- [ ] **Step 6: Implement guest-runtime helpers**

Export the existing webview lookup and add:

```ts
export async function clearTileRuntimeSession(tileId: string): Promise<boolean> {
  const webview = findWebviewForTile(tileId);
  if (!webview || typeof webview.executeJavaScript !== "function") {
    return false;
  }

  try {
    webview.stop?.();
    await webview.executeJavaScript("sessionStorage.clear()", true);
    return true;
  } catch {
    return false;
  }
}

export async function loadTileBaseAddress(
  tileId: string,
  baseUrl: string
): Promise<boolean> {
  const webview = findWebviewForTile(tileId);
  if (!webview || typeof webview.loadURL !== "function") {
    return false;
  }

  try {
    await webview.loadURL(baseUrl);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Run focused tests**

Run: `npm test -- src/shared/url.test.ts src/renderer/browserControls.test.ts`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/url.ts src/shared/url.test.ts src/renderer/browserControls.ts src/renderer/browserControls.test.ts
git commit -m "feat: add camera base reset helpers"
```

---

### Task 2: Electron Session Reset IPC

**Files:**
- Modify: `src/electron/session.ts`
- Create: `src/electron/session.test.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.cts`
- Modify: `src/renderer/state/workspaceStorage.ts`
- Modify: `src/renderer/state/workspaceStorage.test.ts`

**Interfaces:**
- Produces: `resetCameraSessionData(partition: string, origin: string): Promise<void>`.
- Produces: `resetListSessionData(partition: string): Promise<void>`.
- Exposes: `window.ditbrowse.resetCameraSessionData(partition, origin)` and `resetListSessionData(partition)`.

- [ ] **Step 1: Write failing Electron session tests**

Create `src/electron/session.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearData: vi.fn(async () => undefined),
  clearAuthCache: vi.fn(async () => undefined),
  closeAllConnections: vi.fn(async () => undefined),
  fromPartition: vi.fn()
}));
mocks.fromPartition.mockReturnValue({
  clearData: mocks.clearData,
  clearAuthCache: mocks.clearAuthCache,
  closeAllConnections: mocks.closeAllConnections
});

vi.mock("electron", () => ({ session: { fromPartition: mocks.fromPartition } }));

const { clearData, clearAuthCache, closeAllConnections } = mocks;

import { resetCameraSessionData, resetListSessionData } from "./session";

describe("session reset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears thorough origin data and partition HTTP auth for one camera", async () => {
    await resetCameraSessionData("persist:list", "http://10.20.100.108");

    expect(clearData).toHaveBeenCalledWith({
      origins: ["http://10.20.100.108"],
      dataTypes: [
        "backgroundFetch",
        "cache",
        "cookies",
        "fileSystems",
        "indexedDB",
        "localStorage",
        "serviceWorkers",
        "webSQL"
      ],
      avoidClosingConnections: false
    });
    expect(clearAuthCache).toHaveBeenCalledOnce();
    expect(closeAllConnections).not.toHaveBeenCalled();
  });

  it("clears all list data, authentication, and connections", async () => {
    await resetListSessionData("persist:list");

    expect(clearData).toHaveBeenCalledWith({
      dataTypes: expect.arrayContaining(["cookies", "cache", "localStorage"]),
      avoidClosingConnections: false
    });
    expect(clearAuthCache).toHaveBeenCalledOnce();
    expect(closeAllConnections).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the session test and verify failure**

Run: `npm test -- src/electron/session.test.ts`  
Expected: FAIL because the reset functions are not exported.

- [ ] **Step 3: Implement the Electron session operations**

Replace the old storage-only functions in `src/electron/session.ts` with:

```ts
import { session } from "electron";
import type { ClearDataOptions } from "electron";

const RESET_DATA_TYPES: NonNullable<ClearDataOptions["dataTypes"]> = [
  "backgroundFetch",
  "cache",
  "cookies",
  "fileSystems",
  "indexedDB",
  "localStorage",
  "serviceWorkers",
  "webSQL"
];

export async function resetCameraSessionData(
  partition: string,
  origin: string
): Promise<void> {
  const target = session.fromPartition(partition);
  await target.clearData({
    origins: [origin],
    dataTypes: RESET_DATA_TYPES,
    avoidClosingConnections: false
  });
  await target.clearAuthCache();
}

export async function resetListSessionData(partition: string): Promise<void> {
  const target = session.fromPartition(partition);
  await target.clearData({
    dataTypes: RESET_DATA_TYPES,
    avoidClosingConnections: false
  });
  await target.clearAuthCache();
  await target.closeAllConnections();
}
```

- [ ] **Step 4: Replace IPC handlers and clear the app auth cache**

In `src/electron/main.ts`, replace the old clear handlers with:

```ts
ipcMain.handle(
  "session:resetCamera",
  async (_event, partition: string, origin: string): Promise<void> => {
    await resetCameraSessionData(partition, origin);
    httpAuthCredentialCache.clear();
  }
);

ipcMain.handle(
  "session:resetList",
  async (_event, partition: string): Promise<void> => {
    await resetListSessionData(partition);
    httpAuthCredentialCache.clear();
  }
);
```

Remove `session:clearSelectedTile` and `session:clearPartition` registrations and imports.

- [ ] **Step 5: Expose and wrap the reset bridge**

In `src/electron/preload.cts` expose:

```ts
resetCameraSessionData: (partition: string, origin: string) =>
  ipcRenderer.invoke("session:resetCamera", partition, origin) as Promise<void>,
resetListSessionData: (partition: string) =>
  ipcRenderer.invoke("session:resetList", partition) as Promise<void>,
```

Update the global type and wrappers in `src/renderer/state/workspaceStorage.ts`:

```ts
export async function resetCameraSessionData(
  partition: string,
  origin: string
): Promise<void> {
  await window.ditbrowse?.resetCameraSessionData?.(partition, origin);
}

export async function resetListSessionData(partition: string): Promise<void> {
  await window.ditbrowse?.resetListSessionData?.(partition);
}
```

- [ ] **Step 6: Test renderer wrappers**

Add this wrapper test with bridge spies and exact arguments:

```ts
it("routes camera and list reset requests through Electron", async () => {
  const resetCamera = vi.fn(async () => undefined);
  const resetList = vi.fn(async () => undefined);
  window.ditbrowse = {
    version: "test",
    resetCameraSessionData: resetCamera,
    resetListSessionData: resetList
  };

  await resetCameraSessionData("persist:list", "http://10.20.100.108");
  await resetListSessionData("persist:list");

  expect(resetCamera).toHaveBeenCalledWith("persist:list", "http://10.20.100.108");
  expect(resetList).toHaveBeenCalledWith("persist:list");
});
```

- [ ] **Step 7: Run focused tests and typecheck**

Run: `npm test -- src/electron/session.test.ts src/renderer/state/workspaceStorage.test.ts`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/electron/session.ts src/electron/session.test.ts src/electron/main.ts src/electron/preload.cts src/renderer/state/workspaceStorage.ts src/renderer/state/workspaceStorage.test.ts
git commit -m "fix: reset complete camera sessions"
```

---

### Task 3: FIFO HTTP Authentication And One-Shot Manual Sign-In

**Files:**
- Create: `src/renderer/state/httpAuthQueue.ts`
- Create: `src/renderer/state/httpAuthQueue.test.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`

**Interfaces:**
- Produces: `HttpAuthPromptState` shared by queue helpers and `App`.
- Produces: `enqueueHttpAuthPrompt`, `updateCurrentHttpAuthPrompt`, `shiftHttpAuthPrompt`, and `removeHttpAuthPrompts`.
- Produces: `OneShotManualAuthGate.mark(tileIds)`, `.consume(tileId)`, `.clear(tileIds?)`.

- [ ] **Step 1: Write failing queue and gate tests**

Create `src/renderer/state/httpAuthQueue.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  OneShotManualAuthGate,
  enqueueHttpAuthPrompt,
  shiftHttpAuthPrompt,
  type HttpAuthPromptState
} from "./httpAuthQueue";

const prompt = (requestId: string, tileId: string): HttpAuthPromptState => ({
  request: { requestId, url: `http://${tileId}/`, host: tileId, port: 80 },
  tileId,
  cameraLabel: tileId,
  username: "admin",
  password: "secret",
  save: true
});

it("queues challenges in arrival order and ignores duplicate request IDs", () => {
  const first = enqueueHttpAuthPrompt([], prompt("one", "camera-1"));
  const second = enqueueHttpAuthPrompt(first, prompt("two", "camera-2"));
  const duplicate = enqueueHttpAuthPrompt(second, prompt("one", "camera-1"));

  expect(duplicate.map((item) => item.request.requestId)).toEqual(["one", "two"]);
  expect(shiftHttpAuthPrompt(duplicate)[0].request.requestId).toBe("two");
});

it("requires explicit authentication exactly once per marked tile", () => {
  const gate = new OneShotManualAuthGate();
  gate.mark(["tile-1", "tile-2"]);

  expect(gate.consume("tile-1")).toBe(true);
  expect(gate.consume("tile-1")).toBe(false);
  expect(gate.consume("tile-2")).toBe(true);
});
```

- [ ] **Step 2: Run the queue test and verify failure**

Run: `npm test -- src/renderer/state/httpAuthQueue.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement queue helpers and manual gate**

Create `src/renderer/state/httpAuthQueue.ts`:

```ts
import type { HttpAuthRequest } from "../../shared/httpAuth";

export interface HttpAuthPromptState {
  request: HttpAuthRequest;
  tileId: string | null;
  cameraLabel: string;
  username: string;
  password: string;
  save: boolean;
}

export function enqueueHttpAuthPrompt(
  queue: HttpAuthPromptState[],
  prompt: HttpAuthPromptState
): HttpAuthPromptState[] {
  return queue.some((item) => item.request.requestId === prompt.request.requestId)
    ? queue
    : [...queue, prompt];
}

export function updateCurrentHttpAuthPrompt(
  queue: HttpAuthPromptState[],
  patch: Partial<Pick<HttpAuthPromptState, "username" | "password" | "save">>
): HttpAuthPromptState[] {
  return queue.length === 0 ? queue : [{ ...queue[0], ...patch }, ...queue.slice(1)];
}

export function shiftHttpAuthPrompt(queue: HttpAuthPromptState[]): HttpAuthPromptState[] {
  return queue.slice(1);
}

export function removeHttpAuthPrompts(
  queue: HttpAuthPromptState[],
  predicate: (prompt: HttpAuthPromptState) => boolean
): { kept: HttpAuthPromptState[]; removed: HttpAuthPromptState[] } {
  return {
    kept: queue.filter((prompt) => !predicate(prompt)),
    removed: queue.filter(predicate)
  };
}

export class OneShotManualAuthGate {
  private readonly tileIds = new Set<string>();

  mark(tileIds: string[]): void {
    tileIds.forEach((tileId) => this.tileIds.add(tileId));
  }

  consume(tileId: string): boolean {
    if (!this.tileIds.has(tileId)) return false;
    this.tileIds.delete(tileId);
    return true;
  }

  clear(tileIds?: string[]): void {
    if (!tileIds) {
      this.tileIds.clear();
      return;
    }
    tileIds.forEach((tileId) => this.tileIds.delete(tileId));
  }
}
```

- [ ] **Step 4: Replace the single auth prompt in App**

In `src/renderer/App.tsx`:

- Replace `httpAuthPrompt` state with `httpAuthQueue`.
- Create `const manualAuthGateRef = useRef(new OneShotManualAuthGate())`.
- Treat `httpAuthQueue[0] ?? null` as the visible prompt.
- On a challenge, call `manualAuthGateRef.current.consume(tile.id)` before deciding whether to submit a saved record automatically.
- If confirmation is required, enqueue a prompt prefilled from `record` first and the matching preset second.
- On submit or cancel, send the response for the visible request and call `shiftHttpAuthPrompt`.
- On list change or tile closure, send empty responses for affected queued requests before removing them.

The challenge decision must have this shape:

```ts
const requiresManualSignIn = tile
  ? manualAuthGateRef.current.consume(tile.id)
  : false;

if (record && !requiresManualSignIn) {
  window.ditbrowse?.sendHttpAuthResponse?.(request.requestId, {
    username: record.username,
    password: record.password
  });
  return;
}

setHttpAuthQueue((queue) =>
  enqueueHttpAuthPrompt(queue, {
    request,
    tileId: tile?.id ?? currentWorkspace.selectedTileId,
    cameraLabel: tile?.title || authUrl,
    username: record?.username ?? preset?.username ?? "",
    password: record?.password ?? preset?.password ?? "",
    save: true
  })
);
```

- [ ] **Step 5: Add App regression tests**

Add this App regression test:

```ts
it("queues simultaneous HTTP auth prompts without overwriting either request", async () => {
  render(<App />);
  await screen.findByDisplayValue("http://192.168.1.01");

  act(() => {
    httpAuthRequestHandler?.({
      requestId: "auth-1",
      url: "http://192.168.1.01/",
      host: "192.168.1.01",
      port: 80
    });
    httpAuthRequestHandler?.({
      requestId: "auth-2",
      url: "http://192.168.1.02/",
      host: "192.168.1.02",
      port: 80
    });
  });

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "admin" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "one" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

  expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenNthCalledWith(
    1,
    "auth-1",
    { username: "admin", password: "one" }
  );
  expect(await screen.findByText("192.168.1.02")).toBeVisible();
});
```

Task 5 adds the saved-record reset integration test after the reset action can mark the manual-authentication gate.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/renderer/state/httpAuthQueue.test.ts src/renderer/App.test.tsx`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/state/httpAuthQueue.ts src/renderer/state/httpAuthQueue.test.ts src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "fix: queue camera authentication prompts"
```

---

### Task 4: Codex-Style UI Primitives And Descriptive Tooltips

**Files:**
- Create: `src/renderer/components/ui/Button.tsx`
- Create: `src/renderer/components/ui/Tooltip.tsx`
- Create: `src/renderer/components/ui/Dialog.tsx`
- Create: `src/renderer/components/ui/StatusNotice.tsx`
- Create: `src/renderer/components/ui/uiPrimitives.test.tsx`
- Modify: `src/renderer/components/ui/IconButton.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces: `Button` with `variant: "ghost" | "subtle" | "primary" | "danger"` and optional tooltip metadata.
- Produces: `Tooltip` render-prop trigger with `title`, `description`, and optional `shortcut`.
- Produces: `Dialog` with title, description, body, actions, and close callback.
- Produces: `StatusNotice` with `tone: "progress" | "success" | "partial" | "error"`.

- [ ] **Step 1: Write failing UI primitive tests**

Create `src/renderer/components/ui/uiPrimitives.test.tsx` with fake timers and assertions for:

```tsx
it("shows a descriptive tooltip after hover delay", async () => {
  vi.useFakeTimers();
  render(
    <Button
      aria-label="Reload camera"
      tooltip={{
        title: "Reload camera",
        description: "Loads this tile again from its base address.",
        shortcut: "⌘R"
      }}
    >
      Reload
    </Button>
  );

  fireEvent.pointerEnter(screen.getByRole("button", { name: "Reload camera" }));
  act(() => vi.advanceTimersByTime(400));

  expect(screen.getByRole("tooltip")).toHaveTextContent("Reload camera");
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    "Loads this tile again from its base address."
  );
  expect(screen.getByRole("tooltip")).toHaveTextContent("⌘R");
});

it("shows tooltips on keyboard focus and closes them with Escape", () => {
  render(<IconButton label="Workspace tools" tooltip={{
    title: "Workspace tools",
    description: "Manage jobs, camera lists, passwords, and session data."
  }} icon={<span>icon</span>} />);

  fireEvent.focus(screen.getByRole("button", { name: "Workspace tools" }));
  expect(screen.getByRole("tooltip")).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
```

Also test Dialog `role="dialog"`, title association, close button, primary action, and StatusNotice `role="status"` versus `role="alert"` for errors.

- [ ] **Step 2: Run the primitive test and verify failure**

Run: `npm test -- src/renderer/components/ui/uiPrimitives.test.tsx`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement Tooltip with a portal and collision-safe fixed positioning**

Use a render-prop trigger so `aria-describedby` is applied to the actual interactive element:

```ts
export interface TooltipTriggerProps {
  ref: (node: HTMLElement | null) => void;
  "aria-describedby"?: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

interface TooltipProps {
  title: string;
  description: string;
  shortcut?: string;
  children: (props: TooltipTriggerProps) => ReactNode;
}
```

Use a 400ms pointer delay, immediate keyboard focus, `createPortal(..., document.body)`, fixed coordinates from `getBoundingClientRect`, an 8px viewport margin, and placement above the trigger when there is insufficient room below. Register one document `keydown` listener while open to close on Escape.

- [ ] **Step 4: Implement Button, IconButton, Dialog, and StatusNotice**

`Button` must render a real `<button>` with stable classes and only wrap itself in Tooltip when metadata exists:

```tsx
<Button
  variant="ghost"
  icon={<RotateCw size={16} />}
  tooltip={{
    title: "Reload camera",
    description: "Loads the selected camera from its base address.",
    shortcut: "⌘R"
  }}
  aria-label="Reload camera"
/>
```

`Dialog` must use `aria-modal="true"`, label itself with `useId`, close on Escape, and leave action ordering to the caller. `StatusNotice` must use `role="alert"` only for `tone="error"`; other tones use `role="status"`.

- [ ] **Step 5: Add the approved foundational tokens**

At the top of `styles.css`, replace legacy tokens with:

```css
:root {
  color-scheme: dark;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  --window: #080809;
  --chrome: #111112;
  --surface: #1d1d1f;
  --surface-hover: #2a2a2d;
  --surface-selected: #303033;
  --text-strong: #f1f1f2;
  --text: #d7d7db;
  --muted: #a0a0a6;
  --quiet: #6f6f76;
  --focus: #7d9dee;
  --danger: #e88c86;
  --radius-control: 10px;
  --radius-surface: 14px;
}
```

Add stable 34px icon-button and 36px text-button dimensions, soft filled hover states, visible focus rings, portal tooltip styles, dialog styles, and notice styles. Do not migrate all legacy selectors yet.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm test -- src/renderer/components/ui/uiPrimitives.test.tsx`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/ui/Button.tsx src/renderer/components/ui/Tooltip.tsx src/renderer/components/ui/Dialog.tsx src/renderer/components/ui/StatusNotice.tsx src/renderer/components/ui/IconButton.tsx src/renderer/components/ui/uiPrimitives.test.tsx src/renderer/styles.css
git commit -m "feat: add modern UI primitives"
```

---

### Task 5: Reset Coordinator, Confirmation, Progress, And Explicit First Sign-In

**Files:**
- Create: `src/renderer/sessionReset.ts`
- Create: `src/renderer/sessionReset.test.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/components/CookieCommands.tsx`
- Modify: `src/renderer/components/BrowserToolsMenu.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/BrowserChrome.test.tsx`

**Interfaces:**
- Produces: `resetSelectedCamera(input, dependencies): Promise<SessionResetResult>`.
- Produces: `resetCameraList(input, dependencies): Promise<SessionResetResult>`.
- Consumes Task 1 guest helpers, Task 2 Electron bridge, Task 3 manual-auth gate, and Task 4 Dialog/StatusNotice.

- [ ] **Step 1: Write failing coordinator tests**

Create `src/renderer/sessionReset.test.ts` with this setup and the first three behavior tests:

```ts
import { describe, expect, it, vi } from "vitest";
import type { TileState } from "../shared/types";
import {
  resetCameraList,
  resetSelectedCamera,
  type SessionResetDependencies
} from "./sessionReset";

function tile(id: string, url: string): TileState {
  return {
    id,
    cameraId: id.replace("tile", "camera"),
    url,
    title: id,
    partition: "persist:list",
    viewport: { width: 1024, height: 768 },
    zoom: 1
  };
}

const selectedTile = tile("tile-41", "http://10.20.100.108/rmt.html");

function createDependencies(
  overrides: Partial<SessionResetDependencies> = {}
): SessionResetDependencies {
  return {
    clearRuntime: vi.fn(async () => true),
    resetCameraData: vi.fn(async () => undefined),
    resetListData: vi.fn(async () => undefined),
    loadBase: vi.fn(async () => true),
    markManualAuth: vi.fn(),
    clearManualAuth: vi.fn(),
    isCurrent: vi.fn(() => true),
    wait: vi.fn(async () => undefined),
    ...overrides
  };
}

it("clears runtime and persistent state before loading one base URL", async () => {
  const calls: string[] = [];
  const result = await resetSelectedCamera(
    { tile: selectedTile, operationKey: "job:list" },
    {
      clearRuntime: async () => { calls.push("runtime"); return true; },
      resetCameraData: async () => { calls.push("electron"); },
      loadBase: async () => { calls.push("load"); return true; },
      markManualAuth: (ids) => calls.push(`mark:${ids.join(",")}`),
      clearManualAuth: () => calls.push("unmark"),
      isCurrent: () => true,
      wait: async () => undefined
    }
  );

  expect(calls).toEqual(["mark:tile-41", "runtime", "electron", "load"]);
  expect(result).toMatchObject({ tone: "success", reloaded: 1, skipped: 0 });
});

it("does not navigate after cleanup failure", async () => {
  const loadBase = vi.fn(async () => true);
  const clearManualAuth = vi.fn();
  const dependencies = createDependencies({
    resetCameraData: async () => { throw new Error("clear failed"); },
    clearManualAuth,
    loadBase
  });

  await expect(
    resetSelectedCamera(
      { tile: selectedTile, operationKey: "job:list" },
      dependencies
    )
  ).rejects.toThrow("clear failed");
  expect(loadBase).not.toHaveBeenCalled();
  expect(clearManualAuth).toHaveBeenCalledWith(["tile-41"]);
});

it("reloads valid list tiles in row order and reports skipped URLs", async () => {
  const loaded: string[] = [];
  const dependencies = createDependencies({
    loadBase: async (id) => { loaded.push(id); return true; }
  });
  const result = await resetCameraList(
    {
      tiles: [
        tile("tile-a", "http://10.20.100.101/rmt.html"),
        tile("tile-blank", "about:blank"),
        tile("tile-b", "http://10.20.100.102/index.html")
      ],
      partition: "persist:list",
      operationKey: "job:list"
    },
    dependencies
  );

  expect(loaded).toEqual(["tile-a", "tile-b"]);
  expect(result).toMatchObject({ tone: "partial", reloaded: 2, skipped: 1 });
});
```

Add an `it.each` table for stale `isCurrent() === false`, a `clearRuntime` false result, and a `loadBase` false result. Assert that each result is `partial`, affected tile IDs are passed to `clearManualAuth`, and no later tile loads after staleness. Assert the injected `wait` spy receives `0` and `150` for two valid targets.

- [ ] **Step 2: Run coordinator tests and verify failure**

Run: `npm test -- src/renderer/sessionReset.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the coordinator**

Define:

```ts
import type { TileState } from "../shared/types";
import {
  cameraBaseAddressFromUrl,
  type CameraBaseAddress
} from "../shared/url";

export interface SessionResetResult {
  tone: "success" | "partial";
  message: string;
  reloaded: number;
  skipped: number;
  failed: string[];
}

export interface SessionResetDependencies {
  clearRuntime(tileId: string): Promise<boolean>;
  resetCameraData(partition: string, origin: string): Promise<void>;
  resetListData(partition: string): Promise<void>;
  loadBase(tileId: string, baseUrl: string): Promise<boolean>;
  markManualAuth(tileIds: string[]): void;
  clearManualAuth(tileIds: string[]): void;
  isCurrent(operationKey: string): boolean;
  wait(delayMs: number): Promise<void>;
}

interface SelectedResetInput {
  tile: TileState;
  operationKey: string;
}

interface ListResetInput {
  tiles: TileState[];
  partition: string;
  operationKey: string;
}
```

Implement `resetSelectedCamera` with this control flow:

```ts
export async function resetSelectedCamera(
  input: SelectedResetInput,
  dependencies: SessionResetDependencies
): Promise<SessionResetResult> {
  const target = cameraBaseAddressFromUrl(input.tile.url);
  if (!target) {
    return {
      tone: "partial",
      message: "This tile does not have a camera web address to clear.",
      reloaded: 0,
      skipped: 1,
      failed: [input.tile.title]
    };
  }

  dependencies.markManualAuth([input.tile.id]);
  try {
    if (!(await dependencies.clearRuntime(input.tile.id))) {
      throw new Error(`Could not clear in-page data for ${input.tile.title}`);
    }
    await dependencies.resetCameraData(input.tile.partition, target.origin);
    if (!dependencies.isCurrent(input.operationKey)) {
      dependencies.clearManualAuth([input.tile.id]);
      return {
        tone: "partial",
        message: "Camera data was cleared, but the workspace changed before reload.",
        reloaded: 0,
        skipped: 1,
        failed: [input.tile.title]
      };
    }
    if (!(await dependencies.loadBase(input.tile.id, target.baseUrl))) {
      dependencies.clearManualAuth([input.tile.id]);
      return {
        tone: "partial",
        message: `Camera data was cleared, but ${input.tile.title} did not reload.`,
        reloaded: 0,
        skipped: 0,
        failed: [input.tile.title]
      };
    }
    return {
      tone: "success",
      message: `Cleared camera data and reloaded ${target.baseUrl}`,
      reloaded: 1,
      skipped: 0,
      failed: []
    };
  } catch (error) {
    dependencies.clearManualAuth([input.tile.id]);
    throw error;
  }
}
```

Implement `resetCameraList` with this ordered, stale-safe flow:

```ts
export async function resetCameraList(
  input: ListResetInput,
  dependencies: SessionResetDependencies
): Promise<SessionResetResult> {
  const mapped = input.tiles.map((tile) => ({
    tile,
    address: cameraBaseAddressFromUrl(tile.url)
  }));
  const targets = mapped.filter(
    (item): item is { tile: TileState; address: CameraBaseAddress } =>
      item.address !== null
  );
  const invalid = mapped.filter((item) => item.address === null);
  const markedIds = targets.map((target) => target.tile.id);
  dependencies.markManualAuth(markedIds);

  try {
    const runtimeTargets = await Promise.all(
      targets.map(async (target) => ({
        ...target,
        runtimeCleared: await dependencies.clearRuntime(target.tile.id)
      }))
    );
    await dependencies.resetListData(input.partition);

    let reloaded = 0;
    let skipped = invalid.length;
    const failed = invalid.map((item) => item.tile.title);
    let loadIndex = 0;

    for (let index = 0; index < runtimeTargets.length; index += 1) {
      const target = runtimeTargets[index];
      if (!target.runtimeCleared) {
        skipped += 1;
        failed.push(target.tile.title);
        dependencies.clearManualAuth([target.tile.id]);
        continue;
      }

      if (!dependencies.isCurrent(input.operationKey)) {
        const remaining = runtimeTargets.slice(index).map((item) => item.tile.id);
        skipped += remaining.length;
        failed.push(...runtimeTargets.slice(index).map((item) => item.tile.title));
        dependencies.clearManualAuth(remaining);
        break;
      }

      await dependencies.wait(loadIndex * 150);
      loadIndex += 1;
      if (!dependencies.isCurrent(input.operationKey)) {
        const remaining = runtimeTargets.slice(index).map((item) => item.tile.id);
        skipped += remaining.length;
        failed.push(...runtimeTargets.slice(index).map((item) => item.tile.title));
        dependencies.clearManualAuth(remaining);
        break;
      }

      if (await dependencies.loadBase(target.tile.id, target.address.baseUrl)) {
        reloaded += 1;
      } else {
        failed.push(target.tile.title);
        dependencies.clearManualAuth([target.tile.id]);
      }
    }

    const tone = skipped === 0 && failed.length === 0 ? "success" : "partial";
    return {
      tone,
      message:
        tone === "success"
          ? `Cleared list data and reloaded ${reloaded} cameras.`
          : `Cleared list data; reloaded ${reloaded}, skipped ${skipped}, failed ${failed.length}.`,
      reloaded,
      skipped,
      failed
    };
  } catch (error) {
    dependencies.clearManualAuth(markedIds);
    throw error;
  }
}
```

- [ ] **Step 4: Integrate reset runtime state in App**

Add runtime-only state:

```ts
const [resetBusy, setResetBusy] = useState(false);
const [confirmListReset, setConfirmListReset] = useState(false);
const [resetNotice, setResetNotice] = useState<SessionResetResult | { tone: "error"; message: string } | null>(null);
const activeWorkspaceKeyRef = useRef("");
```

Keep `activeWorkspaceKeyRef.current` synchronized with `${activeJobId}:${activeCameraListId}`. Build coordinator dependencies from the bridge helpers and `manualAuthGateRef.current`.

Selected reset starts immediately. List reset opens the shared Dialog; confirmation starts reset. Both set `resetBusy`, clear old notices, and convert thrown errors to an error StatusNotice without navigating.

- [ ] **Step 5: Replace cookie command props and labels**

`CookieCommands` should receive:

```ts
interface CookieCommandsProps {
  canResetSelected: boolean;
  canResetList: boolean;
  busy: boolean;
  onResetSelected: () => void;
  onRequestResetList: () => void;
}
```

Render **Clear camera data** and **Clear list data** with `Button variant="danger"`. Their tooltip descriptions must explain that they sign cameras out and reload base addresses. Pass these props through `BrowserToolsMenu` and `BrowserChrome` without exposing partition or URL arguments to presentation components.

- [ ] **Step 6: Add confirmation and notice UI**

Render the list confirmation with copy:

```text
Clear data for every camera?
This signs every camera out, clears browsing data and active authentication, then reloads each camera from its base address. Saved usernames and passwords are kept.
```

Actions are **Cancel** and primary **Clear and reload**. Render StatusNotice outside the toolbar so it cannot resize command-strip controls.

- [ ] **Step 7: Add App and component tests**

Add this App-level reset case, using the existing saved-password workspace fixture and webview stubs:

```ts
it("keeps the saved password but requires explicit sign in after camera reset", async () => {
  const workspaceWithSavedCameraPassword = {
    ...sampleWorkspace,
    passwordRecords: [
      {
        id: "password-camera-41",
        jobId: "job-sample",
        cameraListId: "list-sample",
        cameraId: "camera-41",
        url: "http://192.168.1.01",
        username: "admin",
        password: "secret"
      }
    ]
  };
  window.ditbrowse.loadWorkspace = vi.fn(async () => workspaceWithSavedCameraPassword);
  window.ditbrowse.resetCameraSessionData = vi.fn(async () => undefined);
  render(<App />);
  await screen.findByDisplayValue("http://192.168.1.01");

  const webview = document.querySelector(
    'webview[data-tile-id="tile-41"]'
  ) as Electron.WebviewTag;
  webview.stop = vi.fn();
  webview.executeJavaScript = vi.fn(async () => undefined);
  webview.loadURL = vi.fn(async () => undefined);

  fireEvent.click(screen.getByLabelText("Workspace tools"));
  fireEvent.click(screen.getByRole("button", { name: "Clear camera data" }));
  await waitFor(() =>
    expect(webview.loadURL).toHaveBeenCalledWith("http://192.168.1.01/")
  );

  act(() =>
    httpAuthRequestHandler?.({
      requestId: "auth-after-reset",
      url: "http://192.168.1.01/",
      host: "192.168.1.01",
      port: 80
    })
  );

  expect(await screen.findByRole("dialog", { name: "Camera sign in" })).toBeVisible();
  expect(screen.getByLabelText("Username")).toHaveValue("admin");
  expect(screen.getByLabelText("Password")).toHaveValue("secret");
  expect(window.ditbrowse.sendHttpAuthResponse).not.toHaveBeenCalledWith(
    "auth-after-reset",
    expect.anything()
  );
});
```

Add a list-reset test that clicks **Clear list data**, asserts the shared confirmation copy, clicks **Clear and reload**, and verifies `resetListSessionData` plus both webview base loads. Add an error test where `resetCameraSessionData` rejects and `loadURL` is not called. Replace old `Clear Tile Cookies` and `Clear List Cookies` assertions with the new labels.

- [ ] **Step 8: Run focused tests**

Run: `npm test -- src/renderer/sessionReset.test.ts src/renderer/App.test.tsx src/renderer/components/BrowserChrome.test.tsx`  
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/sessionReset.ts src/renderer/sessionReset.test.ts src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/components/CookieCommands.tsx src/renderer/components/BrowserToolsMenu.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/BrowserChrome.test.tsx
git commit -m "feat: reset camera sessions from base addresses"
```

---

### Task 6: Modernize Tabs And The Browser Command Strip

**Files:**
- Modify: `src/renderer/components/BrowserToolbar.tsx`
- Modify: `src/renderer/components/AddressBar.tsx`
- Modify: `src/renderer/components/GridControls.tsx`
- Modify: `src/renderer/components/TabStrip.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/BrowserToolsMenu.tsx`
- Modify: `src/renderer/components/BrowserChrome.test.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/toolbarLayout.test.ts`
- Modify: `tests/e2e/workspace.spec.ts`

**Interfaces:**
- Consumes Task 4 Button/IconButton/Tooltip.
- Preserves all existing browser callbacks and aria labels unless this plan explicitly renames a cookie reset action.

- [ ] **Step 1: Strengthen behavior and layout tests before CSS changes**

Update `toolbarLayout.test.ts` to assert the approved tokens, stable control dimensions, and responsive priorities rather than the old `overflow-x: auto` implementation detail:

```ts
expect(styles).toContain("--surface: #1d1d1f;");
expect(styles).toContain("--radius-control: 10px;");
expect(styles).toContain("minmax(220px, 1fr)");
expect(styles).toContain("@media (max-width: 1180px)");
expect(styles).not.toContain("border-radius: 999px");
```

Add component assertions that Reload exposes title, description, and `⌘R`, Workspace tools has a useful description, and no migrated button has a native `title` attribute.

- [ ] **Step 2: Run browser chrome tests and verify the visual-contract failures**

Run: `npm test -- src/renderer/components/BrowserChrome.test.tsx src/renderer/toolbarLayout.test.ts`  
Expected: FAIL on missing modern token/layout and tooltip assertions.

- [ ] **Step 3: Migrate browser controls to the new primitives**

- Use `IconButton variant="ghost"` for Back, Forward, Reload, Reload all, focus/grid, add tab, tab move/close, Save current URL, address submit, and open-new-tile.
- Use `Button variant="subtle"` for Columns, Zoom, Viewport, and `All` triggers.
- Keep Lucide icons; remove manually styled text glyphs.
- Remove `title` and `data-tooltip` attributes from migrated components.
- Keep current `aria-label` values so keyboard and automation behavior remains stable.

Tooltip descriptions must be action-specific. Required examples:

```ts
{
  title: "Reload camera",
  description: "Loads the selected tile again from its base address.",
  shortcut: "⌘R"
}
{
  title: "Focus selected page",
  description: "Shows only the selected camera without reloading any pages."
}
{
  title: "Save current URL",
  description: "Stores this live address in the selected camera row."
}
```

- [ ] **Step 4: Apply the approved Codex-inspired chrome CSS**

Implement:

- 48px tab row and 48-56px command strip without changing their order.
- Near-black chrome, soft selected-tab fill, 10px tab/control radii, and no persistent outline around ordinary buttons.
- 34px icon controls and 36px text/value controls.
- Address field using `minmax(220px, 1fr)` and soft surface fill.
- Selected tile using the single focus color.
- Hover-only tab close emphasis without changing tab width.
- `@media (max-width: 1180px)` that hides low-priority selected-tile status text and compacts labels while preserving values.
- Add **Reload every camera** to `BrowserToolsMenu` through the existing `onReloadAll` callback, then use `@media (max-width: 1020px)` to hide only the duplicate toolbar icon. Navigation, address, focus, columns, zoom, and viewport remain reachable.

Do not use viewport-width font scaling. Keep letter spacing at zero.

- [ ] **Step 5: Add real browser width checks**

Extend `tests/e2e/workspace.spec.ts`:

```ts
for (const width of [960, 1180, 1440]) {
  await page.setViewportSize({ width, height: 800 });
  const toolbar = page.getByLabel("Browser toolbar");
  const box = await toolbar.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  await expect(page.getByRole("textbox", { name: "Address" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
}
```

- [ ] **Step 6: Run focused and browser tests**

Run: `npm test -- src/renderer/components/BrowserChrome.test.tsx src/renderer/toolbarLayout.test.ts`  
Expected: PASS.  
Run: `npm run test:e2e -- --grep "workspace shows|toolbar stays"`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/BrowserToolbar.tsx src/renderer/components/AddressBar.tsx src/renderer/components/GridControls.tsx src/renderer/components/TabStrip.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/styles.css src/renderer/toolbarLayout.test.ts tests/e2e/workspace.spec.ts
git commit -m "feat: modernize browser chrome"
```

---

### Task 7: Apply The Visual System To Tools, Editor, Authentication, And States

**Files:**
- Modify: `src/renderer/components/BrowserToolsMenu.tsx`
- Modify: `src/renderer/components/JobListSelector.tsx`
- Modify: `src/renderer/components/CookieCommands.tsx`
- Modify: `src/renderer/components/CameraListEditor.tsx`
- Modify: `src/renderer/components/CameraListEditor.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/components/WebviewTile.tsx`
- Modify: `src/renderer/components/WebviewTile.test.tsx`
- Modify: `src/renderer/styles.css`
- Delete: `src/renderer/components/ui/PillButton.tsx`

**Interfaces:**
- Consumes Task 4 UI primitives and Task 5 reset states.
- Preserves existing editor keyboard navigation, camera metadata editing, password visibility, API port behavior, and webview loading behavior.

- [ ] **Step 1: Add whole-app visual and interaction assertions**

Extend tests with these concrete assertions:

```ts
it("uses the shared confirmation dialog for job deletion", () => {
  const confirm = vi.spyOn(window, "confirm");
  render(<BrowserChrome {...baseProps} />);
  fireEvent.click(screen.getByLabelText("Workspace tools"));
  fireEvent.click(screen.getByRole("button", { name: "Delete Job" }));

  expect(screen.getByRole("dialog", { name: "Delete job" })).toBeVisible();
  expect(confirm).not.toHaveBeenCalled();
});

it("uses modern dialog actions for camera sign in", async () => {
  render(<App />);
  act(() =>
    httpAuthRequestHandler?.({
      requestId: "auth-modern",
      url: "http://192.168.1.01/",
      host: "192.168.1.01",
      port: 80
    })
  );

  expect(await screen.findByRole("dialog", { name: "Camera sign in" })).toHaveClass(
    "dialog-surface"
  );
  expect(screen.getByRole("button", { name: "Sign In" })).toHaveClass("button-primary");
});
```

Keep the existing CameraListEditor Enter/Tab tests unchanged as regression coverage. Update the WebviewTile blank-page assertion to expect `background:#080809`, assert the Retry button remains accessible after a main-frame load failure, and add `expect(document.querySelector(".pill-button")).not.toBeInTheDocument()` to workspace-tools coverage.

Run: `npm test -- src/renderer/App.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/components/WebviewTile.test.tsx`  
Expected: FAIL on legacy classes, native confirmation, and old blank-page color.

- [ ] **Step 2: Migrate workspace tools and job/list actions**

- Replace every `PillButton` and raw command button with `Button` variants.
- Use flat menu rows for Edit camera list, Reload every camera, Reset scaling, Reset order, session reset, and password actions.
- Keep ordinary forms in one unframed section separated by quiet dividers; do not put cards inside the popover.
- Replace `window.confirm` for Delete job with shared Dialog using **Cancel** and danger **Delete job**.
- Keep password values visible as requested; style them as data text, not disabled inputs.

- [ ] **Step 3: Migrate camera-list editor**

- Retain the existing full-window overlay and table column order.
- Use a sticky 48px header, soft filled inputs, borderless icon row actions, and primary **Save changes** plus subtle **Discard**.
- Keep **Add camera** and editable camera count in the top toolbar.
- Preserve Enter-down, Tab-across, row selection, drag ordering, sequential camera numbers, and delete-row behavior.
- Use shared Dialog for discard confirmation when the draft is dirty.

- [ ] **Step 4: Migrate authentication and saved suggestions**

- Render the current auth prompt inside shared Dialog.
- Keep separate clickable username and visible-password suggestions.
- Prefilled post-reset values remain editable and are not submitted until **Sign in**.
- Use subtle suggestion buttons, plain labeled fields, **Cancel**, and primary **Sign in**.
- Keep `Save for this camera` as a checkbox, not a pill or text button.

- [ ] **Step 5: Migrate loading, empty, and error surfaces**

- Change the encoded blank page background to `#080809`.
- Restyle tile headers and errors with the approved surfaces and focus color.
- Keep page content centered and preserve all webview dimensions/transforms.
- Display reset notices above the grid without covering toolbar controls or changing grid row sizing.

- [ ] **Step 6: Remove legacy button implementation and CSS**

Delete `PillButton.tsx`, remove all imports, and remove `.pill-button*`, old CSS pseudo-element tooltip rules, and obsolete one-off button styles. Verify:

Run: `rg -n "PillButton|pill-button|data-tooltip|title=\"" src/renderer`  
Expected: no legacy PillButton or data-tooltip matches; remaining `title` matches are only non-tooltip semantic content that cannot use the shared control.

- [ ] **Step 7: Run focused and full tests**

Run: `npm test -- src/renderer/App.test.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/components/WebviewTile.test.tsx`  
Expected: PASS.  
Run: `npm run test`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git commit -m "feat: refresh the complete app UI"
```

---

### Task 8: Electron Integration, Screenshot QA, Packaging, And Release Verification

**Files:**
- Modify: `tests/e2e/mock-camera-server.ts`
- Create: `tests/electron/session-reset.spec.ts`
- Create: `playwright.electron.config.ts`
- Modify: `package.json`
- Modify: `docs/verification.md`

**Interfaces:**
- Consumes the completed reset bridge and UI.
- Produces repeatable packaged-app verification for cookie, sessionStorage, HTTP auth, redirect, and multi-prompt behavior.

- [ ] **Step 1: Extend the mock camera server**

Add configurable behavior and request records:

```ts
export interface MockCameraRequest {
  url: string;
  cookie: string;
  authorization: string;
}

export interface MockCameraOptions {
  landingPath: "/rmt.html" | "/index.html";
  requireBasicAuth?: boolean;
  username?: string;
  password?: string;
}
```

At `/`, record headers, return `401` with `WWW-Authenticate: Basic realm="DITBrowse test"` when credentials are absent/wrong, otherwise set `camera-session=active` and redirect to `landingPath`. The landing page must set `localStorage`, `sessionStorage`, and an IndexedDB value and render `Mock Camera GUI`.

- [ ] **Step 2: Add a packaged Electron smoke test**

Create `tests/electron/session-reset.spec.ts` using Playwright `_electron`:

```ts
import { _electron as electron, expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("camera reset clears auth and reloads the base redirect", async () => {
  const camera = await startMockCameraServer({
    landingPath: "/rmt.html",
    requireBasicAuth: true,
    username: "admin",
    password: "secret"
  });
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "ditbrowse-e2e-"));
  const app = await electron.launch({
    args: [path.resolve("."), `--user-data-dir=${userDataPath}`],
    env: { ...process.env, DITBROWSE_E2E_CAMERA_URL: camera.url }
  });

  try {
    const window = await app.firstWindow();
    await window.getByRole("dialog", { name: "Camera sign in" }).waitFor();
    await window.getByLabel("Username").fill("admin");
    await window.getByLabel("Password").fill("secret");
    await window.getByRole("button", { name: "Sign in" }).click();

    await window.getByLabel("Workspace tools").click();
    await window.getByRole("button", { name: "Clear camera data" }).click();

    await expect(window.getByRole("dialog", { name: "Camera sign in" })).toBeVisible();
    await expect(window.getByLabel("Username")).toHaveValue("admin");
    await expect(window.getByLabel("Password")).toHaveValue("secret");
    expect(camera.requests.filter((request) => request.url === "/").length).toBeGreaterThan(1);
  } finally {
    await app.close();
    await camera.close();
    await fs.rm(userDataPath, { recursive: true, force: true });
  }
});
```

In `main.ts`, add this exact test-only workspace projection and use it only in the `workspace:load` handler:

```ts
function workspaceForE2E(workspace: WorkspaceState, cameraUrl: string): WorkspaceState {
  const job = workspace.jobs[0];
  const list = workspace.cameraLists.find((candidate) => candidate.jobId === job.id)!;
  const camera = list.cameras[0];
  const tile = workspace.tiles[0];
  const partition = `persist:ditbrowse-${job.id}-${list.id}`;

  return {
    ...workspace,
    jobs: [{ ...job, listIds: [list.id] }],
    cameraLists: [
      {
        ...list,
        defaultPrefix: "",
        cameras: [{ ...camera, url: cameraUrl, usesListPrefix: false }]
      }
    ],
    tiles: [
      {
        ...tile,
        cameraId: camera.id,
        url: cameraUrl,
        title: "Camera 01",
        partition
      }
    ],
    selectedTileId: tile.id,
    activeJobId: job.id,
    activeCameraListId: list.id
  };
}

ipcMain.handle("workspace:load", async () => {
  const workspace = await storage.loadWorkspace();
  const cameraUrl = process.env.DITBROWSE_E2E_CAMERA_URL?.trim();
  return cameraUrl ? workspaceForE2E(workspace, cameraUrl) : workspace;
});
```

The smoke test's isolated `--user-data-dir` ensures the projected workspace and debounced saves cannot touch the user's real DITBrowse data.

- [ ] **Step 3: Add scripts and Electron config**

Add:

```json
"test:electron": "npm run build && playwright test -c playwright.electron.config.ts"
```

The Electron config uses `tests/electron`, one worker, no browser web server, trace on first retry, and a 120-second timeout.

- [ ] **Step 4: Run all automated verification**

Run: `npm run typecheck`  
Expected: PASS.  
Run: `npm run test`  
Expected: PASS.  
Run: `npm run test:e2e`  
Expected: PASS.  
Run: `npm run test:electron`  
Expected: PASS.

- [ ] **Step 5: Build and launch a fresh macOS app**

Run: `npm run package:mac`  
Expected: `release/DITBrowse-darwin-arm64/DITBrowse.app` exists.  
Quit any running release copy, open the newly packaged app, and verify the main process, GPU helper, network service, renderer, and camera guest processes remain running for at least 10 seconds.

- [ ] **Step 6: Perform screenshot QA at representative sizes**

Capture and inspect the running app at 960x640, 1180x800, and 1440x900. Verify:

- No command runs off the right edge.
- The address field remains usable.
- Tooltips stay inside the window and do not shift controls.
- Tabs, tools, editor, sign-in, confirmation, status, empty, and error states match the approved Codex-inspired direction.
- Tile text fits and camera pages remain centered.
- No webview is blank because it was accidentally unmounted or covered.

Record the completed checks in `docs/verification.md` using dated concise entries and exact build/test commands.

- [ ] **Step 7: Commit verification support**

```bash
git add tests/e2e/mock-camera-server.ts tests/electron/session-reset.spec.ts playwright.electron.config.ts package.json docs/verification.md src/electron/main.ts
git commit -m "test: verify camera session resets"
```

- [ ] **Step 8: Final repository check**

Run: `git status --short`  
Expected: only pre-existing unrelated files, such as the user's untracked `.DS_Store`, remain.  
Run: `git log --oneline -8`  
Expected: the task commits appear in implementation order with no unrelated files included.
