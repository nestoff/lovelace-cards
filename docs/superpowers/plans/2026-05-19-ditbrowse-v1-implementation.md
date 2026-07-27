# DITBrowse V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable macOS DITBrowse app from the approved v1 design spec.

**Architecture:** Use Electron for the desktop shell, React + TypeScript for the renderer UI, and Chromium `<webview>` tiles for camera pages. Keep browser pages alive while resizing by preserving each webview element, using a stable internal viewport, and applying CSS scale inside equal-size grid cells.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, Testing Library, Playwright, local JSON storage under Electron `userData`.

---

## File Structure

Create this project structure:

```text
/Users/lightlab/DITBrowse/
  package.json
  package-lock.json
  index.html
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  src/
    electron/
      main.ts
      preload.ts
      storage.ts
      session.ts
      windowState.ts
    renderer/
      App.tsx
      main.tsx
      styles.css
      components/
        AddressBar.tsx
        CameraListEditor.tsx
        CookieCommands.tsx
        GridControls.tsx
        TabStrip.tsx
        TileGrid.tsx
        WebviewTile.tsx
      state/
        workspaceReducer.ts
        workspaceStorage.ts
      test/
        setup.ts
    shared/
      csv.ts
      grid.ts
      passwordRecords.ts
      sampleData.ts
      scale.ts
      types.ts
      url.ts
  tests/
    e2e/
      mock-camera-server.ts
      workspace.spec.ts
```

Responsibilities:

- `src/shared/*`: pure app logic with no Electron or React dependency.
- `src/electron/*`: app window, local storage, IPC, session/cookie operations, window state.
- `src/renderer/state/*`: browser workspace reducer and persistence adapter used by React.
- `src/renderer/components/*`: focused UI components for controls, editor, grid, and tiles.
- `tests/e2e/*`: local smoke tests using mock camera pages.

## Task 1: Scaffold Electron, React, TypeScript, And Tests

**Files:**

- Create: `/Users/lightlab/DITBrowse/package.json`
- Create: `/Users/lightlab/DITBrowse/index.html`
- Create: `/Users/lightlab/DITBrowse/tsconfig.json`
- Create: `/Users/lightlab/DITBrowse/tsconfig.node.json`
- Create: `/Users/lightlab/DITBrowse/vite.config.ts`
- Create: `/Users/lightlab/DITBrowse/vitest.config.ts`
- Create: `/Users/lightlab/DITBrowse/src/electron/main.ts`
- Create: `/Users/lightlab/DITBrowse/src/electron/preload.ts`
- Create: `/Users/lightlab/DITBrowse/src/renderer/main.tsx`
- Create: `/Users/lightlab/DITBrowse/src/renderer/App.tsx`
- Create: `/Users/lightlab/DITBrowse/src/renderer/styles.css`
- Create: `/Users/lightlab/DITBrowse/src/renderer/test/setup.ts`

- [ ] **Step 1: Create the package manifest**

Create `/Users/lightlab/DITBrowse/package.json`:

```json
{
  "name": "ditbrowse",
  "version": "0.1.0",
  "private": true,
  "description": "macOS tiled browser for local camera web GUIs",
  "main": "dist-electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "electron:dev": "concurrently -k \"npm:dev\" \"wait-on http://127.0.0.1:5173 && cross-env VITE_DEV_SERVER_URL=http://127.0.0.1:5173 electron .\"",
    "build": "npm run typecheck && vite build && tsc -p tsconfig.node.json",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.node.json --noEmit",
    "lint": "tsc --noEmit && tsc -p tsconfig.node.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "electron": "^35.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^22.13.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitest/ui": "^3.0.0",
    "concurrently": "^9.1.2",
    "cross-env": "^7.0.3",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.1.0",
    "vitest": "^3.0.0",
    "wait-on": "^8.0.2"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config files**

Create `/Users/lightlab/DITBrowse/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/renderer", "src/shared", "tests"]
}
```

Create `/Users/lightlab/DITBrowse/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist-electron",
    "rootDir": "src/electron",
    "types": ["node"]
  },
  "include": ["src/electron/**/*.ts"]
}
```

Create `/Users/lightlab/DITBrowse/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  }
});
```

Create `/Users/lightlab/DITBrowse/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/renderer/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
```

- [ ] **Step 3: Create the first Electron shell**

Create `/Users/lightlab/DITBrowse/src/electron/main.ts`:

```ts
import { BrowserWindow, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = async (): Promise<void> => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "DITBrowse",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), "dist-renderer/index.html"));
};

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
```

Create `/Users/lightlab/DITBrowse/src/electron/preload.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("ditbrowse", {
  version: "0.1.0"
});
```

- [ ] **Step 4: Create the renderer entry and starter UI**

Create `/Users/lightlab/DITBrowse/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DITBrowse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

Create `/Users/lightlab/DITBrowse/src/renderer/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `/Users/lightlab/DITBrowse/src/renderer/App.tsx`:

```tsx
export function App(): JSX.Element {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <strong>DITBrowse</strong>
      </header>
      <section className="empty-start">Tiled camera browser workspace</section>
    </main>
  );
}
```

Create `/Users/lightlab/DITBrowse/src/renderer/styles.css`:

```css
:root {
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #0f1217;
  color: #eef2f6;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border-bottom: 1px solid #252b36;
  background: #151a22;
}

.empty-start {
  display: grid;
  place-items: center;
  color: #a7b1c2;
}
```

Create `/Users/lightlab/DITBrowse/src/renderer/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected:

```text
added ... packages
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Expected:

```text
No type errors
No test files found
vite build completes
tsc -p tsconfig.node.json completes
```

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts src
git commit -m "chore: scaffold electron app"
```

## Task 2: Add Pure Workspace Logic With Tests

**Files:**

- Create: `/Users/lightlab/DITBrowse/src/shared/types.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/url.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/grid.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/scale.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/passwordRecords.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/csv.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/sampleData.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/url.test.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/grid.test.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/scale.test.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/passwordRecords.test.ts`
- Create: `/Users/lightlab/DITBrowse/src/shared/csv.test.ts`

- [ ] **Step 1: Write tests for URL shortcut behavior**

Create `/Users/lightlab/DITBrowse/src/shared/url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveCameraAddress } from "./url";

describe("resolveCameraAddress", () => {
  it("keeps full http URLs unchanged", () => {
    expect(resolveCameraAddress("http://192.168.1.", "http://10.0.0.12")).toBe(
      "http://10.0.0.12"
    );
  });

  it("keeps full https URLs unchanged", () => {
    expect(resolveCameraAddress("http://192.168.1.", "https://camera.local")).toBe(
      "https://camera.local"
    );
  });

  it("appends shortcuts to the list prefix", () => {
    expect(resolveCameraAddress("http://192.168.1.", "42")).toBe("http://192.168.1.42");
  });

  it("trims spaces before resolving", () => {
    expect(resolveCameraAddress("http://192.168.1.", "  42  ")).toBe(
      "http://192.168.1.42"
    );
  });
});
```

- [ ] **Step 2: Implement URL shortcut logic**

Create `/Users/lightlab/DITBrowse/src/shared/url.ts`:

```ts
const FULL_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export function resolveCameraAddress(prefix: string, input: string): string {
  const trimmed = input.trim();
  if (FULL_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return `${prefix}${trimmed}`;
}
```

