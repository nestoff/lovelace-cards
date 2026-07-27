import { describe, expect, it, vi } from "vitest";
import { installMainWindowShortcuts, isReloadSelectedTileShortcut } from "./shortcuts";

describe("electron shortcuts", () => {
  it("detects Command+R keydown as a selected-tile reload shortcut", () => {
    expect(
      isReloadSelectedTileShortcut({
        type: "keyDown",
        key: "r",
        meta: true
      })
    ).toBe(true);
  });

  it("ignores keyup and modified Command+R combinations", () => {
    expect(
      isReloadSelectedTileShortcut({
        type: "keyUp",
        key: "r",
        meta: true
      })
    ).toBe(false);
    expect(
      isReloadSelectedTileShortcut({
        type: "keyDown",
        key: "r",
        meta: true,
        shift: true
      })
    ).toBe(false);
  });

  it("prevents the host reload and asks the renderer to reload the selected tile", () => {
    let shortcutHandler:
      | ((
          event: { preventDefault: () => void },
          input: { type: string; key: string; meta: boolean }
        ) => void)
      | null = null;
    const webContents = {
      on: vi.fn((eventName, handler) => {
        if (eventName === "before-input-event") {
          shortcutHandler = handler;
        }
      }),
      send: vi.fn()
    };
    const mainWindow = { webContents };
    const event = { preventDefault: vi.fn() };

    installMainWindowShortcuts(mainWindow);
    shortcutHandler?.(event, { type: "keyDown", key: "r", meta: true });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(webContents.send).toHaveBeenCalledWith("ditbrowse:reload-selected-tile");
  });

  it("replaces the default app reload menu accelerator with selected-page reload", () => {
    const webContents = {
      on: vi.fn(),
      send: vi.fn()
    };
    const menuApi = {
      buildFromTemplate: vi.fn((template) => ({ template })),
      setApplicationMenu: vi.fn()
    };

    installMainWindowShortcuts({ webContents }, menuApi);

    const template = menuApi.buildFromTemplate.mock.calls[0][0];
    const viewMenu = template.find((item: { label?: string }) => item.label === "View");
    const reloadItem = viewMenu.submenu.find(
      (item: { label?: string }) => item.label === "Reload Selected Page"
    );

    expect(reloadItem).toMatchObject({
      accelerator: "CommandOrControl+R"
    });
    expect(viewMenu.submenu).not.toContainEqual(expect.objectContaining({ role: "reload" }));
    expect(menuApi.setApplicationMenu).toHaveBeenCalledWith({ template });

    reloadItem.click();

    expect(webContents.send).toHaveBeenCalledWith("ditbrowse:reload-selected-tile");
  });
});
