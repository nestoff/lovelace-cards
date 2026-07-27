import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ControlApiCommand } from "../shared/controlApi";
import type { HttpAuthRequest } from "../shared/httpAuth";
import { sampleWorkspace } from "../shared/sampleData";
import { App } from "./App";

let controlApiCommandHandler: ((command: ControlApiCommand) => void) | null = null;
let reloadSelectedTileHandler: (() => void) | null = null;
let httpAuthRequestHandler: ((request: HttpAuthRequest) => void) | null = null;

class ResizeObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function workspaceAt(url: string) {
  const normalizedUrl = `http://${url}`;
  const camera = {
    ...sampleWorkspace.cameraLists[0].cameras[0],
    url: normalizedUrl,
    prefixOverride: normalizedUrl,
    usesListPrefix: false
  };
  const tile = {
    ...sampleWorkspace.tiles[0],
    cameraId: camera.id,
    url: normalizedUrl
  };
  return {
    ...sampleWorkspace,
    cameraLists: [
      {
        ...sampleWorkspace.cameraLists[0],
        cameras: [camera]
      }
    ],
    tiles: [tile],
    selectedTileId: tile.id
  };
}

function openCameraSessionMenu(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Camera Session" }));
  return screen.getByRole("menu");
}

function workspaceWithCameraPasswords() {
  return {
    ...sampleWorkspace,
    passwordRecords: [
      {
        id: "password-camera-41",
        jobId: "job-sample",
        cameraListId: "list-sample",
        cameraId: "camera-41",
        url: "http://192.168.1.01",
        username: "camera-one",
        password: "secret-one"
      },
      {
        id: "password-camera-42",
        jobId: "job-sample",
        cameraListId: "list-sample",
        cameraId: "camera-42",
        url: "http://192.168.1.02",
        username: "camera-two",
        password: "secret-two"
      }
    ]
  };
}

