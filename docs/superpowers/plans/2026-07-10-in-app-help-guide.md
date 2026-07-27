# In-App Help Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bundled, full-page, wiki-style Help tab to DITBrowse with accurate annotated stills covering camera setup and password workflows.

**Architecture:** Keep Help as transient renderer state so it never enters the saved workspace or Companion protocol. Render typed, data-only guide content through a focused React page, and generate its annotated PNG assets from the real application DOM with Playwright plus an injected SVG annotation layer. Package all content through Vite so Help works offline.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest, Testing Library, Playwright, Electron 42, CSS, SVG annotations.

## Global Constraints

- Do not create, enable, or publish a GitHub Wiki.
- Help opens as a full-page tab inside DITBrowse; it does not open GitHub, the system browser, a dialog, or a separate window.
- Help content and image assets must work offline.
- Guide scope is camera setup, passwords and sign-in, and related troubleshooting.
- Stills must be captured from current DITBrowse components, not reconstructed mockups.
- Use documentation-only addresses from `192.0.2.0/24`, neutral names, and no real usernames or passwords.
- Add clear arrowheads and numbered markers; use neutral white/gray, reserve red for destructive actions, and introduce no blue annotation accents.
- Preserve an unmodified source capture for every annotated still.
- Camera numbers are positive integers in the guide; the displayed identity is the normal integer while prefix-derived network suffixes are normalized to two digits.
- Opening, navigating, and closing Help must not mutate the workspace, selected camera, credentials, focus/expansion mode, or Companion status.
- Do not sign or notarize this build. Always replace `/Applications/DITBrowse.app` after successful verification, preserving a timestamped backup first.

---

## File structure

- Create `src/renderer/help/helpContent.ts`: typed, data-only guide sections and callout copy.
- Create `src/renderer/help/HelpGuide.tsx`: native full-page guide renderer and section navigation.
- Create `src/renderer/help/HelpGuide.test.tsx`: guide structure, navigation, and image-accessibility tests.
- Create `src/renderer/help/assets/*.png`: six annotated stills bundled by Vite.
- Create `docs/help/source-stills/*.png`: six matching unmodified source captures retained for visual auditing.
- Create `tests/e2e/help-stills.spec.ts`: sanitized real-UI capture workflow and SVG annotations.
- Modify `src/renderer/components/TabStrip.tsx`: support one generic transient auxiliary tab without putting it in `WorkspaceState`.
- Modify `src/renderer/components/TabStrip.test.tsx`: auxiliary-tab selection, active state, and closing behavior.
- Modify `src/renderer/components/BrowserChrome.tsx`: expose Help entry point and suppress camera-only toolbar while Help is selected.
- Modify `src/renderer/components/BrowserChrome.test.tsx`: Help-button and Help-tab behavior.
- Modify `src/renderer/App.tsx`: own transient Help state and switch the main content between `TileGrid` and `HelpGuide`.
- Modify `src/renderer/App.test.tsx`: verify Help does not modify workspace or published Companion state.
- Modify `src/renderer/styles.css`: full-page documentation layout, auxiliary tab, responsive navigation, figures, and callout captions.
- Modify `tests/e2e/workspace.spec.ts`: browser-level Help workflow, dimensions, and return-to-camera assertions.
- Modify `package.json`: add a deterministic `capture:help-stills` command.

---

### Task 1: Native help content and wiki-style page

**Files:**
- Create: `src/renderer/help/helpContent.ts`
- Create: `src/renderer/help/HelpGuide.tsx`
- Create: `src/renderer/help/HelpGuide.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces: `HelpSection`, `HelpTroubleshootingItem`, `helpSections`, and `HelpGuide(): ReactElement`.
- Consumes: existing typography, surface, line, danger, and focus CSS variables from `styles.css`.

- [x] **Step 1: Write the failing component tests**

Create `src/renderer/help/HelpGuide.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpGuide } from "./HelpGuide";

