# DITBrowse Operator Help Guide Design

## Goal

Create a concise, brand-neutral help guide that helps a first-time DITBrowse operator understand the main workspace, configure cameras, and manage camera logins without needing prior knowledge of the application. The guide is a bundled, wiki-style page inside DITBrowse and works without GitHub or an internet connection.

The documentation centers on three tasks:

1. Understand every control visible on the main workspace.
2. Build and verify a camera list.
3. Configure, use, and reset saved camera credentials safely.

## Audience and voice

The primary reader is an operator setting up DITBrowse for a job. The guide assumes the reader understands basic IP networking but does not assume a particular camera manufacturer, camera web interface, or existing familiarity with DITBrowse.

Copy uses short steps, plain verbs, and the exact labels shown in the application. Brand-specific examples and terminology are excluded.

## Guide structure

### Quick Start

The opening section provides:

- A one-paragraph description of DITBrowse.
- A short setup sequence linking to Main Page Controls, Camera Setup, and Passwords and Sign-In.
- A compact overview still of the main camera workspace.

### Main Page Controls

This section explains every interactive control visible on the normal camera workspace. It is organized in the same left-to-right order as the interface and states whether each action affects the selected camera, opens a separate view, or affects every camera.

#### Tabs and workspace actions

- Camera tab: selects that camera without reloading it; dragging a tab changes its tab and grid order.
- Close tab: removes the camera from the open grid without deleting its saved camera-list row.
- Add tile: opens a new blank camera browser tile.
- **Help**: opens the bundled Help tab.
- **Camera List**: opens camera-list editing and Workspace Settings.

#### Navigation and address controls

- **Back** and **Forward**: navigate only the selected camera's page history.
- **Camera Session**: opens safe reload and destructive sign-out actions; the existing menu still documents each action separately.
- **Address**: shows and edits the live URL for the selected camera.
- **Open address**: loads the entered address in the selected camera.
- **Open address in new tile**: loads the entered address in a new blank tile.
- **Save current URL to camera list**: saves a changed live address to the selected camera row and remains disabled when there is no unsaved address change.
- **Use list address**: appears only after the selected camera is using a full-address override and restores the shared prefix plus camera-number addressing style.

#### Layout, zoom, and resolution controls

- **Focus selected page** / **Show all pages**: switches between one enlarged camera and the complete grid without reloading webviews. It remains disabled when no camera is selected or Companion expansion mode is off.
- **Cols**: sets the number of grid columns for all open cameras.
- Selected-camera zoom slider: changes only the selected camera's zoom.
- Selected zoom percentage: allows a precise value; double-clicking its percentage control resets the selected camera to 100 percent.
- **All**: opens global relative-zoom controls for every camera.
- **All relative** slider and percentage: adjust every camera relative to its own saved zoom; double-clicking the percentage control resets the global relative factor to 100 percent.
- **Resolution**: changes the selected camera's viewport resolution.
- **Apply to All**: copies the selected resolution to every open camera. Resolution and Apply to All remain disabled when there is no selected camera viewport.

Each control explanation includes its visible label or accessible tooltip name, a one-sentence outcome, its scope, and its disabled or conditional state when applicable.

### Camera Setup

The Camera Setup page documents this workflow in order:

1. Open **Camera List**.
2. Create or select a job and camera list.
3. Set the list's shared URL prefix.
4. Add camera rows or set the camera count.
5. Enter each camera's positive integer camera number.
6. Choose whether a camera follows the shared prefix or uses a full URL.
7. Optionally enter camera type, lens, and display note metadata.
8. Optionally set per-camera resolution and zoom overrides.
9. Save changes.
10. Confirm each camera appears in the grid and that its camera number is centered in the tile header.

The page explains that a camera following the list prefix combines the prefix with a normalized two-digit network suffix derived from the integer camera number. The displayed camera identity remains the normal integer value. The guide tells the operator to verify the resolved **Full URL** before saving and explains when to disable **Follow Prefix** and enter a full URL for a different addressing scheme.

### Passwords and Sign-In

The Passwords and Sign-In page documents:

- Adding a global password preset with username, password, and optional camera-type match.
- Responding to the camera authentication prompt manually.
- Using the recommended paired **Use … login & Sign In** action.
- How **Save for this camera** scopes a saved login to that camera in the active job/list.
- The difference between safe **Reload** actions and destructive **Sign out, forget login & reload** actions in the **Camera Session** menu.
- Deleting an individual saved camera password from Settings.
- Why password presets remain available after camera-specific sign-out.

No screenshot, example, caption, or prose may expose a real production password.

### Troubleshooting

The Troubleshooting page covers only setup and password problems:

- Camera tile remains blank.
- Camera opens at the wrong address.
- Camera number produces the wrong suffix.
- A camera needs a full URL instead of the shared prefix.
- Authentication prompt keeps returning.
- Wrong login was saved for a camera.
- Password preset is not recommended for the expected camera.
- Sign-out cleared a saved login intentionally.

Each entry follows a symptom, likely cause, and corrective action format.

## Still-image plan

Fresh stills are captured directly from the current DITBrowse interface using a sanitized example workspace. They are not reconstructed mockups. Images use generic camera names and documentation-only addresses. Password fields are blank or masked; no real credential value is displayed.

Required stills:

1. Main camera workspace with numbered tile headers.
2. Compact main tab row showing camera tabs, close tab, add tile, Help, and Camera List.
3. Compact navigation/address toolbar showing Back, Forward, Camera Session, Address, open address, open in new tile, save current URL, and the conditional Use list address action.
4. Compact layout toolbar showing focus/grid, columns, selected zoom, precise percentage/reset, the open All relative-zoom panel and its percentage/reset, Resolution, and Apply to All.
5. Camera List editor showing the shared list prefix and camera rows.
6. Camera row details showing Camera #, Follow Prefix, Full URL, Type, Lens, and Display Note.
7. Workspace Settings showing Password Presets and Saved Camera Passwords without secret values.
8. Camera sign-in dialog showing the paired saved-login action and Save checkbox.
9. Camera Session menu showing safe reload and destructive sign-out actions.

The three Main Page Controls captures use the installed app's real tab and toolbar components. Dense controls are split across compact crops instead of shrinking one wide toolbar until its labels become unreadable. A conditional navigation capture intentionally puts one sanitized camera on a full-URL override so **Use list address** is visible without modifying production workspace data.

Stills are cropped to the relevant interface region when that improves readability. Captions explain what the reader should notice rather than repeating the heading.

Every instructional still receives a restrained annotation layer after capture:

- Clear arrows terminate at the exact live control or field being discussed.
- Numbered markers establish reading order and match numbered caption items below the image.
- Markers and arrows use high-contrast neutral white and gray styling that remains readable against the dark interface.
- Red is reserved for destructive sign-out, forgetting, or deletion actions; blue accents are not introduced.
- Annotations remain outside important labels and values whenever space permits and never obscure the target control.
- Callout wording uses the exact label visible in the captured application.
- Each annotated result is compared side by side with the unmodified capture to confirm that the interface remains an accurate representation of the current app.

Both the unmodified source capture and the publication-ready annotated image are retained so annotations can be updated when the interface changes.

## Screenshot privacy and data rules

- Use addresses reserved for documentation, such as the `192.0.2.0/24` range.
- Use neutral camera labels such as Camera 1 and Camera 2.
- Use generic camera types such as `Studio Camera` only when demonstrating type matching.
- Do not use production job names, saved URLs, usernames, or passwords.
- Do not show a plaintext password in Settings or authentication suggestions.
- Review every image at original resolution before it is included in the app.

## In-app Help page

DITBrowse gains a **Help** button in the main tab row beside **Camera List**. Activating it selects a temporary **Help** tab and replaces the camera grid with a complete, wiki-style Help page inside the main application window. It does not open GitHub, the system browser, a floating dialog, or a separate window.

The Help tab provides:

- A clear **Help Guide** title and a closable **Help** tab in the existing tab row.
- A compact navigation column for Quick Start, Main Page Controls, Camera Setup, Passwords and Sign-In, and Troubleshooting.
- A scrollable reading area with headings, steps, captions, and annotated stills.
- Anchor-style section navigation that behaves like a small local documentation website.
- Keyboard and focus behavior consistent with the camera tabs.
- Responsive sizing so text and annotations remain legible without stretching the guide edge to edge on a large display.

The Help tab is transient interface state. It is never saved as a camera, never appears in the camera list, does not change the selected camera, and does not affect Companion status. Closing Help returns the operator to the camera or grid view that was active before Help opened.

The complete guide, styles, and image assets are packaged with the application. Opening or reading Help never requires internet access or an external account.

## Content architecture

The implementation keeps one canonical set of guide content and annotated images in the application repository. The renderer consumes that content at build time and presents it as native React content styled like a documentation website.

Guide content is data-only and does not execute arbitrary HTML. Each section declares its title, ordered steps, control-reference entries, troubleshooting entries, image, alternative text, caption, and numbered callouts. Each Main Page Controls entry declares its label, outcome, scope (`selected camera`, `all cameras`, or `workspace`), and optional availability note. The in-app component renders those fields natively.

The canonical help assets are versioned with the application. A UI change that affects a documented control requires updating its source capture, annotated still, and associated guide content in the same change.

## Verification

Before release:

- Verify every application label matches v0.1.1.
- Compare every annotated still with a fresh capture of the installed app.
- Confirm each arrow terminates at the correct control and each marker matches its caption item.
- Confirm the Main Page Controls reference includes every normal workspace control listed in this specification exactly once.
- Confirm the captions distinguish selected-camera actions from all-camera actions and explain disabled or conditional states.
- Verify all section-navigation links and image paths.
- Confirm every required still renders in the packaged Help page.
- Inspect each still at original resolution for credentials or production data.
- Build the packaged application and confirm the Help Guide works with networking disabled.
- Confirm the Help tab is keyboard accessible, scrollable, and readable at the application's minimum supported window size.
- Confirm opening, navigating, and closing Help does not change the workspace, camera selection, saved credentials, or Companion status.
- Read the complete in-app guide once in task order as a first-time operator.

After packaging:

- Launch the built app from `/Applications` and open every Help section.
- Confirm the clean and annotated stills in the package match the reviewed source assets.

## Out of scope

- Camera-manufacturer-specific setup instructions.
- Detailed Companion module documentation.
- Network engineering beyond shared prefix and camera-address examples.
- Developer architecture, API, source-build, and release-process documentation.
- Camera-manufacturer login screens beyond the generic authentication prompt already presented by DITBrowse.
- A GitHub Wiki or any externally hosted copy of the guide.