- [ ] **Step 3: Write grid-order tests**

Create `/Users/lightlab/DITBrowse/src/shared/grid.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildGridSlots } from "./grid";

describe("buildGridSlots", () => {
  it("fills row-major order and leaves empty slots", () => {
    const slots = buildGridSlots(["a", "b", "c", "d", "e", "f", "g"], 4);

    expect(slots).toEqual([
      { index: 0, row: 0, column: 0, tileId: "a" },
      { index: 1, row: 0, column: 1, tileId: "b" },
      { index: 2, row: 0, column: 2, tileId: "c" },
      { index: 3, row: 0, column: 3, tileId: "d" },
      { index: 4, row: 1, column: 0, tileId: "e" },
      { index: 5, row: 1, column: 1, tileId: "f" },
      { index: 6, row: 1, column: 2, tileId: "g" },
      { index: 7, row: 1, column: 3, tileId: null }
    ]);
  });

  it("uses one row for fewer tiles than columns", () => {
    expect(buildGridSlots(["a", "b"], 4)).toHaveLength(4);
  });

  it("throws for invalid column counts", () => {
    expect(() => buildGridSlots(["a"], 0)).toThrow("Column count must be at least 1");
  });
});
```

- [ ] **Step 4: Implement grid-order logic**

Create `/Users/lightlab/DITBrowse/src/shared/grid.ts`:

```ts
export interface GridSlot {
  index: number;
  row: number;
  column: number;
  tileId: string | null;
}

export function buildGridSlots(tileIds: string[], columns: number): GridSlot[] {
  if (columns < 1) {
    throw new Error("Column count must be at least 1");
  }

  const rowCount = Math.max(1, Math.ceil(tileIds.length / columns));
  const slotCount = rowCount * columns;

  return Array.from({ length: slotCount }, (_, index) => ({
    index,
    row: Math.floor(index / columns),
    column: index % columns,
    tileId: tileIds[index] ?? null
  }));
}
```

- [ ] **Step 5: Write scale tests**

Create `/Users/lightlab/DITBrowse/src/shared/scale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeFitScale } from "./scale";

describe("computeFitScale", () => {
  it("fits a stable viewport inside the visible tile", () => {
    expect(
      computeFitScale({
        tileWidth: 640,
        tileHeight: 360,
        viewportWidth: 1280,
        viewportHeight: 720,
        manualZoom: 1
      })
    ).toBe(0.5);
  });

  it("applies manual zoom after fit scale", () => {
    expect(
      computeFitScale({
        tileWidth: 640,
        tileHeight: 360,
        viewportWidth: 1280,
        viewportHeight: 720,
        manualZoom: 1.25
      })
    ).toBe(0.625);
  });

  it("throws on invalid dimensions", () => {
    expect(() =>
      computeFitScale({
        tileWidth: 0,
        tileHeight: 360,
        viewportWidth: 1280,
        viewportHeight: 720,
        manualZoom: 1
      })
    ).toThrow("Tile and viewport dimensions must be positive");
  });
});
```

- [ ] **Step 6: Implement scale logic**

Create `/Users/lightlab/DITBrowse/src/shared/scale.ts`:

```ts
export interface FitScaleInput {
  tileWidth: number;
  tileHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  manualZoom: number;
}

export function computeFitScale(input: FitScaleInput): number {
  const { tileWidth, tileHeight, viewportWidth, viewportHeight, manualZoom } = input;

  if (tileWidth <= 0 || tileHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    throw new Error("Tile and viewport dimensions must be positive");
  }

  const fitScale = Math.min(tileWidth / viewportWidth, tileHeight / viewportHeight);
  return Number((fitScale * manualZoom).toFixed(4));
}
```

- [ ] **Step 7: Add shared types and password lookup tests**

Create `/Users/lightlab/DITBrowse/src/shared/types.ts`:

```ts
export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraEntry {
  id: string;
  name: string;
  url: string;
  suffix: string;
  prefixOverride: string;
  username: string;
  password: string;
  notes: string;
  viewportOverride: ViewportSize | null;
  zoomOverride: number | null;
}

export interface CameraList {
  id: string;
  jobId: string;
  name: string;
  defaultPrefix: string;
  cameras: CameraEntry[];
}

export interface Job {
  id: string;
  name: string;
  listIds: string[];
}

export interface TileState {
  id: string;
  cameraId: string | null;
  url: string;
  title: string;
  partition: string;
  viewport: ViewportSize;
  zoom: number;
}

export interface PasswordRecord {
  id: string;
  jobId: string;
  cameraListId: string;
  url: string;
  username: string;
  password: string;
}

export interface WorkspaceState {
  jobs: Job[];
  cameraLists: CameraList[];
  passwordRecords: PasswordRecord[];
  tiles: TileState[];
  selectedTileId: string | null;
  activeJobId: string | null;
  activeCameraListId: string | null;
  gridColumns: number;
  defaultViewport: ViewportSize;
  defaultZoom: number;
}
```

Create `/Users/lightlab/DITBrowse/src/shared/passwordRecords.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findPasswordRecord } from "./passwordRecords";
import type { PasswordRecord } from "./types";

const records: PasswordRecord[] = [
  {
    id: "p1",
    jobId: "job-a",
    cameraListId: "list-a",
    url: "http://192.168.1.42",
    username: "admin",
    password: "alpha"
  },
  {
    id: "p2",
    jobId: "job-b",
    cameraListId: "list-b",
    url: "http://192.168.1.42",
    username: "admin",
    password: "beta"
  }
];

describe("findPasswordRecord", () => {
  it("scopes identical camera URLs by job and list", () => {
    expect(
      findPasswordRecord(records, {
        jobId: "job-b",
        cameraListId: "list-b",
        url: "http://192.168.1.42",
        username: "admin"
      })
    )?.password.toBe("beta");
  });

  it("returns null when the job/list scope does not match", () => {
    expect(
      findPasswordRecord(records, {
        jobId: "job-a",
        cameraListId: "list-b",
        url: "http://192.168.1.42",
        username: "admin"
      })
    ).toBeNull();
  });
});
```

- [ ] **Step 8: Implement password lookup**

Create `/Users/lightlab/DITBrowse/src/shared/passwordRecords.ts`:

```ts
import type { PasswordRecord } from "./types";

export interface PasswordLookup {
  jobId: string;
  cameraListId: string;
  url: string;
  username: string;
}

export function findPasswordRecord(
  records: PasswordRecord[],
  lookup: PasswordLookup
): PasswordRecord | null {
  return (
    records.find(
      (record) =>
        record.jobId === lookup.jobId &&
        record.cameraListId === lookup.cameraListId &&
        record.url === lookup.url &&
        record.username === lookup.username
    ) ?? null
  );
}
```

- [ ] **Step 9: Write CSV import tests**

Create `/Users/lightlab/DITBrowse/src/shared/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCameraCsv } from "./csv";

describe("parseCameraCsv", () => {
  it("parses camera rows and keeps full URL over suffix", () => {
    const result = parseCameraCsv(
      "name,url,suffix,username,password,notes\nA,http://10.0.0.2,42,admin,pass,main"
    );

    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        name: "A",
        url: "http://10.0.0.2",
        suffix: "42",
        username: "admin",
        password: "pass",
        notes: "main"
      }
    ]);
    expect(result.errors).toEqual([]);
  });

  it("reports rows with neither URL nor suffix", () => {
    const result = parseCameraCsv("name,url,suffix,username,password,notes\nA,,,,pass,main");
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Row must include url or suffix" }
    ]);
  });
});
```