describe("App control API commands", () => {
  beforeEach(() => {
    controlApiCommandHandler = null;
    reloadSelectedTileHandler = null;
    httpAuthRequestHandler = null;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
    });
    window.ditbrowse = {
      version: "test",
      webviewPreloadPath: undefined,
      loadWorkspace: vi.fn(async () => sampleWorkspace),
      saveWorkspace: vi.fn(),
      getControlApiInfo: vi.fn(async () => ({
        host: "127.0.0.1",
        port: 54321,
        baseUrl: "http://127.0.0.1:54321",
        configuredPort: 54321,
        bindHost: "127.0.0.1" as const,
        lanAccess: false
      })),
      setControlApiPort: vi.fn(async (port) => ({
        host: "127.0.0.1",
        port: port ?? 54322,
        baseUrl: `http://127.0.0.1:${port ?? 54322}`,
        configuredPort: port,
        bindHost: "127.0.0.1" as const,
        lanAccess: false
      })),
      setControlApiBindHost: vi.fn(async (bindHost) => ({
        host: bindHost === "0.0.0.0" ? "192.168.1.10" : "127.0.0.1",
        port: 54321,
        baseUrl:
          bindHost === "0.0.0.0"
            ? "http://192.168.1.10:54321"
            : "http://127.0.0.1:54321",
        configuredPort: 54321,
        bindHost,
        lanAccess: bindHost === "0.0.0.0"
      })),
      getSwp08Info: vi.fn(async () => ({
        enabled: false,
        host: "127.0.0.1",
        port: 8910,
        matrix: 0,
        levels: 1,
        sources: 64,
        destinations: 1,
        focusDestination: 1,
        listening: false,
        clientCount: 0
      })),
      setSwp08Config: vi.fn(async (patch) => ({
        enabled: Boolean(patch.enabled),
        host: "127.0.0.1",
        port: patch.port ?? 8910,
        matrix: 0,
        levels: 1,
        sources: 64,
        destinations: 1,
        focusDestination: 1,
        listening: Boolean(patch.enabled),
        clientCount: 0
      })),
      onControlApiInfo: vi.fn(() => vi.fn()),
      onSwp08Info: vi.fn(() => vi.fn()),
      getCompanionModuleInstallStatus: vi.fn(async () => ({
        state: "missing" as const,
        pathSource: "companion" as const,
        bundledVersion: "0.1.0",
        installedVersion: null,
        targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
        message: "DIT Browse Companion module is not installed.",
        canInstall: true
      })),
      installCompanionModule: vi.fn(async () => ({
        outcome: "installed" as const,
        status: {
          state: "current" as const,
          pathSource: "companion" as const,
          bundledVersion: "0.1.0",
          installedVersion: "0.1.0",
          targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
          message: "DIT Browse Companion module 0.1.0 is installed.",
          canInstall: false
        }
      })),
      chooseAndInstallCompanionModule: vi.fn(async () => ({
        outcome: "installed" as const,
        status: {
          state: "current" as const,
          pathSource: "manual" as const,
          bundledVersion: "0.1.0",
          installedVersion: "0.1.0",
          targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
          message: "DIT Browse Companion module 0.1.0 is installed.",
          canInstall: false
        }
      })),
      onControlApiCommand: vi.fn((callback) => {
        controlApiCommandHandler = callback;
        return vi.fn();
      }),
      onReloadSelectedTileShortcut: vi.fn((callback) => {
        reloadSelectedTileHandler = callback;
        return vi.fn();
      }),
      sendControlApiResponse: vi.fn(),
      publishControlApiStatus: vi.fn(),
      onHttpAuthRequest: vi.fn((callback) => {
        httpAuthRequestHandler = callback;
        return vi.fn();
      }),
      sendHttpAuthResponse: vi.fn(),
      resetCameraSessionData: vi.fn(async () => undefined),
      resetListSessionData: vi.fn(async () => undefined)
    };
  });

  it("opens Help without unmounting cameras or publishing different device state", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    await waitFor(() =>
      expect(window.ditbrowse.publishControlApiStatus).toHaveBeenCalled()
    );
    const publishedBefore = vi.mocked(window.ditbrowse.publishControlApiStatus!).mock
      .calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Help" }));

    expect(screen.getByLabelText("Help Guide")).toBeVisible();
    expect(screen.queryByLabelText("Browser toolbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("webview")).toHaveLength(12);
    expect(document.querySelector(".camera-workspace")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(window.ditbrowse.publishControlApiStatus).toHaveBeenCalledTimes(
      publishedBefore
    );

    fireEvent.click(screen.getByRole("button", { name: "Close Help" }));

    expect(screen.queryByLabelText("Help Guide")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Browser toolbar")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue(
      "http://192.168.1.01"
    );
    expect(window.ditbrowse.publishControlApiStatus).toHaveBeenCalledTimes(
      publishedBefore
    );
  });

  it("mounts no sample cameras before the saved workspace is ready", async () => {
    const loading = deferred<ReturnType<typeof workspaceAt>>();
    window.ditbrowse.loadWorkspace = vi.fn(() => loading.promise);

    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    await waitFor(() => expect(window.ditbrowse.loadWorkspace).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace…");
    expect(screen.queryByLabelText("Browser toolbar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Camera tabs")).not.toBeInTheDocument();
    expect(document.querySelectorAll("webview")).toHaveLength(0);
    expect(document.body).not.toHaveTextContent("192.168.1.01");
    expect(window.ditbrowse.publishControlApiStatus).not.toHaveBeenCalled();

    loading.resolve(workspaceAt("10.20.100.109"));

    expect(await screen.findByDisplayValue("http://10.20.100.109")).toBeVisible();
    expect(document.querySelectorAll("webview")).toHaveLength(1);
    expect(document.querySelector("webview")).toHaveAttribute(
      "src",
      "http://10.20.100.109"
    );
    await waitFor(() => {
      expect(window.ditbrowse.publishControlApiStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          tabs: [expect.objectContaining({ url: "http://10.20.100.109" })]
        })
      );
    });
  });

  it("keeps webviews unmounted after a load failure and retries", async () => {
    window.ditbrowse.loadWorkspace = vi
      .fn()
      .mockRejectedValueOnce(new Error("broken workspace"))
      .mockResolvedValueOnce(workspaceAt("10.20.100.110"));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Workspace could not be loaded"
    );
    expect(document.querySelectorAll("webview")).toHaveLength(0);
    expect(screen.queryByLabelText("Browser toolbar")).not.toBeInTheDocument();
    expect(window.ditbrowse.publishControlApiStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByDisplayValue("http://10.20.100.110")).toBeVisible();
    expect(window.ditbrowse.loadWorkspace).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll("webview")).toHaveLength(1);
  });

  it("focuses a requested camera number and returns to grid from local API commands", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    await waitFor(() => expect(controlApiCommandHandler).not.toBeNull());

    act(() => {
      controlApiCommandHandler?.({ requestId: "focus-1", type: "focusCamera", cameraNumber: 2 });
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue("http://192.168.1.02");
    });
    expect(screen.getByLabelText("Show all pages")).toBeVisible();
    expect(window.ditbrowse.sendControlApiResponse).toHaveBeenCalledWith(
      "focus-1",
      expect.objectContaining({ ok: true })
    );

    act(() => {
      controlApiCommandHandler?.({ requestId: "grid-1", type: "showGrid" });
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Focus selected page")).toBeVisible();
    });
    expect(window.ditbrowse.sendControlApiResponse).toHaveBeenCalledWith(
      "grid-1",
      expect.objectContaining({
        ok: true,
        status: expect.objectContaining({ focusMode: false })
      })
    );
  });

  it("returns not_found when a requested camera number does not exist", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    await waitFor(() => expect(controlApiCommandHandler).not.toBeNull());

    act(() => {
      controlApiCommandHandler?.({ requestId: "missing-1", type: "focusCamera", cameraNumber: 99 });
    });

    await waitFor(() => {
      expect(window.ditbrowse.sendControlApiResponse).toHaveBeenCalledWith("missing-1", {
        ok: false,
        error: "not_found",
        message: "No camera number matches 99"
      });
    });
  });

  it("locks the grid and makes camera focus a successful no-op while expansion is off", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    await waitFor(() => expect(controlApiCommandHandler).not.toBeNull());

    act(() => {
      controlApiCommandHandler?.({ requestId: "focus-2", type: "focusCamera", cameraNumber: 2 });
    });
    await screen.findByDisplayValue("http://192.168.1.02");
    expect(screen.getByLabelText("Show all pages")).toBeVisible();

    act(() => {
      controlApiCommandHandler?.({ requestId: "expansion-off", type: "toggleExpansion" });
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Focus selected page")).toBeDisabled();
    });

    act(() => {
      controlApiCommandHandler?.({ requestId: "blocked-focus", type: "focusCamera", cameraNumber: 3 });
    });

    expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue(
      "http://192.168.1.02"
    );
    expect(window.ditbrowse.sendControlApiResponse).toHaveBeenCalledWith(
      "blocked-focus",
      expect.objectContaining({
        ok: true,
        status: expect.objectContaining({ expansionEnabled: false, focusMode: false })
      })
    );
  });

  it("publishes complete control status after workspace hydration", async () => {
    render(<App />);

    await waitFor(() => {
      expect(window.ditbrowse.publishControlApiStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          expansionEnabled: true,
          focusMode: false,
          selectedCameraNumber: 1
        })
      );
    });
  });

  it("loads Companion module status when workspace settings opens", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    expect(window.ditbrowse.getCompanionModuleInstallStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));

    await waitFor(() => {
      expect(window.ditbrowse.getCompanionModuleInstallStatus).toHaveBeenCalledOnce();
    });
  });

  it("installs the Companion module from workspace settings", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Install Companion Module" })
    );

    await waitFor(() => {
      expect(window.ditbrowse.installCompanionModule).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole("button", { name: "Installed" })).toBeDisabled();
  });

  it("opens Companion folder setup only after the user requests it", async () => {
    vi.mocked(window.ditbrowse.getCompanionModuleInstallStatus!).mockResolvedValue({
      state: "not_configured",
      pathSource: null,
      bundledVersion: "0.1.0",
      installedVersion: null,
      targetPath: null,
      message: "Companion developer modules are not configured.",
      canInstall: false
    });
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    expect(window.ditbrowse.chooseAndInstallCompanionModule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));

    const setupButton = await screen.findByRole("button", { name: "Set Up Companion" });
    expect(window.ditbrowse.chooseAndInstallCompanionModule).not.toHaveBeenCalled();
    fireEvent.click(setupButton);
    expect(
      screen.getByRole("dialog", { name: "Set Up the Companion Module" })
    ).toBeVisible();
    expect(window.ditbrowse.chooseAndInstallCompanionModule).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Choose Folder & Install" }));
    await waitFor(() => {
      expect(window.ditbrowse.chooseAndInstallCompanionModule).toHaveBeenCalledOnce();
    });
    expect(await screen.findByRole("button", { name: "Installed" })).toBeDisabled();
    expect(
      screen.queryByRole("dialog", { name: "Set Up the Companion Module" })
    ).toBeNull();
  });

  it("reloads only the selected webview from the host Command+R shortcut", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");

    const selectedWebview = document.querySelector(
      'webview[data-tile-id="tile-41"]'
    ) as Electron.WebviewTag;
    const otherWebview = document.querySelector(
      'webview[data-tile-id="tile-42"]'
    ) as Electron.WebviewTag;
    selectedWebview.reload = vi.fn();
    selectedWebview.loadURL = vi.fn(async () => undefined);
    selectedWebview.getURL = vi.fn(() => "http://192.168.1.01/rmt.html");
    otherWebview.reload = vi.fn();
    otherWebview.loadURL = vi.fn(async () => undefined);
    otherWebview.getURL = vi.fn(() => "http://192.168.1.02/index.html");

    act(() => {
      reloadSelectedTileHandler?.();
    });

    expect(selectedWebview.loadURL).toHaveBeenCalledWith("http://192.168.1.01");
    expect(selectedWebview.reload).not.toHaveBeenCalled();
    expect(otherWebview.loadURL).not.toHaveBeenCalled();
    expect(otherWebview.reload).not.toHaveBeenCalled();
    expect(window.ditbrowse.resetCameraSessionData).not.toHaveBeenCalled();
    expect(window.ditbrowse.resetListSessionData).not.toHaveBeenCalled();
  });

  it("keeps the Camera Session reload selected action non-destructive", async () => {
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    const selectedWebview = document.querySelector(
      'webview[data-tile-id="tile-41"]'
    ) as Electron.WebviewTag;
    selectedWebview.loadURL = vi.fn(async () => undefined);
    selectedWebview.getURL = vi.fn(() => "http://192.168.1.01/rmt.html");

    const sessionMenu = openCameraSessionMenu();
    fireEvent.click(
      within(sessionMenu).getByRole("menuitem", { name: "Reload selected" })
    );

    expect(selectedWebview.loadURL).toHaveBeenCalledWith("http://192.168.1.01");
    expect(window.ditbrowse.resetCameraSessionData).not.toHaveBeenCalled();
    expect(window.ditbrowse.resetListSessionData).not.toHaveBeenCalled();
  });

  it("saves the selected live URL to the selected camera only when requested", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");

    const saveButton = screen.getByRole("button", { name: "Save current URL to camera list" });
    expect(saveButton).toBeDisabled();

    const selectedWebview = document.querySelector(
      'webview[data-tile-id="tile-41"]'
    ) as Electron.WebviewTag;
    fireEvent(
      selectedWebview,
      Object.assign(new Event("did-navigate"), {
        url: "http://10.20.100.107/index.html",
        isMainFrame: true
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue(
        "http://10.20.100.107/index.html"
      );
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });

  it("answers camera HTTP auth challenges with saved credentials", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
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
    }));

    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-1",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80,
        realm: "Please enter your ID and password.",
        scheme: "digest",
        isProxy: false
      });
    });

    await waitFor(() => {
      expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith("auth-1", {
        username: "admin",
        password: "secret"
      });
    });
    expect(screen.queryByRole("dialog", { name: "Camera sign in" })).not.toBeInTheDocument();
  });

  it("routes HTTP auth to the originating camera guest before origin or selection", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => workspaceWithCameraPasswords());
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    const cameraTwoWebview = document.querySelector(
      'webview[data-tile-id="tile-42"]'
    ) as Electron.WebviewTag;
    cameraTwoWebview.getWebContentsId = vi.fn(() => 4242);

    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-guest-priority",
        webContentsId: 4242,
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80
      });
    });

    await waitFor(() => {
      expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith(
        "auth-guest-priority",
        { username: "camera-two", password: "secret-two" }
      );
    });
  });

  it("falls back from an unknown guest to the matching camera origin", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => workspaceWithCameraPasswords());
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-origin-fallback",
        webContentsId: 9999,
        url: "http://192.168.1.02/login",
        host: "192.168.1.02",
        port: 80
      });
    });

    await waitFor(() => {
      expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith(
        "auth-origin-fallback",
        { username: "camera-two", password: "secret-two" }
      );
    });
  });

  it("uses the selected camera only when guest and origin cannot be matched", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => workspaceWithCameraPasswords());
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-selected-fallback",
        webContentsId: 9999,
        url: "http://unknown-camera.local/login",
        host: "unknown-camera.local",
        port: 80
      });
    });

    await waitFor(() => {
      expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith(
        "auth-selected-fallback",
        { username: "camera-one", password: "secret-one" }
      );
    });
  });

  it("prompts for camera HTTP auth credentials when none are saved", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-2",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80,
        realm: "Please enter your ID and password.",
        scheme: "digest",
        isProxy: false
      });
    });

    expect(await screen.findByRole("dialog", { name: "Camera sign in" })).toHaveClass(
      "dialog-surface"
    );
    expect(screen.getByRole("button", { name: "Sign In" })).toHaveClass("button-primary");
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "operator" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith("auth-2", {
      username: "operator",
      password: "pw"
    });
  });

  it("signs in from a paired saved login without exposing password text", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
      ...sampleWorkspace,
      credentialPresets: [
        {
          id: "preset-1",
          username: "admin",
          password: "ABCD1234",
          cameraType: ""
        },
        {
          id: "preset-2",
          username: "operator",
          password: "EFGH5678",
          cameraType: ""
        }
      ]
    }));

    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-3",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80,
        realm: "Please enter your ID and password.",
        scheme: "digest",
        isProxy: false
      });
    });

    const suggestions = await screen.findByLabelText("Saved credential suggestions");
    expect(suggestions).not.toHaveTextContent("ABCD1234");
    expect(suggestions).not.toHaveTextContent("EFGH5678");
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");

    fireEvent.click(
      within(suggestions).getByRole("button", {
        name: "Use saved login · operator & Sign In"
      })
    );

    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledTimes(1);
    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith("auth-3", {
      username: "operator",
      password: "EFGH5678"
    });
    expect(screen.queryByRole("dialog", { name: "Camera sign in" })).not.toBeInTheDocument();
  });

  it("recommends the matching camera login and saves it with one click", async () => {
    const cameraTypedWorkspace = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) => ({
        ...list,
        cameras: list.cameras.map((camera) =>
          camera.id === "camera-41" ? { ...camera, cameraType: "VENICE 2" } : camera
        )
      }))
    };

    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
      ...cameraTypedWorkspace,
      credentialPresets: [
        {
          id: "preset-other",
          username: "operator",
          password: "OTHER5678",
          cameraType: "BURANO"
        },
        {
          id: "preset-1",
          username: "admin",
          password: "ABCD1234",
          cameraType: "VENICE 2"
        }
      ]
    }));

    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-4",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80,
        realm: "Please enter your ID and password.",
        scheme: "digest",
        isProxy: false
      });
    });

    const suggestions = await screen.findByLabelText("Saved credential suggestions");
    const actions = within(suggestions).getAllByRole("button");
    expect(actions[0]).toHaveAccessibleName("Use VENICE 2 login & Sign In");
    expect(actions[0]).toHaveClass("http-auth-preset-recommended");
    expect(suggestions).not.toHaveTextContent("ABCD1234");
    expect(screen.getByLabelText("Username")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");

    fireEvent.click(actions[0]);

    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledTimes(1);
    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith("auth-4", {
      username: "admin",
      password: "ABCD1234"
    });

    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));
    await screen.findByRole("button", { name: "Install Companion Module" });
    expect(screen.getByLabelText("Saved camera passwords")).toHaveTextContent(
      "ABCD1234"
    );
  });

  it("does not save a paired login when Save for this camera is unchecked", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
      ...sampleWorkspace,
      credentialPresets: [
        {
          id: "preset-1",
          username: "admin",
          password: "ABCD1234",
          cameraType: ""
        }
      ]
    }));

    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");
    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-unsaved-preset",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80
      });
    });

    fireEvent.click(await screen.findByLabelText("Save for this camera"));
    fireEvent.click(
      screen.getByRole("button", { name: "Use saved login · admin & Sign In" })
    );

    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith(
      "auth-unsaved-preset",
      { username: "admin", password: "ABCD1234" }
    );
    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));
    await screen.findByRole("button", { name: "Install Companion Module" });
    expect(screen.queryByLabelText("Saved camera passwords")).not.toBeInTheDocument();
  });

  it("queues simultaneous HTTP auth prompts without overwriting either request", async () => {
    render(<App />);

    await screen.findByDisplayValue("http://192.168.1.01");
    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-queue-1",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80
      });
      httpAuthRequestHandler?.({
        requestId: "auth-queue-2",
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
      "auth-queue-1",
      { username: "admin", password: "one" }
    );
    expect(await screen.findByText("192.168.1.02")).toBeVisible();
  });

  it("answers only the expected queued prompt when a preset action fires twice", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
      ...sampleWorkspace,
      credentialPresets: [
        {
          id: "preset-1",
          username: "admin",
          password: "ABCD1234",
          cameraType: ""
        }
      ]
    }));
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-double-1",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80
      });
      httpAuthRequestHandler?.({
        requestId: "auth-double-2",
        url: "http://192.168.1.02/",
        host: "192.168.1.02",
        port: 80
      });
    });

    const firstAction = await screen.findByRole("button", {
      name: "Use saved login · admin & Sign In"
    });
    act(() => {
      firstAction.click();
      firstAction.click();
    });

    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledTimes(1);
    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledWith(
      "auth-double-1",
      { username: "admin", password: "ABCD1234" }
    );
    expect(await screen.findByText("192.168.1.02")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Use saved login · admin & Sign In" })
    );
    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenCalledTimes(2);
    expect(window.ditbrowse.sendHttpAuthResponse).toHaveBeenLastCalledWith(
      "auth-double-2",
      { username: "admin", password: "ABCD1234" }
    );
  });

  it("forgets the selected saved login and requires a fresh sign in after sign-out", async () => {
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
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    const webview = document.querySelector(
      'webview[data-tile-id="tile-41"]'
    ) as Electron.WebviewTag;
    webview.stop = vi.fn();
    webview.executeJavaScript = vi.fn(async () => undefined);
    webview.loadURL = vi.fn(async () => undefined);

    const sessionMenu = openCameraSessionMenu();
    fireEvent.click(
      within(sessionMenu).getByRole("menuitem", {
        name: "Sign out, forget login & reload selected"
      })
    );
    await waitFor(() => {
      expect(webview.loadURL).toHaveBeenCalledWith("http://192.168.1.01/");
    });

    act(() => {
      httpAuthRequestHandler?.({
        requestId: "auth-after-reset",
        url: "http://192.168.1.01/",
        host: "192.168.1.01",
        port: 80
      });
    });

    const signInDialog = await screen.findByRole("dialog", { name: "Camera sign in" });
    expect(signInDialog).toBeVisible();
    expect(within(signInDialog).getByLabelText("Username")).toHaveValue("");
    expect(within(signInDialog).getByLabelText("Password")).toHaveValue("");
    expect(window.ditbrowse.sendHttpAuthResponse).not.toHaveBeenCalledWith(
      "auth-after-reset",
      expect.anything()
    );
  });

  it("forgets only active-list logins and reloads each open camera", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) => ({
        ...list,
        cameras: list.cameras.slice(0, 2)
      })),
      tiles: sampleWorkspace.tiles.slice(0, 2),
      credentialPresets: [
        {
          id: "preset-venice",
          username: "admin",
          password: "preset-secret",
          cameraType: "VENICE 2"
        }
      ],
      passwordRecords: [
        {
          id: "active-one",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-41",
          url: "http://192.168.1.01",
          username: "admin",
          password: "active-secret-one"
        },
        {
          id: "active-two",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-42",
          url: "http://192.168.1.02",
          username: "admin",
          password: "active-secret-two"
        },
        {
          id: "other-list",
          jobId: "job-other",
          cameraListId: "list-other",
          cameraId: "camera-other",
          url: "http://10.20.30.40",
          username: "other",
          password: "other-secret"
        }
      ]
    }));
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    const webviews = Array.from(document.querySelectorAll("webview")) as Electron.WebviewTag[];
    webviews.forEach((webview) => {
      webview.stop = vi.fn();
      webview.executeJavaScript = vi.fn(async () => undefined);
      webview.loadURL = vi.fn(async () => undefined);
    });

    const sessionMenu = openCameraSessionMenu();
    fireEvent.click(
      within(sessionMenu).getByRole("menuitem", {
        name: "Sign out, forget active-list logins & reload all…"
      })
    );
    const confirmation = screen.getByRole("dialog", {
      name: "Sign out, forget logins, and reload every camera?"
    });
    expect(confirmation).toBeVisible();
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Sign Out & Reload All" })
    );

    await waitFor(() => {
      expect(window.ditbrowse.resetListSessionData).toHaveBeenCalledWith(
        "persist:ditbrowse-job-sample-list-sample"
      );
      expect(webviews[0].loadURL).toHaveBeenCalledWith("http://192.168.1.01/");
      expect(webviews[1].loadURL).toHaveBeenCalledWith("http://192.168.1.02/");
    });

    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));
    await screen.findByRole("button", { name: "Install Companion Module" });
    expect(screen.getByLabelText("Saved camera passwords")).toHaveTextContent(
      "other-secret"
    );
    expect(screen.getByLabelText("Saved camera passwords")).not.toHaveTextContent(
      "active-secret-one"
    );
    expect(screen.getByLabelText("Saved credential presets")).toHaveTextContent(
      "preset-secret"
    );
  });

  it("keeps the page loaded when camera session cleanup fails", async () => {
    window.ditbrowse.loadWorkspace = vi.fn(async () => ({
      ...sampleWorkspace,
      passwordRecords: [
        {
          id: "password-camera-41",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-41",
          url: "http://192.168.1.01",
          username: "admin",
          password: "retained-secret"
        }
      ]
    }));
    window.ditbrowse.resetCameraSessionData = vi.fn(async () => {
      throw new Error("clear failed");
    });
    render(<App />);
    await screen.findByDisplayValue("http://192.168.1.01");

    const webview = document.querySelector(
      'webview[data-tile-id="tile-41"]'
    ) as Electron.WebviewTag;
    webview.stop = vi.fn();
    webview.executeJavaScript = vi.fn(async () => undefined);
    webview.loadURL = vi.fn(async () => undefined);

    const sessionMenu = openCameraSessionMenu();
    fireEvent.click(
      within(sessionMenu).getByRole("menuitem", {
        name: "Sign out, forget login & reload selected"
      })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("clear failed");
    expect(webview.loadURL).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));
    await screen.findByRole("button", { name: "Install Companion Module" });
    expect(screen.getByLabelText("Saved camera passwords")).toHaveTextContent(
      "retained-secret"
    );
  });
});
