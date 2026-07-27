# Camera Table Spreadsheet Editing Design

## Purpose

DITBrowse's Camera List table should support direct clipboard exchange with Numbers, Excel, and Google Sheets. Users should not need to paste CSV into a separate import box. The camera table itself becomes the import, export, selection, and editing surface while retaining the existing Save Changes and Discard draft workflow.

## Scope

This change adds:

- Full-text selection after Enter and Tab navigation.
- Active-cell and rectangular range selection.
- Whole-row and whole-column selection.
- Spreadsheet-compatible copy and paste.
- One-command copying of the spreadsheet-facing table with headers.
- Automatic row creation when pasted data exceeds the current list.
- Header-aware column mapping.
- Paste validation and a compact result notice.
- Removal of the CSV textarea and Import Valid Rows controls.

It does not change persisted workspace data, camera URL resolution, tab/grid ordering, Electron webviews, camera session handling, or authentication.

## Data Columns

The editable table contains these nine data columns, in visual order:

1. Follow Prefix
2. Index
3. Camera #
4. Full URL
5. Type
6. Lens
7. Display Note
8. Viewport
9. Zoom

Move and Delete are action columns. They are never copied or pasted.

`Follow Prefix` is app-only control state. A manual cell, row, or column selection can still copy it when the user explicitly includes that visible table cell, but **Copy Table** and header-based spreadsheet imports exclude it. The spreadsheet-facing table therefore contains these eight columns: `Index`, `Camera #`, `Full URL`, `Type`, `Lens`, `Display Note`, `Viewport`, and `Zoom`.

Copied values use these representations:

- Follow Prefix: `TRUE` or `FALSE`.
- Index, Camera #, Full URL, Type, Lens, Display Note: displayed text.
- Viewport: `WIDTHxHEIGHT`, or blank for Default.
- Zoom: decimal scale such as `1.05`, or blank for Default.

## Selection Model

Selection is local editor state and is never persisted. It consists of:

- An active cell.
- An anchor cell.
- A selection mode: cells, rows, or columns.
- Normalized row and column bounds derived from the anchor and current endpoint.

The interactions are:

- Clicking an editable cell makes it active and selects that single cell.
- Shift-clicking another editable cell selects the rectangular range between the anchor and that cell.
- Clicking a row handle selects every data cell in that camera row.
- Shift-clicking another row handle selects the contiguous rows between the two handles.
- Dragging a row handle continues to reorder the camera list; a click without a drag selects the row.
- Clicking a data-column header selects that entire data column across all camera rows.
- Shift-clicking another data-column header selects the contiguous columns between the two headers.

Selected cells receive a restrained accent fill. The perimeter receives a stronger outline, and the active cell has the clearest focus treatment. Selection styling must not hide validation, focus, or row-reorder affordances.

## Keyboard Navigation

The existing movement rules remain:

- Enter moves one row down in the same column.
- Shift+Enter moves one row up.
- Tab moves one column right and wraps to the next row.
- Shift+Tab moves one column left and wraps to the previous row.

After navigation, text and number inputs call `select()` after focus so their complete contents are highlighted and the next keystroke replaces the value. Checkbox and select controls receive focus and single-cell selection but have no text-selection operation.

Keyboard navigation updates both the active cell and the single-cell selection. It does not extend the previous range.

## Copy

The table handles the native `copy` event when a camera-table selection exists.

- A single cell copies one value.
- A rectangular range copies rows separated by `\n` and columns separated by `\t`.
- A row selection copies all nine data columns for the selected rows.
- A column selection copies the selected data columns for all camera rows.
- Clipboard output does not include headers automatically.

This tab-separated format pastes directly into Numbers, Excel, and Google Sheets. For a one-cell text selection, the copied value is equivalent whether native input copying or table copying handles the event.

A persistent **Copy Table** command appears in the Camera List toolbar beside the row-count controls. It copies one standard header row followed by every current draft camera row, using the same tab-separated format. The headers are, in order: `Index`, `Camera #`, `Full URL`, `Type`, `Lens`, `Display Note`, `Viewport`, and `Zoom`.

**Copy Table** always includes every row and all eight spreadsheet-facing columns, regardless of the current cell selection. It never includes `Follow Prefix`. It copies the current draft, including unsaved edits and newly added rows, so the spreadsheet matches what is visible in the editor. It does not save the draft or alter the current selection. A short live-region confirmation reports how many camera rows were copied.

## Paste Formats

The table handles the native `paste` event and reads `text/plain` from `ClipboardEvent.clipboardData`; it does not request global clipboard permission.

Line endings normalize from CRLF or CR to LF. Rows split on newlines and cells split on tabs. A final empty line is ignored, but interior empty rows and cells are retained.

Two paste modes are supported.

### Positional Paste

When the first clipboard row is ordinary data, the top-left value lands in the active cell. Remaining values fill right and down. Values beyond the last data column are skipped and reported. If the clipboard has more rows than the camera list below the active cell, sequential camera rows are appended before applying values.

### Header-Mapped Paste

The first clipboard row is considered a header row when it contains at least two recognized headers. Matching is case-insensitive and ignores spaces, underscores, `#`, and punctuation. The header row is metadata only and is never entered into a camera row. Unknown header columns are skipped and reported rather than forcing positional paste.

Recognized aliases are:

- Follow Prefix: `follow prefix`, `follow_prefix`, `uses list prefix` is recognized only so older exported tables can be read; its values are ignored.
- Index: `index`, `name`.
- Camera #: `camera #`, `camera number`, `number`, `suffix`.
- Full URL: `full url`, `url`, `address`.
- Type: `type`, `camera type`, `camera_type`.
- Lens: `lens`.
- Display Note: `display note`, `display_note`, `note`, `notes`.
- Viewport: `viewport`, `view`, `resolution`.
- Zoom: `zoom`, `scale`.

