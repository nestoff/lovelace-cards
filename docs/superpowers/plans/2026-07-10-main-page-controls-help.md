# Main Page Controls Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Explain every DITBrowse main-workspace control inside the existing offline Help tab with a complete typed reference and three compact annotated stills.

**Architecture:** Extend the existing data-only `HelpSection` model with grouped control-reference entries and render them natively in `HelpGuide`. Extend the deterministic Playwright capture workflow with real tab-row, navigation/address, and layout/global-zoom states; bundle those PNGs through Vite beside the existing six stills.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest, Testing Library, Playwright, Electron 42, CSS, SVG annotations.

## Global Constraints

- Cover every visible main-page control, including address, column, zoom, global zoom, resolution, and conditional controls.
- State whether each control affects the selected camera, all cameras, or the workspace.
- Explain disabled and conditional states.
- Add three compact real-app captures rather than shrinking one dense toolbar image.
- Use exact current labels and accessible tooltip names.
- Preserve sanitized documentation-only data, clean source captures, neutral annotations, and red only for destructive actions.
- Keep Help bundled, offline, and inside DITBrowse; do not create a GitHub Wiki.
- Do not run Developer ID signing or notarization. Replace `/Applications/DITBrowse.app` after verification and preserve a timestamped backup.

---

### Task 1: Typed Main Page Controls reference

