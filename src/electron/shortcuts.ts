import type { MenuItemConstructorOptions } from "electron";

export interface ShortcutInput {
  type?: string;
  key?: string;
  code?: string;
  meta?: boolean;
  ctrl?: boolean;
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
}

interface ShortcutEvent {
  preventDefault: () => void;
}

interface ShortcutWebContents {
  on: (
    eventName: "before-input-event",
    handler: (event: ShortcutEvent, input: ShortcutInput) => void
  ) => void;
  send: (channel: string) => void;
}

interface ShortcutWindow {
  webContents: ShortcutWebContents;
}

interface ShortcutMenuApi<TMenu> {
  buildFromTemplate: (template: MenuItemConstructorOptions[]) => TMenu;
  setApplicationMenu: (menu: TMenu) => void;
}

function sendReloadSelectedTile(mainWindow: ShortcutWindow): void {
  mainWindow.webContents.send("ditbrowse:reload-selected-tile");
}

export function isReloadSelectedTileShortcut(input: ShortcutInput): boolean {
  if (input.type !== "keyDown" || !input.meta || input.alt || input.shift) {
    return false;
  }

  const key = (input.key || input.code || "").toLowerCase();
  return key === "r" || key === "keyr";
}

export function createApplicationMenuTemplate(
  onReloadSelectedTile: () => void
): MenuItemConstructorOptions[] {
  return [
    { role: "appMenu" },
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Reload Selected Page",
          accelerator: "CommandOrControl+R",
          click: onReloadSelectedTile
        },
        { type: "separator" },
        { role: "toggleDevTools" }
      ]
    },
    { role: "windowMenu" }
  ];
}

export function installMainWindowShortcuts<TMenu>(
  mainWindow: ShortcutWindow,
  menuApi?: ShortcutMenuApi<TMenu>
): void {
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!isReloadSelectedTileShortcut(input)) {
      return;
    }

    event.preventDefault();
    sendReloadSelectedTile(mainWindow);
  });

  if (menuApi) {
    const menu = menuApi.buildFromTemplate(
      createApplicationMenuTemplate(() => sendReloadSelectedTile(mainWindow))
    );
    menuApi.setApplicationMenu(menu);
  }
}