In header-mapped mode, the header row is skipped. Recognized spreadsheet-facing columns map by name regardless of clipboard order, unknown columns are skipped, and data always begins at the first camera row. The active cell is ignored because the headers define both the destination columns and a complete-table round trip. Enough sequential camera rows are appended to fit all data rows. A recognized `Follow Prefix` column from an older table is silently ignored and leaves each row's current setting unchanged.

## Value Parsing

Text fields accept any clipboard text. Empty clipboard cells clear text fields.

Special columns parse as follows:

- Camera # uses the existing two-digit camera-number normalization.
- Full URL uses the existing URL normalization and prefix-following rules. This can switch a row to a custom URL, but imported data never writes `Follow Prefix` directly.
- Viewport accepts `WIDTHxHEIGHT`, with either lowercase or uppercase `x`, and `default` or blank for the list default. Width and height must be positive integers.
- Zoom accepts decimal scale (`1.05`), whole percent (`105%`), and `default` or blank. The normalized scale must remain between `0.25` and `3`.

For each row, updates apply in deterministic order so explicit spreadsheet data wins predictably:

1. Camera #.
2. Index.
3. Full URL.
4. Type, Lens, Display Note, Viewport, and Zoom.
This preserves the rule that an explicit Index overrides the default index derived from Camera #. `Follow Prefix` is not an import assignment.

Invalid special values leave only that destination cell unchanged. Other valid cells in the same paste still apply.

## Paste Result And Draft Behavior

Pasting edits only the local camera-list draft. The grid, tabs, and saved list do not change until Save Changes is clicked. Discard removes pasted changes with the rest of the draft.

After paste:

- The pasted destination range becomes selected.
- The top-left pasted destination becomes active.
- A compact inline notice reports rows added, cells updated, and cells skipped.
- Skipped cells identify their camera row, column, and invalid source value.

The notice is informational and does not block editing or saving valid changes.

## CSV Import Removal

Remove the CSV textarea, parser summary, parse errors, and Import Valid Rows button from the Camera List workspace. The shared CSV parser may remain for compatibility tests or other code until no caller needs it, but it is no longer part of the user interface.

The table can accept both header-mapped and positional clipboard data, covering the former import workflow without a separate staging surface.

## Component Boundaries

- `cameraTableClipboard.ts` owns column definitions, selection normalization, TSV serialization, header detection, value parsing, sequential row growth, and draft paste application. Existing pure camera draft helpers move into this module so paste, manual edits, and row-count changes share the same Camera #, Index, URL, and prefix rules.
- `CameraListEditor.tsx` owns active/anchor selection state, native copy/paste event handlers, focus movement, visual cell-selection props, and paste-result UI.
- `CameraListEditor.tsx` invokes whole-table serialization from the toolbar's **Copy Table** command and reports clipboard success or failure inline.
- `CameraListEditor.tsx` imports the shared pure draft helpers rather than maintaining a second set of update rules.
- `styles.css` owns selected-cell, range-perimeter, row-header, column-header, and paste-notice visuals.

The clipboard module must not depend on DOM APIs. React event handlers provide clipboard text and consume the pure module's result.

## Accessibility

- Data-column headers are buttons with names such as `Select Type column`.
- Row handles are named `Select row 1; drag to move A`.
- The **Copy Table** command is named `Copy camera table` and has a tooltip explaining that it copies headers and every draft camera row for Numbers, Excel, or Google Sheets.
- Selected cells expose `aria-selected="true"` through their table cells.
- The table receives a concise accessible description of Shift-click, Command+C, and Command+V behavior without adding visible instructional copy.
- Paste results use a polite live region so skipped values are announced without interrupting keyboard editing.

## Error Handling

- Paste with no active cell is ignored without changing the draft.
- Empty clipboard text is ignored.
- Clipboard rows beyond the final data column are skipped and counted.
- A first row with at least two recognized headers enters header mode; that row is skipped, imported data begins at the first camera row, and unknown header columns are skipped and reported. Rows with fewer than two recognized headers paste positionally.
- A recognized `Follow Prefix` header and all values beneath it are ignored without changing the draft's prefix-following settings.
- Invalid checkbox, viewport, and zoom values are skipped per cell and reported.
- Clipboard operations never auto-save.
- If the browser clipboard write used by **Copy Table** fails, the draft and selection remain unchanged and an inline error asks the user to select a range and use Command+C instead.

## Verification

Unit tests will cover:

- Enter, Shift+Enter, Tab, and Shift+Tab movement with complete text selection.
- Cell, rectangular, row, and column selection bounds.
- TSV serialization for each selection mode.
- Whole-table TSV serialization with the eight spreadsheet-facing headers and every draft row, excluding `Follow Prefix`.
- **Copy Table** success and clipboard-failure feedback without changing selection or saved data.
- Positional paste and automatic row growth.
- Header aliases, reordered spreadsheet columns, first-row replacement, and ignored legacy `Follow Prefix` values.
- Empty cells and CRLF normalization.
- Viewport, zoom, URL, Camera #, and Index parsing.
- Partial paste with invalid-cell reporting.
- Save and Discard behavior after paste.
- Absence of the former CSV import UI.

Browser tests will copy a selected table range, paste spreadsheet-formatted data that adds rows, verify the draft changes, save them, and confirm no page overflow at supported desktop widths.