- [ ] **Step 10: Implement CSV import parser**

Create `/Users/lightlab/DITBrowse/src/shared/csv.ts`:

```ts
export interface CameraCsvRow {
  rowNumber: number;
  name: string;
  url: string;
  suffix: string;
  username: string;
  password: string;
  notes: string;
}

export interface CameraCsvError {
  rowNumber: number;
  message: string;
}

export interface CameraCsvParseResult {
  validRows: CameraCsvRow[];
  errors: CameraCsvError[];
}

const REQUIRED_HEADERS = ["name", "url", "suffix", "username", "password", "notes"];

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCameraCsv(csvText: string): CameraCsvParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { validRows: [], errors: [{ rowNumber: 1, message: "CSV is empty" }] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const missingHeader = REQUIRED_HEADERS.find((header) => !headers.includes(header));
  if (missingHeader) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, message: `Missing required header: ${missingHeader}` }]
    };
  }

  const validRows: CameraCsvRow[] = [];
  const errors: CameraCsvError[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const values = splitCsvLine(lines[lineIndex]);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

    if (!row.url && !row.suffix) {
      errors.push({ rowNumber, message: "Row must include url or suffix" });
      continue;
    }

    validRows.push({
      rowNumber,
      name: row.name || row.url || row.suffix,
      url: row.url,
      suffix: row.suffix,
      username: row.username,
      password: row.password,
      notes: row.notes
    });
  }

  return { validRows, errors };
}
```

- [ ] **Step 11: Add sample data for renderer development**

Create `/Users/lightlab/DITBrowse/src/shared/sampleData.ts`:

```ts
import type { WorkspaceState } from "./types";
import { resolveCameraAddress } from "./url";

const prefix = "http://192.168.1.";

export const sampleWorkspace: WorkspaceState = {
  jobs: [{ id: "job-sample", name: "Sample Job", listIds: ["list-sample"] }],
  cameraLists: [
    {
      id: "list-sample",
      jobId: "job-sample",
      name: "Camera LAN",
      defaultPrefix: prefix,
      cameras: Array.from({ length: 12 }, (_, index) => {
        const suffix = String(41 + index);
        return {
          id: `camera-${suffix}`,
          name: `Camera ${suffix}`,
          url: resolveCameraAddress(prefix, suffix),
          suffix,
          prefixOverride: "",
          username: "admin",
          password: "",
          notes: "",
          viewportOverride: null,
          zoomOverride: null
        };
      })
    }
  ],
  passwordRecords: [],
  tiles: Array.from({ length: 12 }, (_, index) => {
    const suffix = String(41 + index);
    return {
      id: `tile-${suffix}`,
      cameraId: `camera-${suffix}`,
      url: resolveCameraAddress(prefix, suffix),
      title: `Camera ${suffix}`,
      partition: "persist:ditbrowse-job-sample-list-sample",
      viewport: { width: 1280, height: 720 },
      zoom: 1
    };
  }),
  selectedTileId: "tile-41",
  activeJobId: "job-sample",
  activeCameraListId: "list-sample",
  gridColumns: 4,
  defaultViewport: { width: 1280, height: 720 },
  defaultZoom: 1
};
```

- [ ] **Step 12: Run pure logic tests**

Run:

```bash
npm run test -- src/shared
npm run typecheck
```

Expected:

```text
Test Files ... passed
No type errors
```

- [ ] **Step 13: Commit pure logic**

Run:

```bash
git add src/shared
git commit -m "feat: add workspace domain logic"
```

## Task 3: Add Local Persistence And IPC

**Files:**

- Create: `/Users/lightlab/DITBrowse/src/electron/storage.ts`
- Create: `/Users/lightlab/DITBrowse/src/electron/windowState.ts`
- Modify: `/Users/lightlab/DITBrowse/src/electron/main.ts`
- Modify: `/Users/lightlab/DITBrowse/src/electron/preload.ts`
- Create: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceStorage.ts`

- [ ] **Step 1: Implement JSON storage**

Create `/Users/lightlab/DITBrowse/src/electron/storage.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceState } from "../shared/types";
import { sampleWorkspace } from "../shared/sampleData";

export interface AppStorage {
  loadWorkspace(): Promise<WorkspaceState>;
  saveWorkspace(workspace: WorkspaceState): Promise<void>;
}

export function createJsonStorage(userDataPath: string): AppStorage {
  const statePath = path.join(userDataPath, "ditbrowse-workspace.json");

  return {
    async loadWorkspace() {
      try {
        const raw = await fs.readFile(statePath, "utf8");
        return JSON.parse(raw) as WorkspaceState;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return sampleWorkspace;
        }
        throw error;
      }
    },
    async saveWorkspace(workspace) {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, JSON.stringify(workspace, null, 2), "utf8");
    }
  };
}
```

- [ ] **Step 2: Implement window-state storage**

Create `/Users/lightlab/DITBrowse/src/electron/windowState.ts`:

```ts
import type { BrowserWindowConstructorOptions } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export interface SavedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const fallbackState: SavedWindowState = {
  width: 1440,
  height: 900
};

export async function loadWindowState(userDataPath: string): Promise<SavedWindowState> {
  const statePath = path.join(userDataPath, "window-state.json");
  try {
    return JSON.parse(await fs.readFile(statePath, "utf8")) as SavedWindowState;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return fallbackState;
    }
    throw error;
  }
}

export async function saveWindowState(
  userDataPath: string,
  bounds: SavedWindowState
): Promise<void> {
  const statePath = path.join(userDataPath, "window-state.json");
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(bounds, null, 2), "utf8");
}

export function toBrowserWindowOptions(
  saved: SavedWindowState
): Pick<BrowserWindowConstructorOptions, "width" | "height" | "x" | "y"> {
  return saved;
}
```

- [ ] **Step 3: Register workspace IPC**

Modify `/Users/lightlab/DITBrowse/src/electron/main.ts` to create storage, load window state, register IPC, and save bounds on close:

```ts
import { BrowserWindow, app, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJsonStorage } from "./storage";
import { loadWindowState, saveWindowState, toBrowserWindowOptions } from "./windowState";
import type { WorkspaceState } from "../shared/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = async (): Promise<void> => {
  const userDataPath = app.getPath("userData");
  const storage = createJsonStorage(userDataPath);
  const savedWindowState = await loadWindowState(userDataPath);

  ipcMain.handle("workspace:load", () => storage.loadWorkspace());
  ipcMain.handle("workspace:save", (_event, workspace: WorkspaceState) =>
    storage.saveWorkspace(workspace)
  );

  const mainWindow = new BrowserWindow({
    ...toBrowserWindowOptions(savedWindowState),
    minWidth: 960,
    minHeight: 640,
    title: "DITBrowse",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.on("close", () => {
    void saveWindowState(userDataPath, mainWindow.getBounds());
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), "dist-renderer/index.html"));
};

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
```

- [ ] **Step 4: Expose typed preload API**

Replace `/Users/lightlab/DITBrowse/src/electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { WorkspaceState } from "../shared/types";

