# Camera Table Round-Trip Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a table copied from DITBrowse, edited in a spreadsheet, and pasted back update the intended camera rows while keeping `Follow Prefix` out of spreadsheet data.

**Architecture:** Keep the visible nine-column camera editor and positional range paste unchanged. Add an explicit eight-column spreadsheet export model to `cameraTableClipboard.ts`; header-mode imports use that model, skip the header, start at camera row one, and ignore legacy `Follow Prefix` data. `CameraListEditor.tsx` continues to own clipboard events and feedback.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, Playwright, Electron.

## Global Constraints

- `Follow Prefix` remains visible and manually editable inside DITBrowse.
- **Copy Table** exports exactly: `Index`, `Camera #`, `Full URL`, `Type`, `Lens`, `Display Note`, `Viewport`, `Zoom`.
- Header-mode paste never writes `Follow Prefix` and always begins at the first camera row.
- Headerless positional paste continues to begin at the selected cell.
- Paste changes remain drafts until **Save Changes**; **Discard** still restores saved data.
- No persistence schema or saved workspace migration changes.

---

### Task 1: Lock The Round-Trip Contract In Pure Tests

**Files:**
- Modify: `src/renderer/cameraTableClipboard.test.ts`
- Modify: `src/renderer/cameraTableClipboard.ts`

**Interfaces:**
- Consumes: `serializeWholeCameraTable(list)` and `pasteCameraTableText(list, activeCell, text, createId?)`.
- Produces: an eight-column whole-table export and header-mode paste that starts at row index `0`.

- [ ] **Step 1: Add failing export and import regression tests**

Add assertions equivalent to:

```ts
expect(serializeWholeCameraTable(list).split("\n")[0]).toBe(
  "Index\tCamera #\tFull URL\tType\tLens\tDisplay Note\tViewport\tZoom"
);
expect(serializeWholeCameraTable(list)).not.toContain("Follow Prefix");

const result = pasteCameraTableText(
  list,
  { rowIndex: 6, columnIndex: 8 },
  "Index\tCamera #\tType\tFollow Prefix\nA\t01\tBURANO\tFALSE"
);
expect(result?.list.cameras[0]).toMatchObject({
  name: "A",
  suffix: "01",
  cameraType: "BURANO",
  usesListPrefix: true
});
expect(result?.selection.anchor.rowIndex).toBe(0);
```

Include a second assertion proving a headerless value still starts at the supplied active cell.

- [ ] **Step 2: Run the focused test and verify the regression fails**

Run:

```bash
npx vitest run src/renderer/cameraTableClipboard.test.ts
```

Expected: FAIL because whole-table export includes `Follow Prefix` and header-mode paste starts at the active row.

- [ ] **Step 3: Add the spreadsheet-facing column model**

In `cameraTableClipboard.ts`, derive an export list that excludes `usesListPrefix`:

```ts
const CAMERA_TABLE_SPREADSHEET_COLUMNS = CAMERA_TABLE_COLUMNS.filter(
  (column) => column.key !== "usesListPrefix"
);
```

Serialize whole-table headers and values from those column indexes while leaving selection serialization unchanged.

- [ ] **Step 4: Make header-mode paste start at row zero and ignore Follow Prefix**

Compute the destination start row by mode:

```ts
const destinationStartRow = mode === "headers" ? 0 : activeCell.rowIndex;
```

Use `destinationStartRow` for row growth, assignments, issue row numbers, and returned selection. Keep `usesListPrefix` recognizable for header detection, but omit it from header assignments and mapped selection columns.

- [ ] **Step 5: Run pure tests and typecheck**

Run:

```bash
npx vitest run src/renderer/cameraTableClipboard.test.ts
npm run typecheck
```

Expected: PASS.

---

### Task 2: Verify The User-Facing Clipboard Workflow

**Files:**
- Modify: `src/renderer/components/CameraListEditor.test.tsx`
- Modify: `src/renderer/components/CameraListEditor.tsx`
- Modify: `tests/e2e/workspace.spec.ts`

**Interfaces:**
- Consumes: corrected pure clipboard serialization and paste result.
- Produces: accurate toolbar wording and a browser-level spreadsheet round trip.

- [ ] **Step 1: Update the Copy Table component test**

Assert the clipboard starts with the eight approved headers, excludes `Follow Prefix`, and includes unsaved edited values. Keep the assertion that copy does not save the draft.

- [ ] **Step 2: Update Copy Table tooltip copy**

Use a description that states the exported table contains editable camera details and excludes the app-only prefix-following control.

- [ ] **Step 3: Extend the Playwright workflow**

After opening Camera List:

1. Click **Copy Table** and assert the clipboard header excludes `Follow Prefix`.
2. Replace a Type and Lens value in the clipboard text.
3. Focus a cell below the first row to prove focus does not control header-mode destination.
4. Paste and assert the edited values appear in the first camera rows.
5. Confirm `Follow Prefix` remains unchanged and Save is still required.

- [ ] **Step 4: Run component and browser tests**

Run:

```bash
npx vitest run src/renderer/components/CameraListEditor.test.tsx
npm run test:e2e -- --grep "spreadsheet navigation"
```

Expected: PASS.

---

### Task 3: Release Verification And Publication

**Files:**
- Verify: all changed source and test files
- Generate: ignored files under `release/DITBrowse-darwin-arm64/`

**Interfaces:**
- Consumes: completed clipboard correction.
- Produces: tested source on `main`, a signed/notarized app and DMG, and an updated `/Applications/DITBrowse.app`.

- [ ] **Step 1: Run the complete test matrix**

Run:

```bash
npm test
npm run typecheck
npm run test:e2e
npm run test:electron
```

Expected: all commands PASS.

- [ ] **Step 2: Build and validate the signed macOS release**

Run the repository's signed packaging command with `APPLE_NOTARIZE_KEYCHAIN_PROFILE=DITBrowse-notary`, then validate the app and installer with `codesign`, `spctl`, and `xcrun stapler validate`.

- [ ] **Step 3: Install the verified app**

Replace `/Applications/DITBrowse.app` with the newly validated app while preserving the previous app as a timestamped backup. Do not modify Application Support data.

- [ ] **Step 4: Commit and push**

Stage only source, tests, and documentation. Do not stage release artifacts or `.DS_Store`.

```bash
git commit -m "fix: round trip camera tables through spreadsheets"
git push origin main
```

Expected: `main` and `origin/main` resolve to the same commit.
