# Camera Metadata And Login Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual list credentials with visible camera metadata and browser-style credential capture/autofill in camera webviews.

**Architecture:** Keep the current Electron/React architecture. Add shared formatting/credential helpers, extend camera rows with display metadata, route credential events from webview preload scripts through `WebviewTile` into the workspace reducer, and keep saved credentials in existing job/list-scoped workspace state.

**Tech Stack:** Electron 42, React 19, TypeScript, Vite, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `src/shared/cameraLabel.ts`: formats camera number/type/lens/display note labels.
- Create `src/shared/credentials.ts`: normalizes credential URLs and finds records for a tile.
- Create `src/electron/webviewPreload.ts`: captures and fills password fields inside guest camera pages.
- Modify `src/shared/types.ts`: add camera metadata fields and credential camera id.
- Modify `src/shared/csv.ts`: remove required username/password headers and parse metadata fields.
- Modify `src/shared/sampleData.ts`: seed numeric camera labels.
- Modify `src/renderer/state/workspaceReducer.ts`: update labels, metadata, credential capture, and URL syncing.
- Modify `src/renderer/components/CameraListEditor.tsx`: show camera metadata columns and remove list credentials.
- Modify `src/renderer/components/WebviewTile.tsx`: pass preload path, capture credentials, and send saved credentials to the guest page.
- Modify `src/renderer/App.tsx` and `src/renderer/components/TileGrid.tsx`: route credential capture and saved credential props.
- Modify `src/electron/preload.ts` and `src/renderer/state/workspaceStorage.ts`: expose webview preload path to the renderer.
- Update tests before each implementation slice.

---

## Tasks

### Task 1: Camera Metadata Labels

- [ ] Write failing tests for `formatCameraLabel` and reducer metadata updates.
- [ ] Implement `cameraLabel.ts` and extend camera row types/sample data.
- [ ] Update reducer tile-title generation to use the compact label.
- [ ] Run focused tests and commit.

### Task 2: Editor And CSV Cleanup

- [ ] Write failing tests that CSV import no longer requires username/password and the editor does not show list credential columns.
- [ ] Update parser and camera list editor fields.
- [ ] Update reducer import/add behavior for metadata fields.
- [ ] Run focused tests and commit.

### Task 3: Browser-Style Credential Capture

- [ ] Write failing reducer/WebviewTile tests for captured credentials.
- [ ] Add webview preload credential capture/fill script.
- [ ] Expose preload path and wire webview events through App to the reducer.
- [ ] Run focused tests and commit.

### Task 4: Full Verification

- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e`.
- [ ] Inspect the running UI and commit any final styling/behavior fixes.

## Self-Review

- Spec coverage: metadata labels, editor cleanup, CSV cleanup, and credential capture are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: field names are `cameraType`, `lens`, and `displayNote` throughout the plan.