const api = {
  version: "0.1.0",
  loadWorkspace: () => ipcRenderer.invoke("workspace:load") as Promise<WorkspaceState>,
  saveWorkspace: (workspace: WorkspaceState) =>
    ipcRenderer.invoke("workspace:save", workspace) as Promise<void>
};

contextBridge.exposeInMainWorld("ditbrowse", api);

export type DITBrowseApi = typeof api;
```

Add a global type declaration in `/Users/lightlab/DITBrowse/src/renderer/state/workspaceStorage.ts`:

```ts
import type { WorkspaceState } from "../../shared/types";

declare global {
  interface Window {
    ditbrowse: {
      version: string;
      loadWorkspace: () => Promise<WorkspaceState>;
      saveWorkspace: (workspace: WorkspaceState) => Promise<void>;
    };
  }
}

export async function loadWorkspace(): Promise<WorkspaceState> {
  return window.ditbrowse.loadWorkspace();
}

export async function saveWorkspace(workspace: WorkspaceState): Promise<void> {
  await window.ditbrowse.saveWorkspace(workspace);
}
```

- [ ] **Step 5: Verify persistence build**

Run:

```bash
npm run typecheck
npm run build
```

Expected:

```text
No type errors
Renderer and Electron builds complete
```

- [ ] **Step 6: Commit persistence**

Run:

```bash
git add src/electron src/renderer/state
git commit -m "feat: add workspace persistence"
```

## Task 4: Build Workspace Reducer And Main UI Shell

**Files:**

- Create: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.ts`
- Create: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.test.ts`
- Create: `/Users/lightlab/DITBrowse/src/renderer/components/AddressBar.tsx`
- Create: `/Users/lightlab/DITBrowse/src/renderer/components/GridControls.tsx`
- Create: `/Users/lightlab/DITBrowse/src/renderer/components/TabStrip.tsx`
- Create: `/Users/lightlab/DITBrowse/src/renderer/components/TileGrid.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/App.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/styles.css`

- [ ] **Step 1: Write reducer tests**

Create `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import { workspaceReducer } from "./workspaceReducer";

describe("workspaceReducer", () => {
  it("selects a tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "selectTile",
      tileId: "tile-42"
    });
    expect(state.selectedTileId).toBe("tile-42");
  });

  it("updates grid columns", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "setGridColumns",
      columns: 5
    });
    expect(state.gridColumns).toBe(5);
  });

  it("navigates selected tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "navigateSelectedTile",
      url: "http://192.168.1.80"
    });
    expect(state.tiles.find((tile) => tile.id === sampleWorkspace.selectedTileId)?.url).toBe(
      "http://192.168.1.80"
    );
  });

  it("opens a new tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "openNewTile",
      url: "http://192.168.1.99"
    });
    expect(state.tiles.at(-1)?.url).toBe("http://192.168.1.99");
    expect(state.selectedTileId).toBe(state.tiles.at(-1)?.id);
  });
});
```

- [ ] **Step 2: Implement reducer**

Create `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.ts`:

```ts
import type { WorkspaceState } from "../../shared/types";

export type WorkspaceAction =
  | { type: "selectTile"; tileId: string }
  | { type: "setGridColumns"; columns: number }
  | { type: "navigateSelectedTile"; url: string }
  | { type: "openNewTile"; url: string };

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "selectTile":
      return { ...state, selectedTileId: action.tileId };
    case "setGridColumns":
      return { ...state, gridColumns: Math.max(1, action.columns) };
    case "navigateSelectedTile":
      return {
        ...state,
        tiles: state.tiles.map((tile) =>
          tile.id === state.selectedTileId ? { ...tile, url: action.url } : tile
        )
      };
    case "openNewTile": {
      const id = `tile-${crypto.randomUUID()}`;
      const activeJobId = state.activeJobId ?? "default-job";
      const activeCameraListId = state.activeCameraListId ?? "default-list";
      return {
        ...state,
        selectedTileId: id,
        tiles: [
          ...state.tiles,
          {
            id,
            cameraId: null,
            url: action.url,
            title: action.url,
            partition: `persist:ditbrowse-${activeJobId}-${activeCameraListId}`,
            viewport: state.defaultViewport,
            zoom: state.defaultZoom
          }
        ]
      };
    }
    default:
      return state;
  }
}
```

- [ ] **Step 3: Create UI components**

Create `/Users/lightlab/DITBrowse/src/renderer/components/AddressBar.tsx`:

```tsx
import { FormEvent, useState } from "react";

interface AddressBarProps {
  value: string;
  onNavigate: (input: string, target: "selected" | "new") => void;
}

export function AddressBar({ value, onNavigate }: AddressBarProps): JSX.Element {
  const [draft, setDraft] = useState(value);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onNavigate(draft, "selected");
  }

  return (
    <form className="address-bar" onSubmit={submit}>
      <input
        aria-label="Address"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setDraft(value)}
      />
      <button type="submit">Open</button>
      <button type="button" onClick={() => onNavigate(draft, "new")}>
        New Tile
      </button>
    </form>
  );
}
```

Create `/Users/lightlab/DITBrowse/src/renderer/components/GridControls.tsx`:

```tsx
interface GridControlsProps {
  columns: number;
  onColumnsChange: (columns: number) => void;
}