**Files:**
- Modify: `src/renderer/help/helpContent.ts`
- Modify: `src/renderer/help/HelpGuide.tsx`
- Modify: `src/renderer/help/HelpGuide.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces: `HelpControlScope`, `HelpControl`, `HelpControlGroup`, and `HelpSection.controlGroups`.
- Consumes: the existing `helpSections` data model and `HelpGuide` renderer.

- [x] **Step 1: Add a failing completeness test**

Add this test to `HelpGuide.test.tsx`:

```tsx
it("explains every main workspace control exactly once", () => {
  render(<HelpGuide />);
  const reference = screen.getByLabelText("Main Page Controls reference");
  const labels = [
    "Camera tab",
    "Close tab",
    "Add tile",
    "Help",
    "Camera List",
    "Back",
    "Forward",
    "Camera Session",
    "Address",
    "Open address",
    "Open address in new tile",
    "Save current URL to camera list",
    "Use list address",
    "Focus selected page / Show all pages",
    "Cols",
    "Selected camera zoom",
    "Selected zoom percentage / reset",
    "All",
    "All relative zoom",
    "All relative percentage / reset",
    "Resolution",
    "Apply to All"
  ];

  for (const label of labels) {
    expect(within(reference).getAllByText(label, { exact: true })).toHaveLength(1);
  }
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/renderer/help/HelpGuide.test.tsx`

Expected: FAIL because `Main Page Controls reference` does not exist.

- [x] **Step 3: Extend the content model**

Add these exact types in `helpContent.ts`:

```ts
export type HelpControlScope = "Selected camera" | "All cameras" | "Workspace";

export interface HelpControl {
  label: string;
  outcome: string;
  scope: HelpControlScope;
  availability?: string;
}

export interface HelpControlGroup {
  title: string;
  controls: HelpControl[];
}
```

Add `controlGroups?: HelpControlGroup[]` to `HelpSection` and add `"main-controls"` to the `id` union.

- [x] **Step 4: Add the Main Page Controls section with complete data**

Insert `main-controls` after Quick Start with three groups and the 22 labels from Step 1. Use the exact outcomes below:

```ts
{
  id: "main-controls",
  title: "Main Page Controls",
  introduction:
    "These controls run left to right across the tab row and camera toolbar.",
  controlGroups: [
    {
      title: "Tabs and workspace",
      controls: [
        { label: "Camera tab", outcome: "Selects that camera without reloading it; drag the tab to change tab and grid order.", scope: "Workspace" },
        { label: "Close tab", outcome: "Removes the camera from the open grid without deleting its camera-list row.", scope: "Workspace" },
        { label: "Add tile", outcome: "Opens a new blank camera browser tile.", scope: "Workspace" },
        { label: "Help", outcome: "Opens this bundled offline guide.", scope: "Workspace" },
        { label: "Camera List", outcome: "Opens camera-list editing and Workspace Settings.", scope: "Workspace" }
      ]
    },
    {
      title: "Navigation and address",
      controls: [
        { label: "Back", outcome: "Returns the selected camera to its previous page.", scope: "Selected camera" },
        { label: "Forward", outcome: "Moves the selected camera to its next page.", scope: "Selected camera" },
        { label: "Camera Session", outcome: "Opens reload and sign-out actions.", scope: "Workspace" },
        { label: "Address", outcome: "Shows or edits the selected camera's live URL.", scope: "Selected camera" },
        { label: "Open address", outcome: "Loads the typed address in the selected camera.", scope: "Selected camera" },
        { label: "Open address in new tile", outcome: "Creates a blank tile and loads the typed address there.", scope: "Workspace" },
        { label: "Save current URL to camera list", outcome: "Stores the selected camera's live address in its camera-list row.", scope: "Selected camera", availability: "Enabled only when the live address differs from the saved row." },
        { label: "Use list address", outcome: "Restores shared-prefix plus camera-number addressing.", scope: "Selected camera", availability: "Shown only while the camera uses a full-address override." }
      ]
    },
    {
      title: "Layout, zoom, and resolution",
      controls: [
        { label: "Focus selected page / Show all pages", outcome: "Switches between one enlarged camera and the complete grid without reloading.", scope: "Workspace", availability: "Disabled when no camera is selected or Companion expansion mode is off." },
        { label: "Cols", outcome: "Sets the camera grid column count.", scope: "All cameras" },
        { label: "Selected camera zoom", outcome: "Changes the selected camera's zoom with the slider.", scope: "Selected camera" },
        { label: "Selected zoom percentage / reset", outcome: "Sets a precise selected-camera zoom; double-click % to reset to 100%.", scope: "Selected camera" },
        { label: "All", outcome: "Opens relative zoom controls for every camera.", scope: "All cameras" },
        { label: "All relative zoom", outcome: "Adjusts every camera relative to its own saved zoom.", scope: "All cameras" },
        { label: "All relative percentage / reset", outcome: "Sets the precise global factor; double-click % to reset it to 100%.", scope: "All cameras" },
        { label: "Resolution", outcome: "Changes the selected camera's viewport resolution.", scope: "Selected camera", availability: "Disabled when no camera viewport is selected." },
        { label: "Apply to All", outcome: "Copies the selected resolution to every open camera.", scope: "All cameras", availability: "Disabled when no camera viewport is selected." }
      ]
    }
  ]
}
```

- [x] **Step 5: Render grouped control-reference cards**

In `HelpGuide.tsx`, render `section.controlGroups` inside:

```tsx
<div className="help-control-reference" aria-label="Main Page Controls reference">
  {section.controlGroups.map((group) => (
    <section key={group.title} className="help-control-group">
      <h3>{group.title}</h3>
      <dl>
        {group.controls.map((control) => (
          <div key={control.label} className="help-control-row">
            <dt>{control.label}</dt>
            <dd>
              <p>{control.outcome}</p>
              <span>{control.scope}</span>
              {control.availability && <small>{control.availability}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  ))}
</div>
```

Style compact neutral cards with a 170px label column, a visible scope pill, wrapping availability notes, and one-column rows below 760px.

- [x] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/renderer/help/HelpGuide.test.tsx && npm run typecheck`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/renderer/help/helpContent.ts src/renderer/help/HelpGuide.tsx src/renderer/help/HelpGuide.test.tsx src/renderer/styles.css
git commit -m "docs: explain every main workspace control"
```

---

### Task 2: Capture three compact main-control stills

**Files:**
- Modify: `tests/e2e/help-stills.spec.ts`
- Create: `docs/help/source-stills/main-tabs.png`
- Create: `docs/help/source-stills/main-navigation.png`
- Create: `docs/help/source-stills/main-layout.png`
- Create: `src/renderer/help/assets/main-tabs.png`
- Create: `src/renderer/help/assets/main-navigation.png`
- Create: `src/renderer/help/assets/main-layout.png`

**Interfaces:**
- Consumes: `captureStill` and `createCaptureRegion` from the existing capture workflow.
- Produces: three clean/annotated PNG pairs generated from current DITBrowse components.

- [x] **Step 1: Capture the tab row**

Immediately after the existing main-workspace capture, capture `.browser-tab-row` as `main-tabs` with callouts for:

1. First camera tab select area (selection and drag behavior).
2. First tab's Close button.
3. Add tile.
4. Help.
5. Camera List.

Use `getByRole` with exact accessible names and keep callout markers outside labels.

- [x] **Step 2: Create the conditional navigation state**

Within the sanitized capture only:

1. Open Camera List.
2. Uncheck `A follow prefix`.
3. Fill `A URL` with `http://192.0.2.41`.
4. Save Changes.
5. Fill Address with `http://192.0.2.42` and press Enter.

Assert `Use list address` is visible and `Save current URL to camera list` is enabled.

- [x] **Step 3: Capture navigation and address controls**

Create a capture region covering `.browser-navigation` and `.browser-toolbar-main`, then capture `main-navigation` with eight callouts:

1. Back.
2. Forward.
3. Camera Session.
4. Address.
5. Open address.
6. Open address in new tile.
7. Save current URL to camera list.
8. Use list address.

- [x] **Step 4: Capture layout and global zoom controls**

Click the exact `Global zoom controls` button, assert `Global zoom controls panel` is visible, create a capture region covering `.browser-layout-controls` plus `.zoom-popover`, and capture `main-layout` with seven grouped callouts:

1. Focus selected page.
2. Grid columns.
3. Selected tile zoom plus selected percentage/reset.
4. All button.
5. All relative slider plus percentage/reset panel.
6. Selected camera resolution.
7. Apply resolution to all cameras.

- [x] **Step 5: Generate and inspect all pairs**

Run: `npm run capture:help-stills`

Expected: PASS and nine source/annotated pairs total. Inspect the three new pairs at original resolution for exact UI, readable arrows, no label coverage, and no production data.

- [x] **Step 6: Commit**

```bash
git add tests/e2e/help-stills.spec.ts docs/help/source-stills src/renderer/help/assets
git commit -m "docs: add annotated main controls stills"
```

---

### Task 3: Place the new stills and verify navigation

**Files:**
- Modify: `src/renderer/help/helpContent.ts`
- Modify: `src/renderer/help/HelpGuide.test.tsx`
- Modify: `tests/e2e/workspace.spec.ts`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `main-tabs.png`, `main-navigation.png`, and `main-layout.png` from Task 2.
- Produces: nine total Help figures and an accessible Main Page Controls sidebar link.

- [x] **Step 1: Extend figure and navigation tests**

Change the expected Help image count from 6 to 9. Assert the three new alt texts exist and `Main Page Controls` links to `#help-main-controls`.

- [x] **Step 2: Attach the three images to `main-controls`**

Import the PNGs and add `images` with captions and callouts matching Task 2 exactly. Keep one caption list per image and preserve the marker numbers used in the raster annotations.

- [x] **Step 3: Extend browser-level Help coverage**

In `workspace.spec.ts`, assert the Main Page Controls link exists, click it, and verify the `Main Page Controls` heading and `Main Page Controls reference` are visible with no horizontal overflow at 960, 1180, and 1440 widths.

- [x] **Step 4: Run the full verification gate**

Run:

```bash
npm run test
npm run typecheck
npm run test:e2e
npm run test:electron
npm run build
```

Expected: every command exits 0 and Vite lists nine Help PNG assets.

- [x] **Step 5: Commit**

```bash
git add src/renderer/help/helpContent.ts src/renderer/help/HelpGuide.test.tsx tests/e2e/workspace.spec.ts src/renderer/styles.css
git commit -m "docs: complete main controls help"
```

---

### Task 4: Package and replace the installed app

**Files:**
- Generated: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Replace: `/Applications/DITBrowse.app`
- Backup: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`

**Interfaces:**
- Consumes: verified guide and nine bundled Help images.
- Produces: running local replacement app with the expanded guide.

- [x] **Step 1: Package without Developer ID signing or notarization**

Run: `npm run package:mac`

Expected: package succeeds. Do not run `package:mac:signed`, `package:mac:notarized`, or `scripts/sign-and-notarize-mac.mjs`.

- [x] **Step 2: Verify all nine assets inside `app.asar`**

List `dist-renderer/assets` inside the packaged asar and confirm the six existing plus `main-tabs`, `main-navigation`, and `main-layout` PNGs.

- [x] **Step 3: Back up and replace Applications**

Quit DITBrowse, move the current `/Applications/DITBrowse.app` to a timestamped backup, copy the new packaged app with `ditto`, and launch `/Applications/DITBrowse.app`.

- [x] **Step 4: Verify the running installation**

Confirm the process path is `/Applications/DITBrowse.app/Contents/MacOS/DITBrowse`, the local status endpoint is online with the existing camera count, and the installed Help page shows Main Page Controls plus all nine images.

- [x] **Step 5: Mark the plan complete and commit tracking**

Change every checkbox in this plan to `[x]`, commit the plan update, and report the backup path, tests, installed path, and explicit not-notarized status.