describe("HelpGuide", () => {
  it("renders the complete camera setup and password guide", () => {
    render(<HelpGuide />);

    expect(screen.getByRole("heading", { name: "DITBrowse Help Guide", level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Quick Start" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Camera Setup" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Passwords and Sign-In" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Troubleshooting" })).toBeVisible();
    expect(screen.getByText(/positive whole number/i)).toBeVisible();
    expect(screen.getByText(/Sign out, forget login & reload selected/)).toBeVisible();
  });

  it("uses local section links without opening another page", () => {
    render(<HelpGuide />);
    const cameraSetup = screen.getByRole("link", { name: "Camera Setup" });
    expect(cameraSetup).toHaveAttribute("href", "#help-camera-setup");
    fireEvent.click(cameraSetup);
    expect(screen.getByRole("heading", { name: "Camera Setup" })).toBeVisible();
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/renderer/help/HelpGuide.test.tsx`

Expected: FAIL because `./HelpGuide` does not exist.

- [x] **Step 3: Define the complete data-only guide content**

Create `src/renderer/help/helpContent.ts` with these exact public types and section IDs:

```ts
export interface HelpTroubleshootingItem {
  symptom: string;
  cause: string;
  action: string;
}

export interface HelpSection {
  id: "quick-start" | "camera-setup" | "passwords" | "troubleshooting";
  title: string;
  introduction: string;
  steps?: string[];
  notes?: string[];
  troubleshooting?: HelpTroubleshootingItem[];
}

export const helpSections: HelpSection[] = [
  {
    id: "quick-start",
    title: "Quick Start",
    introduction:
      "Set up the camera list first, then save a reusable login or sign in to each camera when prompted.",
    steps: [
      "Open Camera List from the top-right of the main tab row.",
      "Select or create the job and camera list for the current setup.",
      "Set the shared URL prefix, add camera rows, and verify every resolved Full URL.",
      "Save the camera list and confirm each camera number appears centered in its tile header.",
      "Add a password preset or use the sign-in prompt when a camera requests credentials."
    ]
  },
  {
    id: "camera-setup",
    title: "Camera Setup",
    introduction:
      "A camera number is a positive whole number such as 1, 2, or 12. DITBrowse uses that number as the camera identity.",
    steps: [
      "Open Camera List and choose the correct job and camera list.",
      "Enter the shared URL prefix used by cameras in this list.",
      "Add the required rows and enter each Camera # as a positive whole number.",
      "Leave Follow Prefix on when the camera uses the shared prefix. DITBrowse derives a two-digit network suffix, so camera 1 resolves with suffix 01 while its displayed number remains 1.",
      "Turn Follow Prefix off and enter Full URL when that camera uses a different address pattern.",
      "Optionally enter Type, Lens, Display Note, Resolution, and Zoom.",
      "Read the resolved Full URL in every row, save, and confirm the numbered tiles appear in the grid."
    ],
    notes: [
      "If a camera opens at the wrong address, correct Camera # or enter a Full URL before changing passwords.",
      "Camera numbers are integers only; do not enter labels, spaces, decimals, or punctuation."
    ]
  },
  {
    id: "passwords",
    title: "Passwords and Sign-In",
    introduction:
      "Password presets are reusable suggestions. A saved camera login is tied to one camera in the active job and camera list.",
    steps: [
      "Open Camera List, scroll to Workspace Settings, and add a Password Preset with username, password, and optional camera type.",
      "When a camera requests credentials, use the matching Use … login & Sign In button to fill both fields and submit once.",
      "Leave Save for this camera checked to reuse that login for this camera in the active job and list.",
      "Use Camera Session > Reload selected or Reload all for a normal non-destructive refresh.",
      "Use Camera Session > Sign out, forget login & reload selected when the saved login is wrong or the camera must request credentials again.",
      "Use Sign out, forget active-list logins & reload all… only when every saved login in the current list should be cleared."
    ],
    notes: [
      "Signing out and forgetting a camera login does not delete the reusable Password Preset.",
      "Saved Camera Passwords in Workspace Settings can remove one stored camera login directly."
    ]
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    introduction: "Start with the address, then check the saved login.",
    troubleshooting: [
      {
        symptom: "The tile is blank.",
        cause: "The camera address is unreachable or resolves to the wrong host.",
        action: "Open Camera List and verify the resolved Full URL, network connection, and camera power."
      },
      {
        symptom: "Camera 1 opens the wrong address.",
        cause: "The shared prefix or derived 01 suffix does not match this network.",
        action: "Correct the prefix, or turn off Follow Prefix and enter that camera's Full URL."
      },
      {
        symptom: "The authentication prompt keeps returning.",
        cause: "The saved camera login is no longer accepted.",
        action: "Use Sign out, forget login & reload selected, then sign in again with the correct credentials."
      },
      {
        symptom: "The expected preset is not recommended.",
        cause: "Its optional camera type does not match the Type value in Camera List.",
        action: "Correct the camera Type or use a preset without a type match."
      }
    ]
  }
];
```

- [x] **Step 4: Implement the native Help page**

Create `src/renderer/help/HelpGuide.tsx` as a semantic `article` with:

```tsx
import type { ReactElement } from "react";
import { helpSections } from "./helpContent";

export function HelpGuide(): ReactElement {
  return (
    <article className="help-guide" aria-label="Help Guide">
      <aside className="help-guide-sidebar" aria-label="Help sections">
        <div className="help-guide-sidebar-title">Contents</div>
        <nav>
          {helpSections.map((section) => (
            <a key={section.id} href={`#help-${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
      </aside>
      <div className="help-guide-scroll">
        <header className="help-guide-hero">
          <div className="eyebrow">HELP</div>
          <h1>DITBrowse Help Guide</h1>
          <p>Camera setup and passwords</p>
        </header>
        {helpSections.map((section) => (
          <section key={section.id} id={`help-${section.id}`} className="help-guide-section">
            <h2>{section.title}</h2>
            <p>{section.introduction}</p>
            {section.steps && (
              <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            )}
            {section.notes && (
              <div className="help-guide-notes">
                {section.notes.map((note) => <p key={note}>{note}</p>)}
              </div>
            )}
            {section.troubleshooting?.map((item) => (
              <article key={item.symptom} className="help-troubleshooting-item">
                <h3>{item.symptom}</h3>
                <p><strong>Likely cause:</strong> {item.cause}</p>
                <p><strong>Fix:</strong> {item.action}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
```

Add CSS that makes `.help-guide` a two-column `minmax(180px, 230px) minmax(0, 1fr)` grid, constrains the reading column to `880px`, uses `overflow-y: auto`, assigns `scroll-margin-top: 24px` to sections, and collapses the sidebar to a horizontal sticky navigation row below `760px`.

- [x] **Step 5: Run component tests and typecheck**

Run: `npx vitest run src/renderer/help/HelpGuide.test.tsx && npm run typecheck`

Expected: both commands PASS.

- [x] **Step 6: Commit**

```bash
git add src/renderer/help/helpContent.ts src/renderer/help/HelpGuide.tsx src/renderer/help/HelpGuide.test.tsx src/renderer/styles.css
git commit -m "feat: add native camera setup help guide"
```

---

### Task 2: Transient Help tab and application integration

**Files:**
- Modify: `src/renderer/components/TabStrip.tsx`
- Modify: `src/renderer/components/TabStrip.test.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/BrowserChrome.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `HelpGuide(): ReactElement` from Task 1.
- Produces: `AuxiliaryTab` and the `BrowserChrome` props `helpSelected`, `onOpenHelp`, and `onCloseHelp`.

- [x] **Step 1: Write failing TabStrip tests for a generic transient tab**

Add tests that pass this exact auxiliary-tab object:

```tsx
const auxiliaryTab = {
  id: "help",
  title: "Help",
  active: true,
  onSelect: vi.fn(),
  onClose: vi.fn()
};
```

Assert that `Tab Help` has class `active`, the previously selected camera tab does not, clicking `Tab Help` calls `onSelect`, and clicking `Close Help` calls `onClose` without invoking camera callbacks.

- [x] **Step 2: Run the TabStrip test and verify it fails**

Run: `npx vitest run src/renderer/components/TabStrip.test.tsx`

Expected: FAIL because `TabStripProps` does not accept `auxiliaryTab`.

- [x] **Step 3: Add the generic auxiliary-tab interface**

In `TabStrip.tsx`, export and consume:

```ts
export interface AuxiliaryTab {
  id: string;
  title: string;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}
```

Add `auxiliaryTab?: AuxiliaryTab` to `TabStripProps`, append it to `.tab-list` using the existing `.tab`, `.tab-select`, `.tab-title`, and `.tab-close` primitives, and calculate camera activity with:

```ts
const cameraTabsActive = !auxiliaryTab?.active;
const active = cameraTabsActive && tile.id === selectedTileId;
```

Use `aria-label="Tab Help"` for the wrapper and `aria-label="Close Help"` for its close button.

- [x] **Step 4: Write failing BrowserChrome and App tests**

Add BrowserChrome assertions that:

```tsx
expect(screen.getByRole("button", { name: "Help" })).toBeVisible();
fireEvent.click(screen.getByRole("button", { name: "Help" }));
expect(onOpenHelp).toHaveBeenCalledOnce();
```

With `helpSelected={true}`, assert `Tab Help` is active and `Browser toolbar` is absent.

In `App.test.tsx`, open Help, assert `Help Guide` appears, and assert all existing `webview` elements remain mounted inside an `aria-hidden="true"` camera workspace so opening Help cannot reload camera sessions. Click the original camera tab and assert the same selected address returns. Capture the last `publishControlApiStatus` call before opening Help and assert no new status is published solely because Help opened or closed.

- [x] **Step 5: Run the integration tests and verify they fail**

Run: `npx vitest run src/renderer/components/TabStrip.test.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/App.test.tsx`

Expected: FAIL because Help props, state, and content switching do not exist.

- [x] **Step 6: Integrate Help as transient renderer state**

Add `const [helpSelected, setHelpSelected] = useState(false);` to `App.tsx`. Pass these exact behaviors:

```tsx
onOpenHelp={() => setHelpSelected(true)}
onCloseHelp={() => setHelpSelected(false)}
onSelectTile={(tileId) => {
  setHelpSelected(false);
  selectTile(tileId);
}}
```

In `BrowserChrome`, add a neutral `CircleHelp` button beside Camera List, pass an auxiliary Help tab only after Help has been opened, and omit `BrowserToolbar` while `helpSelected` is true. Apply `help-selected` to `browser-shell` so its grid has only the 48px tab row.

In the main content area of `App.tsx`, wrap the existing notices and `TileGrid` without changing any of their props, then render Help as a sibling:

```tsx
<div
  className={helpSelected ? "camera-workspace help-hidden" : "camera-workspace"}
  aria-hidden={helpSelected || undefined}
>
  {resetBusy && (
    <StatusNotice tone="progress" message={resetProgressMessage} />
  )}
  {!resetBusy && resetNotice && (
    <StatusNotice
      tone={resetNotice.tone}
      message={resetNotice.message}
      onDismiss={() => setResetNotice(null)}
    />
  )}
  <TileGrid
    tiles={workspace.tiles}
    cameraNumbersById={cameraNumbersById}
    globalZoom={workspace.globalZoom}
    columns={workspace.gridColumns}
    selectedTileId={workspace.selectedTileId}
    focusMode={effectiveFocusMode}
    onSelectTile={selectTile}
    onUrlCommitted={commitTileNavigationUrl}
    onCredentialCaptured={saveCapturedCredential}
    onCredentialRejected={discardTileCredential}
    credentialsByTileId={credentialsByTileId}
    webviewPreloadPath={webviewPreloadPath}
  />
</div>
{helpSelected && <HelpGuide />}
```

Do not dispatch a workspace action, change `selectedTileIdRef`, or call the control API when Help state changes.

- [x] **Step 7: Style the transient Help tab and selected layout**

Add `.help-button` beside `.camera-list-button`, `.help-tab .tab-index` for the neutral Help icon, and:

```css
.browser-shell.help-selected {
  grid-template-rows: 48px;
}

.camera-workspace {
  display: contents;
}

.camera-workspace.help-hidden {
  display: none;
}

.browser-tab-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
```

Ensure the Help button remains visible at 760px and the camera tab strip remains horizontally scrollable.

- [x] **Step 8: Run tests and typecheck**

Run: `npx vitest run src/renderer/components/TabStrip.test.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/App.test.tsx && npm run typecheck`

Expected: all tests PASS and TypeScript reports no errors.

- [x] **Step 9: Commit**

```bash
git add src/renderer/components/TabStrip.tsx src/renderer/components/TabStrip.test.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git commit -m "feat: open help as an in-app tab"
```

---

### Task 3: Browser-level Help behavior and state safety

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`

**Interfaces:**
- Consumes: Help button, transient `Tab Help`, Help Guide, and unchanged camera workspace from Task 2.
- Produces: browser-level regression coverage for sizing and return-to-camera behavior.

- [x] **Step 1: Write the failing Playwright workflow**

Add this test to `tests/e2e/workspace.spec.ts`:

```ts
test("Help opens as a full-page local tab and returns to the selected camera", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const selectedAddress = await page.getByRole("textbox", { name: "Address" }).inputValue();
  await page.getByRole("button", { name: "Help", exact: true }).click();

  await expect(page.getByLabel("Help Guide")).toBeVisible();
  await expect(page.getByLabel("Browser toolbar")).toHaveCount(0);
  await expect(page.getByLabel("Tab Help")).toHaveClass(/active/);
  await expect(page.locator("webview")).toHaveCount(12);
  await expect(page.locator(".camera-workspace")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".camera-workspace")).toBeHidden();
  await expect(page.getByRole("link", { name: "Camera Setup" })).toHaveAttribute(
    "href",
    "#help-camera-setup"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);

  await page.getByLabel("Close Help").click();
  await expect(page.getByLabel("Help Guide")).toHaveCount(0);
  await expect(page.getByLabel("Browser toolbar")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveValue(selectedAddress);
});
```

- [x] **Step 2: Run the browser test and confirm its initial result**

Run: `npx playwright test tests/e2e/workspace.spec.ts --grep "Help opens"`

Expected before Task 2 is merged: FAIL because Help is absent. Expected after Task 2: PASS.

- [x] **Step 3: Add supported-width coverage**

Within the same test, loop through widths `960`, `1180`, and `1440`; at each width assert `.help-guide` has no horizontal overflow and the sidebar/navigation plus `Help Guide` heading remain visible.

- [x] **Step 4: Run the complete renderer E2E suite**

Run: `npm run test:e2e`

Expected: all Playwright tests PASS.

- [x] **Step 5: Commit**

```bash
git add tests/e2e/workspace.spec.ts
git commit -m "test: cover in-app help workflow"
```

---

### Task 4: Real-interface still capture and annotation pipeline

**Files:**
- Create: `tests/e2e/help-stills.spec.ts`
- Create: `docs/help/source-stills/main-workspace.png`
- Create: `docs/help/source-stills/camera-list.png`
- Create: `docs/help/source-stills/camera-row.png`
- Create: `docs/help/source-stills/password-settings.png`
- Create: `docs/help/source-stills/sign-in.png`
- Create: `docs/help/source-stills/camera-session.png`
- Create: `src/renderer/help/assets/main-workspace.png`
- Create: `src/renderer/help/assets/camera-list.png`
- Create: `src/renderer/help/assets/camera-row.png`
- Create: `src/renderer/help/assets/password-settings.png`
- Create: `src/renderer/help/assets/sign-in.png`
- Create: `src/renderer/help/assets/camera-session.png`
- Modify: `package.json`

**Interfaces:**
- Consumes: current real DITBrowse DOM, existing sample workspace types, and Playwright locators.
- Produces: six clean PNGs, six annotated PNGs, and `npm run capture:help-stills`.

- [x] **Step 1: Add a disabled-by-default capture test and package script**

Add this script:

```json
"capture:help-stills": "cross-env DITBROWSE_CAPTURE_HELP=1 playwright test tests/e2e/help-stills.spec.ts --workers=1"
```

Start `help-stills.spec.ts` with:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

test.skip(process.env.DITBROWSE_CAPTURE_HELP !== "1", "manual documentation capture");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cleanDirectory = path.join(root, "docs/help/source-stills");
const annotatedDirectory = path.join(root, "src/renderer/help/assets");
```

- [x] **Step 2: Define a sanitized workspace before React mounts**

Import `sampleWorkspace`, create this fixture in the Playwright process, and pass it to `addInitScript`:

```ts
import { sampleWorkspace } from "../../src/shared/sampleData";
import type { HttpAuthRequest } from "../../src/shared/httpAuth";

const cameras = sampleWorkspace.cameraLists[0].cameras.slice(0, 4).map((camera, index) => {
  const number = index + 1;
  const suffix = String(number);
  const networkSuffix = String(number).padStart(2, "0");
  return {
    ...camera,
    name: suffix,
    suffix,
    url: `http://192.0.2.${networkSuffix}`,
    cameraType: index < 2 ? "Studio Camera" : "",
    lens: index === 0 ? "35mm" : "",
    displayNote: index === 0 ? "Wide" : ""
  };
});
const sanitizedWorkspace = {
  ...sampleWorkspace,
  jobs: [{ id: "job-sample", name: "Example Job", listIds: ["list-sample"] }],
  cameraLists: [{
    ...sampleWorkspace.cameraLists[0],
    name: "Camera List",
    defaultPrefix: "http://192.0.2.",
    cameras
  }],
  tiles: sampleWorkspace.tiles.slice(0, 4).map((tile, index) => ({
    ...tile,
    cameraId: cameras[index].id,
    url: cameras[index].url,
    title: `Camera ${index + 1}`
  })),
  selectedTileId: sampleWorkspace.tiles[0].id,
  credentialPresets: [{
    id: "preset-example",
    username: "operator",
    password: "••••••••",
    cameraType: "Studio Camera"
  }],
  passwordRecords: [{
    id: "password-example",
    jobId: "job-sample",
    cameraListId: "list-sample",
    cameraId: cameras[0].id,
    url: cameras[0].url,
    username: "operator",
    password: "••••••••"
  }]
};

await page.addInitScript(({ workspace }) => {
  let authCallback: ((request: HttpAuthRequest) => void) | null = null;
  Object.defineProperty(window, "__helpAuthCallback", {
    configurable: true,
    get: () => authCallback
  });
  window.ditbrowse = {
    version: "help-capture",
    loadWorkspace: async () => workspace,
    saveWorkspace: async () => undefined,
    publishControlApiStatus: () => undefined,
    onHttpAuthRequest: (callback) => {
      authCallback = callback;
      return () => {
        authCallback = null;
      };
    },
    sendHttpAuthResponse: () => undefined
  } as Window["ditbrowse"];
}, { workspace: sanitizedWorkspace });
```

Declare `__helpAuthCallback` in the test file's `Window` interface and invoke it with `{ requestId: "help-auth", url: "http://192.0.2.01", host: "192.0.2.01", port: 80 }` to open the real sign-in dialog.

- [x] **Step 3: Implement an exact SVG-arrow annotation helper**

Use this public shape:

```ts
interface Annotation {
  number: number;
  target: Locator;
  edge: "top" | "right" | "bottom" | "left";
  destructive?: boolean;
}

async function captureStill(
  page: Page,
  name: string,
  crop: Locator,
  annotations: Annotation[]
): Promise<void>;
```

`captureStill` must:

1. Create both output directories.
2. Screenshot `crop` to the clean source path before injecting anything.
3. Read the crop and target bounding boxes.
4. Inject one fixed, pointer-events-none SVG over the crop with `line` elements, triangular arrowhead markers, and 28px numbered circles.
5. Use `#f1f1f1` strokes and charcoal marker fills for normal callouts; use `#e6817c` only when `destructive` is true.
6. Screenshot the same crop to the annotated asset path.
7. Remove the SVG before moving to the next state.

Calculate the arrow endpoint from the target's requested edge and place the numbered circle 52px away from that endpoint, clamped inside the crop. Set every line's `marker-end` to the matching neutral or destructive arrowhead.

- [x] **Step 4: Capture the six required real interface states**

Use one 1600×1000 viewport and actual accessible locators:

1. `main-workspace`: `.app-shell`; targets `Camera List`, the centered camera number in the first tile header, and `Camera Session`.
2. `camera-list`: `[aria-label="Camera list editor"]`; targets the job/list selector, shared prefix control, and camera table.
3. `camera-row`: the camera-table wrapper; targets `A camera number`, `A follow prefix`, `A full URL`, `A type`, `A lens`, and `A display note`.
4. `password-settings`: `[aria-label="Camera workspace settings"]`; targets Password Presets and Saved Camera Passwords while ensuring password values render masked or as bullet characters.
5. `sign-in`: the real authentication dialog after invoking `window.__helpAuthCallback`; targets the paired `Use saved login · operator & Sign In` action and `Save for this camera`.
6. `camera-session`: crop `.browser-shell` with the real menu open; target both safe reload rows normally and both sign-out rows with `destructive: true`.

Assert every locator is visible before capture. Fail immediately if page text includes any known production address, job name, username, or password used by the installed workspace.

- [x] **Step 5: Run the capture pipeline**

Run: `npm run capture:help-stills`

Expected: one Playwright test PASS; six source PNGs and six annotated PNGs are created at the exact paths above.

- [x] **Step 6: Inspect all twelve images at original resolution**

Open each source/annotated pair. Verify the underlying interface is identical, each arrow terminates at the intended control, numbers are ordered, annotations do not cover labels, red appears only on destructive actions, and no production data appears.

- [x] **Step 7: Commit the deterministic capture workflow and assets**

```bash
git add package.json tests/e2e/help-stills.spec.ts docs/help/source-stills src/renderer/help/assets
git commit -m "docs: add annotated in-app help stills"
```

---

### Task 5: Place annotated stills and callout captions in the guide

**Files:**
- Modify: `src/renderer/help/helpContent.ts`
- Modify: `src/renderer/help/HelpGuide.tsx`
- Modify: `src/renderer/help/HelpGuide.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: six annotated PNG imports from Task 4.
- Produces: `HelpImage` metadata and accessible rendered figures.

- [x] **Step 1: Extend tests for all six annotated figures**

Add assertions that `getAllByRole("img")` has length 6, every image has non-empty alternative text, every figure has a visible caption, callout numbers are unique within each figure, and the Camera Session caption contains both `Reload selected` and `Sign out, forget login & reload selected`.

- [x] **Step 2: Run the HelpGuide test and verify it fails**

Run: `npx vitest run src/renderer/help/HelpGuide.test.tsx`

Expected: FAIL because no figures are rendered.

- [x] **Step 3: Add typed image and callout metadata**

Define:

```ts
export interface HelpCallout {
  number: number;
  text: string;
  destructive?: boolean;
}

export interface HelpImage {
  src: string;
  alt: string;
  caption: string;
  callouts: HelpCallout[];
}
```

Add `images?: HelpImage[]` to `HelpSection`. Import the six PNGs and attach them to the relevant sections. Callout text must use the exact visible labels and number order used by `help-stills.spec.ts`.

- [x] **Step 4: Render accessible figures**

For each image render:

```tsx
<figure className="help-figure">
  <img src={image.src} alt={image.alt} />
  <figcaption>
    <p>{image.caption}</p>
    <ol className="help-callouts">
      {image.callouts.map((callout) => (
        <li key={callout.number} className={callout.destructive ? "destructive" : undefined}>
          <span aria-hidden="true">{callout.number}</span>
          {callout.text}
        </li>
      ))}
    </ol>
  </figcaption>
</figure>
```

Style figures with a maximum width of `960px`, neutral borders, preserved image aspect ratio, and compact caption rows. The list marker must visually match the numbered circle in the annotated PNG.

- [x] **Step 5: Run focused and full verification**

Run: `npx vitest run src/renderer/help/HelpGuide.test.tsx && npm run test && npm run typecheck && npm run test:e2e`

Expected: all commands PASS.

- [x] **Step 6: Commit**

```bash
git add src/renderer/help/helpContent.ts src/renderer/help/HelpGuide.tsx src/renderer/help/HelpGuide.test.tsx src/renderer/styles.css
git commit -m "feat: illustrate the in-app help guide"
```

---

### Task 6: Package, install, and verify the unsigned application

**Files:**
- Generated: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Replace: `/Applications/DITBrowse.app`
- Backup: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`

**Interfaces:**
- Consumes: completed Help implementation and bundled assets from Tasks 1–5.
- Produces: verified unsigned installed application with offline Help.

- [x] **Step 1: Run the complete quality gate**

Run:

```bash
npm run test
npm run typecheck
npm run test:e2e
npm run test:electron
npm run build
```

Expected: every command exits 0.

- [x] **Step 2: Build without signing or notarization**

Run: `npm run package:mac`

Expected: `release/DITBrowse-darwin-arm64/DITBrowse.app` exists. Do not run `package:mac:signed`, `package:mac:notarized`, or `scripts/sign-and-notarize-mac.mjs`.

- [x] **Step 3: Verify Help assets are packaged**

Run:

```bash
find release/DITBrowse-darwin-arm64/DITBrowse.app -path '*dist/assets*' -type f -maxdepth 12
```

Expected: the renderer bundle and six hashed Help PNG assets are present.

- [x] **Step 4: Preserve the installed app and replace it**

Quit the running DITBrowse process. Create `/Users/lightlab/Documents/DITBrowse App Backups` if needed, copy the existing `/Applications/DITBrowse.app` to `DITBrowse-$(date +%Y%m%d-%H%M%S).app`, remove only the old `/Applications/DITBrowse.app`, and copy the new build with `ditto`.

- [x] **Step 5: Launch and inspect the installed build**

Launch `/Applications/DITBrowse.app`, open Help, visit all four sections, inspect every annotated still, close Help, and confirm the previous camera/grid view returns unchanged. Verify the local control endpoint still reports online and that no code-signing or notarization command was run.

- [x] **Step 6: Record final status**

Run: `git status --short --branch`

Expected: no uncommitted implementation files; generated release output remains ignored. Report the installed path, test results, Help behavior, backup path, and explicit unsigned/not-notarized status.