export function GridControls({ columns, onColumnsChange }: GridControlsProps): JSX.Element {
  return (
    <label className="grid-control">
      Columns
      <select
        value={columns}
        onChange={(event) => onColumnsChange(Number(event.target.value))}
        aria-label="Grid columns"
      >
        {[2, 3, 4, 5, 6].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}
```

Create `/Users/lightlab/DITBrowse/src/renderer/components/TabStrip.tsx`:

```tsx
import type { TileState } from "../../shared/types";

interface TabStripProps {
  tiles: TileState[];
  selectedTileId: string | null;
  onSelectTile: (tileId: string) => void;
  onAddTile: () => void;
}

export function TabStrip({
  tiles,
  selectedTileId,
  onSelectTile,
  onAddTile
}: TabStripProps): JSX.Element {
  return (
    <div className="tab-strip" aria-label="Camera tabs">
      <button className="icon-button" type="button" onClick={onAddTile} aria-label="Add tile">
        +
      </button>
      {tiles.map((tile, index) => (
        <button
          key={tile.id}
          type="button"
          className={tile.id === selectedTileId ? "tab active" : "tab"}
          onClick={() => onSelectTile(tile.id)}
        >
          {index + 1}. {tile.title || tile.url || "Blank"}
        </button>
      ))}
    </div>
  );
}
```

Create `/Users/lightlab/DITBrowse/src/renderer/components/TileGrid.tsx`:

```tsx
import { buildGridSlots } from "../../shared/grid";
import type { TileState } from "../../shared/types";

interface TileGridProps {
  tiles: TileState[];
  columns: number;
  selectedTileId: string | null;
  onSelectTile: (tileId: string) => void;
}

export function TileGrid({
  tiles,
  columns,
  selectedTileId,
  onSelectTile
}: TileGridProps): JSX.Element {
  const slots = buildGridSlots(
    tiles.map((tile) => tile.id),
    columns
  );
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));

  return (
    <section
      className="tile-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {slots.map((slot) => {
        const tile = slot.tileId ? tileById.get(slot.tileId) : null;
        if (!tile) {
          return <div key={slot.index} className="tile-slot empty" />;
        }

        return (
          <button
            key={tile.id}
            type="button"
            className={tile.id === selectedTileId ? "tile-slot selected" : "tile-slot"}
            onClick={() => onSelectTile(tile.id)}
          >
            <span>{tile.title || tile.url || "Blank tile"}</span>
          </button>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 4: Wire the shell**

Replace `/Users/lightlab/DITBrowse/src/renderer/App.tsx`:

```tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import { sampleWorkspace } from "../shared/sampleData";
import { resolveCameraAddress } from "../shared/url";
import { AddressBar } from "./components/AddressBar";
import { GridControls } from "./components/GridControls";
import { TabStrip } from "./components/TabStrip";
import { TileGrid } from "./components/TileGrid";
import { workspaceReducer } from "./state/workspaceReducer";
import { loadWorkspace, saveWorkspace } from "./state/workspaceStorage";

export function App(): JSX.Element {
  const [workspace, dispatch] = useReducer(workspaceReducer, sampleWorkspace);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadWorkspace().then((loadedWorkspace) => {
      if (active) {
        dispatch({ type: "setGridColumns", columns: loadedWorkspace.gridColumns });
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      void saveWorkspace(workspace);
    }
  }, [loaded, workspace]);

  const selectedTile = useMemo(
    () => workspace.tiles.find((tile) => tile.id === workspace.selectedTileId) ?? null,
    [workspace.selectedTileId, workspace.tiles]
  );

  const activeList = workspace.cameraLists.find(
    (list) => list.id === workspace.activeCameraListId
  );

  function navigate(input: string, target: "selected" | "new"): void {
    const url = resolveCameraAddress(activeList?.defaultPrefix ?? "", input);
    dispatch(target === "selected" ? { type: "navigateSelectedTile", url } : { type: "openNewTile", url });
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <button type="button" aria-label="Back">
          Back
        </button>
        <button type="button" aria-label="Forward">
          Forward
        </button>
        <button type="button" aria-label="Reload">
          Reload
        </button>
        <AddressBar value={selectedTile?.url ?? ""} onNavigate={navigate} />
        <GridControls
          columns={workspace.gridColumns}
          onColumnsChange={(columns) => dispatch({ type: "setGridColumns", columns })}
        />
      </header>
      <TabStrip
        tiles={workspace.tiles}
        selectedTileId={workspace.selectedTileId}
        onSelectTile={(tileId) => dispatch({ type: "selectTile", tileId })}
        onAddTile={() => dispatch({ type: "openNewTile", url: "about:blank" })}
      />
      <TileGrid
        tiles={workspace.tiles}
        columns={workspace.gridColumns}
        selectedTileId={workspace.selectedTileId}
        onSelectTile={(tileId) => dispatch({ type: "selectTile", tileId })}
      />
    </main>
  );
}
```

- [ ] **Step 5: Update styles**

Append to `/Users/lightlab/DITBrowse/src/renderer/styles.css`:

```css
.address-bar {
  display: flex;
  flex: 1;
  min-width: 240px;
  gap: 6px;
}

.address-bar input {
  flex: 1;
  min-width: 0;
  border: 1px solid #323a47;
  border-radius: 6px;
  padding: 7px 10px;
  background: #0f1217;
  color: #eef2f6;
}

.top-bar button,
.tab,
.icon-button,
.grid-control select,
.address-bar button {
  border: 1px solid #323a47;
  border-radius: 6px;
  background: #202632;
  color: #eef2f6;
  padding: 7px 10px;
}

.grid-control {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #a7b1c2;
}

.tab-strip {
  display: flex;
  gap: 6px;
  min-height: 40px;
  padding: 6px 8px;
  overflow-x: auto;
  border-bottom: 1px solid #252b36;
  background: #10141b;
}

.tab {
  flex: 0 0 auto;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab.active {
  border-color: #5aa7ff;
  background: #17395f;
}

.tile-grid {
  display: grid;
  gap: 6px;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.tile-slot {
  position: relative;
  min-width: 0;
  min-height: 0;
  border: 1px solid #323a47;
  border-radius: 8px;
  background: #151a22;
  color: #eef2f6;
  overflow: hidden;
}

.tile-slot.selected {
  outline: 2px solid #5aa7ff;
  outline-offset: -2px;
}

.tile-slot.empty {
  border-style: dashed;
  background: #10141b;
}
```

- [ ] **Step 6: Verify UI shell**

Run:

```bash
npm run test -- src/renderer/state
npm run typecheck
npm run build
```

Expected:

```text
Reducer tests pass
No type errors
Build completes
```

- [ ] **Step 7: Commit UI shell**

Run:

```bash
git add src/renderer src/shared
git commit -m "feat: add tiled workspace shell"
```

## Task 5: Replace Tile Labels With Scaled Webview Tiles

**Files:**

- Create: `/Users/lightlab/DITBrowse/src/renderer/components/WebviewTile.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/components/TileGrid.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/styles.css`

- [ ] **Step 1: Create typed webview support**

Create `/Users/lightlab/DITBrowse/src/renderer/components/WebviewTile.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { computeFitScale } from "../../shared/scale";
import type { TileState } from "../../shared/types";

interface WebviewTileProps {
  tile: TileState;
  selected: boolean;
  onSelect: () => void;
}

export function WebviewTile({ tile, selected, onSelect }: WebviewTileProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setBounds({ width: rect.width, height: rect.height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = computeFitScale({
    tileWidth: bounds.width,
    tileHeight: bounds.height,
    viewportWidth: tile.viewport.width,
    viewportHeight: tile.viewport.height,
    manualZoom: tile.zoom
  });

  return (
    <div
      ref={containerRef}
      className={selected ? "tile-slot selected" : "tile-slot"}
      onMouseDown={onSelect}
    >
      <div className="tile-label">{tile.title || tile.url || "Blank"}</div>
      <webview
        className="camera-webview"
        src={tile.url || "about:blank"}
        partition={tile.partition}
        style={{
          width: `${tile.viewport.width}px`,
          height: `${tile.viewport.height}px`,
          transform: `scale(${scale})`
        }}
      />
    </div>
  );
}
```

Add this declaration near the top of `/Users/lightlab/DITBrowse/src/renderer/components/WebviewTile.tsx` if TypeScript does not recognize `webview`:

```ts
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
      };
    }
  }
}
```

- [ ] **Step 2: Use webview tiles in the grid**

Replace the filled-tile branch in `/Users/lightlab/DITBrowse/src/renderer/components/TileGrid.tsx` with:

```tsx
import { WebviewTile } from "./WebviewTile";

// inside the filled slot branch
return (
  <WebviewTile
    key={tile.id}
    tile={tile}
    selected={tile.id === selectedTileId}
    onSelect={() => onSelectTile(tile.id)}
  />
);
```

The full imports in `TileGrid.tsx` should be:

```tsx
import { buildGridSlots } from "../../shared/grid";
import type { TileState } from "../../shared/types";
import { WebviewTile } from "./WebviewTile";
```

- [ ] **Step 3: Add webview scaling CSS**

Append to `/Users/lightlab/DITBrowse/src/renderer/styles.css`:

```css
.camera-webview {
  position: absolute;
  left: 0;
  top: 22px;
  border: 0;
  transform-origin: top left;
  background: white;
}

.tile-label {
  position: absolute;
  z-index: 2;
  left: 6px;
  top: 4px;
  max-width: calc(100% - 12px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 4px;
  padding: 2px 5px;
  background: rgba(15, 18, 23, 0.84);
  color: #eef2f6;
  font-size: 11px;
}
```

- [ ] **Step 4: Verify webview build**

Run:

```bash
npm run typecheck
npm run build
```

Expected:

```text
No JSX webview type errors
Build completes
```

- [ ] **Step 5: Launch the app and manually check no reload on grid changes**

Run:

```bash
npm run electron:dev
```

Expected manual check:

```text
The app opens with multiple camera tiles.
Changing the column selector changes tile size.
Webviews remain mounted and do not navigate to blank pages.
The selected tile outline updates when clicking tiles.
```

- [ ] **Step 6: Commit webview tiles**

Run:

```bash
git add src/renderer/components src/renderer/styles.css
git commit -m "feat: render scaled camera webviews"
```

## Task 6: Add Camera List Editor And CSV Import

**Files:**

- Create: `/Users/lightlab/DITBrowse/src/renderer/components/CameraListEditor.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.ts`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.test.ts`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/App.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/styles.css`

- [ ] **Step 1: Add reducer actions for imported camera rows**

Extend `WorkspaceAction` in `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.ts`:

```ts
import type { CameraCsvRow } from "../../shared/csv";

// add to WorkspaceAction union
| { type: "replaceActiveListFromCsv"; rows: CameraCsvRow[] }
```

Add this reducer branch:

```ts
case "replaceActiveListFromCsv": {
  const activeListId = state.activeCameraListId;
  const activeList = state.cameraLists.find((list) => list.id === activeListId);
  if (!activeList) {
    return state;
  }

  const cameras = action.rows.map((row) => {
    const url = row.url || `${activeList.defaultPrefix}${row.suffix}`;
    return {
      id: `camera-${crypto.randomUUID()}`,
      name: row.name,
      url,
      suffix: row.suffix,
      prefixOverride: "",
      username: row.username,
      password: row.password,
      notes: row.notes,
      viewportOverride: null,
      zoomOverride: null
    };
  });

  const passwordRecords = [
    ...state.passwordRecords.filter((record) => record.cameraListId !== activeList.id),
    ...cameras
      .filter((camera) => camera.username || camera.password)
      .map((camera) => ({
        id: `password-${crypto.randomUUID()}`,
        jobId: activeList.jobId,
        cameraListId: activeList.id,
        url: camera.url,
        username: camera.username,
        password: camera.password
      }))
  ];

  const tiles = cameras.map((camera) => ({
    id: `tile-${crypto.randomUUID()}`,
    cameraId: camera.id,
    url: camera.url,
    title: camera.name,
    partition: `persist:ditbrowse-${activeList.jobId}-${activeList.id}`,
    viewport: camera.viewportOverride ?? state.defaultViewport,
    zoom: camera.zoomOverride ?? state.defaultZoom
  }));

  return {
    ...state,
    cameraLists: state.cameraLists.map((list) =>
      list.id === activeList.id ? { ...list, cameras } : list
    ),
    passwordRecords,
    tiles,
    selectedTileId: tiles[0]?.id ?? null
  };
}
```

- [ ] **Step 2: Add reducer test for CSV replacement**

Append to `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.test.ts`:

```ts
it("replaces the active list and creates tiles from imported rows", () => {
  const state = workspaceReducer(sampleWorkspace, {
    type: "replaceActiveListFromCsv",
    rows: [
      {
        rowNumber: 2,
        name: "Imported A",
        url: "",
        suffix: "90",
        username: "admin",
        password: "pw",
        notes: "imported"
      }
    ]
  });

  expect(state.cameraLists[0].cameras[0].url).toBe("http://192.168.1.90");
  expect(state.tiles).toHaveLength(1);
  expect(state.passwordRecords[0]).toMatchObject({
    cameraListId: "list-sample",
    url: "http://192.168.1.90",
    username: "admin",
    password: "pw"
  });
});
```

- [ ] **Step 3: Create camera list editor**

Create `/Users/lightlab/DITBrowse/src/renderer/components/CameraListEditor.tsx`:

```tsx
import { useMemo, useState } from "react";
import { parseCameraCsv } from "../../shared/csv";
import type { CameraCsvRow } from "../../shared/csv";
import type { CameraList } from "../../shared/types";

interface CameraListEditorProps {
  activeList: CameraList | null;
  onImportRows: (rows: CameraCsvRow[]) => void;
  onClose: () => void;
}

export function CameraListEditor({
  activeList,
  onImportRows,
  onClose
}: CameraListEditorProps): JSX.Element {
  const [csvText, setCsvText] = useState(
    "name,url,suffix,username,password,notes\nCamera 42,,42,admin,,"
  );
  const parsed = useMemo(() => parseCameraCsv(csvText), [csvText]);

  return (
    <div className="panel-backdrop">
      <section className="editor-panel" aria-label="Camera list editor">
        <header className="panel-header">
          <h2>{activeList?.name ?? "Camera List"}</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="panel-note">
          CSV columns: name, url, suffix, username, password, notes. A full URL wins over suffix.
        </p>
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          aria-label="CSV import"
        />
        <div className="import-summary">
          <span>{parsed.validRows.length} valid rows</span>
          <span>{parsed.errors.length} errors</span>
        </div>
        {parsed.errors.length > 0 && (
          <ul className="import-errors">
            {parsed.errors.map((error) => (
              <li key={`${error.rowNumber}-${error.message}`}>
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={parsed.validRows.length === 0}
          onClick={() => onImportRows(parsed.validRows)}
        >
          Import Valid Rows
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Wire editor into App**

In `/Users/lightlab/DITBrowse/src/renderer/App.tsx`, add:

```tsx
import { useState } from "react";
import { CameraListEditor } from "./components/CameraListEditor";
```

Inside `App`, add:

```tsx
const [editorOpen, setEditorOpen] = useState(false);
```

Add an editor button to the top bar:

```tsx
<button type="button" onClick={() => setEditorOpen(true)}>
  Edit List
</button>
```

Render the editor before `</main>`:

```tsx
{editorOpen && (
  <CameraListEditor
    activeList={activeList ?? null}
    onClose={() => setEditorOpen(false)}
    onImportRows={(rows) => {
      dispatch({ type: "replaceActiveListFromCsv", rows });
      setEditorOpen(false);
    }}
  />
)}
```

- [ ] **Step 5: Add editor styles**

Append to `/Users/lightlab/DITBrowse/src/renderer/styles.css`:

```css
.panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.38);
}

.editor-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(560px, 100vw);
  height: 100%;
  padding: 16px;
  border-left: 1px solid #323a47;
  background: #151a22;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
}

.panel-note {
  margin: 0;
  color: #a7b1c2;
  font-size: 13px;
}

.editor-panel textarea {
  min-height: 220px;
  resize: vertical;
  border: 1px solid #323a47;
  border-radius: 8px;
  padding: 10px;
  background: #0f1217;
  color: #eef2f6;
}

.import-summary {
  display: flex;
  gap: 16px;
  color: #a7b1c2;
}

.import-errors {
  margin: 0;
  padding-left: 20px;
  color: #ffb4a8;
}
```

- [ ] **Step 6: Verify editor and import**

Run:

```bash
npm run test -- src/renderer/state src/shared/csv.test.ts
npm run typecheck
npm run build
```

Expected:

```text
CSV and reducer tests pass
No type errors
Build completes
```

- [ ] **Step 7: Commit editor**

Run:

```bash
git add src/renderer src/shared
git commit -m "feat: add camera list csv import"
```

## Task 7: Add Cookie Clearing And Session Commands

**Files:**

- Create: `/Users/lightlab/DITBrowse/src/electron/session.ts`
- Modify: `/Users/lightlab/DITBrowse/src/electron/main.ts`
- Modify: `/Users/lightlab/DITBrowse/src/electron/preload.ts`
- Create: `/Users/lightlab/DITBrowse/src/renderer/components/CookieCommands.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/App.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceStorage.ts`

- [ ] **Step 1: Implement session clearing helpers**

Create `/Users/lightlab/DITBrowse/src/electron/session.ts`:

```ts
import { session } from "electron";

const STORAGE_TYPES: Electron.StorageType[] = [
  "cookies",
  "localstorage",
  "indexdb",
  "cachestorage",
  "serviceworkers"
];

export async function clearSelectedTileStorage(partition: string, url: string): Promise<void> {
  const origin = new URL(url).origin;
  await session.fromPartition(partition).clearStorageData({
    origin,
    storages: STORAGE_TYPES
  });
}

export async function clearPartitionStorage(partition: string): Promise<void> {
  await session.fromPartition(partition).clearStorageData({
    storages: STORAGE_TYPES
  });
}
```

- [ ] **Step 2: Register IPC handlers**

Add to `/Users/lightlab/DITBrowse/src/electron/main.ts`:

```ts
import { clearPartitionStorage, clearSelectedTileStorage } from "./session";

ipcMain.handle("session:clearSelectedTile", (_event, partition: string, url: string) =>
  clearSelectedTileStorage(partition, url)
);
ipcMain.handle("session:clearPartition", (_event, partition: string) =>
  clearPartitionStorage(partition)
);
```

Register these handlers before creating the window.

- [ ] **Step 3: Expose session API in preload**

Extend `/Users/lightlab/DITBrowse/src/electron/preload.ts`:

```ts
clearSelectedTileStorage: (partition: string, url: string) =>
  ipcRenderer.invoke("session:clearSelectedTile", partition, url) as Promise<void>,
clearPartitionStorage: (partition: string) =>
  ipcRenderer.invoke("session:clearPartition", partition) as Promise<void>
```

Update `/Users/lightlab/DITBrowse/src/renderer/state/workspaceStorage.ts` window type and exports:

```ts
clearSelectedTileStorage: (partition: string, url: string) => Promise<void>;
clearPartitionStorage: (partition: string) => Promise<void>;

export async function clearSelectedTileStorage(partition: string, url: string): Promise<void> {
  await window.ditbrowse.clearSelectedTileStorage(partition, url);
}

export async function clearPartitionStorage(partition: string): Promise<void> {
  await window.ditbrowse.clearPartitionStorage(partition);
}
```

- [ ] **Step 4: Create cookie command component**

Create `/Users/lightlab/DITBrowse/src/renderer/components/CookieCommands.tsx`:

```tsx
interface CookieCommandsProps {
  selectedTile: { partition: string; url: string } | null;
  activePartition: string | null;
  onClearSelected: (partition: string, url: string) => void;
  onClearList: (partition: string) => void;
}

export function CookieCommands({
  selectedTile,
  activePartition,
  onClearSelected,
  onClearList
}: CookieCommandsProps): JSX.Element {
  return (
    <div className="cookie-commands">
      <button
        type="button"
        disabled={!selectedTile}
        onClick={() => selectedTile && onClearSelected(selectedTile.partition, selectedTile.url)}
      >
        Clear Tile Cookies
      </button>
      <button
        type="button"
        disabled={!activePartition}
        onClick={() => activePartition && onClearList(activePartition)}
      >
        Clear List Cookies
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Wire cookie commands into App**

In `/Users/lightlab/DITBrowse/src/renderer/App.tsx`, import:

```tsx
import { CookieCommands } from "./components/CookieCommands";
import {
  clearPartitionStorage,
  clearSelectedTileStorage
} from "./state/workspaceStorage";
```

Compute the active partition:

```tsx
const activePartition =
  workspace.activeJobId && workspace.activeCameraListId
    ? `persist:ditbrowse-${workspace.activeJobId}-${workspace.activeCameraListId}`
    : null;
```

Add to the top bar:

```tsx
<CookieCommands
  selectedTile={selectedTile}
  activePartition={activePartition}
  onClearSelected={(partition, url) => void clearSelectedTileStorage(partition, url)}
  onClearList={(partition) => void clearPartitionStorage(partition)}
/>
```

- [ ] **Step 6: Verify session commands**

Run:

```bash
npm run typecheck
npm run build
```

Expected:

```text
No type errors
Build completes
```

- [ ] **Step 7: Commit session commands**

Run:

```bash
git add src/electron src/renderer
git commit -m "feat: add cookie clearing commands"
```

## Task 8: Add Viewport And Zoom Controls

**Files:**

- Modify: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.ts`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.test.ts`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/components/GridControls.tsx`
- Modify: `/Users/lightlab/DITBrowse/src/renderer/App.tsx`

- [ ] **Step 1: Add reducer actions for tile viewport and zoom**

Extend `WorkspaceAction`:

```ts
| { type: "setSelectedTileZoom"; zoom: number }
| { type: "setSelectedTileViewport"; width: number; height: number }
```

Add reducer branches:

```ts
case "setSelectedTileZoom":
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tile.id === state.selectedTileId ? { ...tile, zoom: action.zoom } : tile
    )
  };
case "setSelectedTileViewport":
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tile.id === state.selectedTileId
        ? { ...tile, viewport: { width: action.width, height: action.height } }
        : tile
    )
  };
```

- [ ] **Step 2: Add reducer tests**

Append to `/Users/lightlab/DITBrowse/src/renderer/state/workspaceReducer.test.ts`:

```ts
it("updates selected tile zoom", () => {
  const state = workspaceReducer(sampleWorkspace, {
    type: "setSelectedTileZoom",
    zoom: 1.25
  });
  expect(state.tiles.find((tile) => tile.id === state.selectedTileId)?.zoom).toBe(1.25);
});

it("updates selected tile viewport", () => {
  const state = workspaceReducer(sampleWorkspace, {
    type: "setSelectedTileViewport",
    width: 1920,
    height: 1080
  });
  expect(state.tiles.find((tile) => tile.id === state.selectedTileId)?.viewport).toEqual({
    width: 1920,
    height: 1080
  });
});
```

- [ ] **Step 3: Add controls to GridControls**

Replace `/Users/lightlab/DITBrowse/src/renderer/components/GridControls.tsx` with:

```tsx
import type { ViewportSize } from "../../shared/types";

interface GridControlsProps {
  columns: number;
  selectedZoom: number;
  selectedViewport: ViewportSize | null;
  onColumnsChange: (columns: number) => void;
  onZoomChange: (zoom: number) => void;
  onViewportChange: (viewport: ViewportSize) => void;
}

export function GridControls({
  columns,
  selectedZoom,
  selectedViewport,
  onColumnsChange,
  onZoomChange,
  onViewportChange
}: GridControlsProps): JSX.Element {
  return (
    <div className="grid-controls">
      <label className="grid-control">
        Columns
        <select
          value={columns}
          onChange={(event) => onColumnsChange(Number(event.target.value))}
          aria-label="Grid columns"
        >
          {[2, 3, 4, 5, 6].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="grid-control">
        Zoom
        <select
          value={selectedZoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          aria-label="Selected tile zoom"
        >
          {[0.75, 1, 1.25, 1.5].map((value) => (
            <option key={value} value={value}>
              {value}x
            </option>
          ))}
        </select>
      </label>
      <label className="grid-control">
        Viewport
        <select
          value={`${selectedViewport?.width ?? 1280}x${selectedViewport?.height ?? 720}`}
          onChange={(event) => {
            const [width, height] = event.target.value.split("x").map(Number);
            onViewportChange({ width, height });
          }}
          aria-label="Selected tile viewport"
        >
          <option value="1280x720">1280x720</option>
          <option value="1920x1080">1920x1080</option>
          <option value="1024x768">1024x768</option>
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Wire controls in App**

Update the `GridControls` usage in `/Users/lightlab/DITBrowse/src/renderer/App.tsx`:

```tsx
<GridControls
  columns={workspace.gridColumns}
  selectedZoom={selectedTile?.zoom ?? workspace.defaultZoom}
  selectedViewport={selectedTile?.viewport ?? workspace.defaultViewport}
  onColumnsChange={(columns) => dispatch({ type: "setGridColumns", columns })}
  onZoomChange={(zoom) => dispatch({ type: "setSelectedTileZoom", zoom })}
  onViewportChange={(viewport) =>
    dispatch({
      type: "setSelectedTileViewport",
      width: viewport.width,
      height: viewport.height
    })
  }
/>
```

- [ ] **Step 5: Verify viewport and zoom controls**

Run:

```bash
npm run test -- src/renderer/state
npm run typecheck
npm run build
```

Expected:

```text
Reducer tests pass
No type errors
Build completes
```

- [ ] **Step 6: Commit viewport controls**

Run:

```bash
git add src/renderer
git commit -m "feat: add viewport and zoom controls"
```

## Task 9: Add E2E Smoke Tests And Manual Verification Runbook

**Files:**

- Create: `/Users/lightlab/DITBrowse/playwright.config.ts`
- Create: `/Users/lightlab/DITBrowse/tests/e2e/mock-camera-server.ts`
- Create: `/Users/lightlab/DITBrowse/tests/e2e/workspace.spec.ts`
- Create: `/Users/lightlab/DITBrowse/docs/verification.md`
- Modify: `/Users/lightlab/DITBrowse/package.json`

- [ ] **Step 1: Add Playwright scripts**

In `/Users/lightlab/DITBrowse/package.json`, add:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

Install Playwright:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add Playwright config**

Create `/Users/lightlab/DITBrowse/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
```

- [ ] **Step 3: Add mock camera server helper**

Create `/Users/lightlab/DITBrowse/tests/e2e/mock-camera-server.ts`:

```ts
import http from "node:http";

export interface MockCameraServer {
  url: string;
  requests: string[];
  close: () => Promise<void>;
}

export async function startMockCameraServer(): Promise<MockCameraServer> {
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url ?? "/");
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`
      <!doctype html>
      <html>
        <body>
          <h1>Mock Camera GUI</h1>
          <button>Menu</button>
          <input aria-label="camera setting" value="5600K" />
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock camera server did not return a TCP address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
```

- [ ] **Step 4: Add browser workspace smoke test**

Create `/Users/lightlab/DITBrowse/tests/e2e/workspace.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("workspace shows row-major tiles and lets columns change", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Camera tabs")).toBeVisible();
  await expect(page.getByLabel("Grid columns")).toHaveValue("4");

  const grid = page.locator(".tile-grid");
  await expect(grid).toHaveCSS("overflow", "hidden");

  await page.getByLabel("Grid columns").selectOption("5");
  await expect(page.getByLabel("Grid columns")).toHaveValue("5");
});
```

- [ ] **Step 5: Add manual verification runbook**

Create `/Users/lightlab/DITBrowse/docs/verification.md`:

```md
# DITBrowse Verification

## Automated

Run:

```bash
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

## Manual

1. Run `npm run electron:dev`.
2. Confirm the app opens to the tiled workspace.
3. Confirm the tab row is one horizontal scrollable row.
4. Load or import 10-15 camera URLs.
5. Change the column selector and confirm every tile remains visible.
6. Resize the app window and confirm loaded pages do not reload.
7. Select a tile and navigate it from the address bar.
8. Use `New Tile` from the address bar and confirm the URL opens in a new tile.
9. Change selected tile zoom and viewport and confirm the camera page scales.
10. Quit and relaunch, then confirm workspace state returns.
11. Use Clear Tile Cookies and Clear List Cookies and confirm saved passwords remain in the camera list.
```

- [ ] **Step 6: Run full verification**

Run:

```bash
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

Expected:

```text
All unit tests pass
No type errors
Build completes
E2E smoke test passes
```

- [ ] **Step 7: Commit verification**

Run:

```bash
git add package.json package-lock.json playwright.config.ts tests docs/verification.md
git commit -m "test: add workspace verification"
```

## Task 10: Final Build Pass And V1 Readiness Review

**Files:**

- Modify only files needed to fix failures found by verification.

- [ ] **Step 1: Run the final automated checks**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected:

```text
All tests pass
No type errors
Build completes
```

- [ ] **Step 2: Run the app**

Run:

```bash
npm run electron:dev
```

Expected manual check:

```text
The app opens.
The workspace has tabs, one address bar, grid controls, cookie commands, editor access, and scaled tiles.
Changing grid columns does not reload webviews.
```

- [ ] **Step 3: Record any remaining known gaps**

If any spec behavior is not implemented, add `/Users/lightlab/DITBrowse/docs/v1-known-gaps.md` with exact entries in this format:

```md
# V1 Known Gaps

- [gap title]: [specific behavior not implemented], [reason], [recommended next task].
```

If every planned v1 behavior is implemented, do not create `docs/v1-known-gaps.md`.

- [ ] **Step 4: Commit final fixes or readiness note**

If code changed:

```bash
git add .
git commit -m "fix: complete v1 verification"
```

If only documentation changed:

```bash
git add docs/v1-known-gaps.md
git commit -m "docs: record v1 known gaps"
```

If no files changed, do not create an empty commit.

## Self-Review

Spec coverage:

- macOS Electron app: Task 1.
- Equal visible tiles and row-major order: Tasks 2, 4, and 5.
- One address bar controlling the selected tile: Task 4.
- Horizontal scrollable tab row: Task 4.
- URL prefix shortcut: Task 2 and Task 4.
- Jobs/camera lists and CSV import: Tasks 2 and 6.
- Local password records scoped by job/list, URL, username, and password: Tasks 2 and 6.
- Cookie clearing for selected tile and list: Task 7.
- Stable viewport and scale without reload: Tasks 2, 5, and 8.
- Persistence and window state: Task 3.
- Verification: Tasks 9 and 10.

Each task names the files it owns, the command to run, and the expected result.
