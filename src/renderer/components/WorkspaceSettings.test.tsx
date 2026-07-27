import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import { WorkspaceSettings } from "./WorkspaceSettings";

type WorkspaceSettingsProps = ComponentProps<typeof WorkspaceSettings>;

function createProps(
  overrides: Partial<WorkspaceSettingsProps> = {}
): WorkspaceSettingsProps {
  return {
    jobs: sampleWorkspace.jobs,
    cameraLists: sampleWorkspace.cameraLists,
    activeCameraListId: sampleWorkspace.activeCameraListId,
    activeList: sampleWorkspace.cameraLists[0],
    onSelectCameraList: vi.fn(),
    onCreateJob: vi.fn(),
    onUpdateJobName: vi.fn(),
    onDeleteJob: vi.fn(),
    credentialPresets: [],
    passwordRecords: [],
    onAddCredentialPreset: vi.fn(),
    onDeleteCredentialPreset: vi.fn(),
    onDeletePasswordRecord: vi.fn(),
    onResetSelectedScale: vi.fn(),
    onResetGridOrder: vi.fn(),
    pingIntervalSeconds: 5,
    onSetPingIntervalSeconds: vi.fn(),
    controlApiInfo: {
      host: "127.0.0.1",
      port: 54321,
      baseUrl: "http://127.0.0.1:54321",
      configuredPort: 54321,
      bindHost: "127.0.0.1",
      lanAccess: false
    },
    onSetControlApiPort: vi.fn(async () => undefined),
    onSetControlApiBindHost: vi.fn(async () => undefined),
    swp08Info: {
      enabled: false,
      host: "127.0.0.1",
      port: 8910,
      matrix: 1,
      levels: 1,
      sources: 64,
      destinations: 1,
      focusDestination: 1,
      listening: false,
      clientCount: 0
    },
    onSetSwp08Config: vi.fn(async () => undefined),
    companionModuleStatus: {
      state: "missing",
      pathSource: "companion",
      bundledVersion: "0.1.0",
      installedVersion: null,
      targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
      message: "DIT Browse Companion module is not installed.",
      canInstall: true
    },
    companionModuleBusy: false,
    companionModuleError: "",
    onRefreshCompanionModuleStatus: vi.fn(async () => undefined),
    onInstallCompanionModule: vi.fn(async () => undefined),
    onChooseAndInstallCompanionModule: vi.fn(async () => false),
    ...overrides
  };
}

describe("WorkspaceSettings", () => {
  it("creates and renames jobs from the full workspace", () => {
    const onCreateJob = vi.fn();
    const onUpdateJobName = vi.fn();
    render(
      <WorkspaceSettings
        {...createProps({ onCreateJob, onUpdateJobName })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New Job" }));
    fireEvent.change(screen.getByLabelText("New job name"), {
      target: { value: "Commercial A" }
    });
    fireEvent.change(screen.getByLabelText("New camera list name"), {
      target: { value: "Main Cameras" }
    });
    fireEvent.change(screen.getByLabelText("New default URL prefix"), {
      target: { value: "10.20.100." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Job" }));

    expect(onCreateJob).toHaveBeenCalledWith("Commercial A", "Main Cameras", "10.20.100.");

    fireEvent.change(screen.getByLabelText("Current job name"), {
      target: { value: "Commercial B" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Job Name" }));

    expect(onUpdateJobName).toHaveBeenCalledWith("Commercial B");
  });

  it("uses the shared confirmation dialog for job deletion", () => {
    const onDeleteJob = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    render(<WorkspaceSettings {...createProps({ onDeleteJob })} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Job" }));

    expect(screen.getByRole("dialog", { name: "Delete job" })).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
    expect(onDeleteJob).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete job" }));

    expect(onDeleteJob).toHaveBeenCalledWith("job-sample");
    confirm.mockRestore();
  });

  it("keeps camera session commands on the main page instead of duplicating them", () => {
    render(<WorkspaceSettings {...createProps()} />);

    expect(screen.queryByRole("button", { name: /Reload Every Camera/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign Out/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Forget Selected Tile Password" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Scale" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset Order" })).toBeVisible();
  });

  it("saves a global whole-second ping interval", () => {
    const onSetPingIntervalSeconds = vi.fn();
    render(
      <WorkspaceSettings
        {...createProps({ onSetPingIntervalSeconds })}
      />
    );

    const interval = screen.getByLabelText("Ping interval in seconds");
    fireEvent.change(interval, { target: { value: "12" } });
    expect(onSetPingIntervalSeconds).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save Interval" }));
    expect(onSetPingIntervalSeconds).toHaveBeenCalledWith(12);
  });

  it.each(["0", "2.5", "301"])(
    "rejects invalid ping interval %s",
    (value) => {
      const onSetPingIntervalSeconds = vi.fn();
      render(
        <WorkspaceSettings
          {...createProps({ onSetPingIntervalSeconds })}
        />
      );

      fireEvent.change(screen.getByLabelText("Ping interval in seconds"), {
        target: { value }
      });
      fireEvent.click(screen.getByRole("button", { name: "Save Interval" }));

      expect(onSetPingIntervalSeconds).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ping interval must be a whole number between 1 and 300 seconds."
      );
    }
  );

  it("sets and clears the local control API port", async () => {
    const onSetControlApiPort = vi.fn(async () => undefined);
    render(<WorkspaceSettings {...createProps({ onSetControlApiPort })} />);

    expect(screen.getByLabelText("Local API shortcuts")).toHaveTextContent(
      "GET /api/focus/1"
    );
    expect(screen.getByLabelText("Local API shortcuts")).toHaveTextContent("GET /api/grid");
    expect(screen.getByLabelText("Local API shortcuts")).toHaveTextContent(
      "ws://127.0.0.1:54321/api/ws"
    );

    fireEvent.change(screen.getByLabelText("API port"), {
      target: { value: "54001" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Save Port" })[0]!);

    await waitFor(() => expect(onSetControlApiPort).toHaveBeenCalledWith(54001));

    fireEvent.click(screen.getByRole("button", { name: "Auto" }));

    await waitFor(() => expect(onSetControlApiPort).toHaveBeenCalledWith(null));
  });

  it("enables the Probel SW-P-08 server", async () => {
    const onSetSwp08Config = vi.fn(async () => undefined);
    render(
      <WorkspaceSettings
        {...createProps({
          onSetSwp08Config,
          swp08Info: {
            enabled: false,
            host: "192.168.1.10",
            port: 8910,
            matrix: 1,
            levels: 1,
            sources: 64,
            destinations: 1,
            focusDestination: 1,
            listening: false,
            clientCount: 0
          }
        })}
      />
    );

    fireEvent.click(screen.getByLabelText("Enable SW-P-08 server"));
    await waitFor(() => expect(onSetSwp08Config).toHaveBeenCalledWith({ enabled: true }));

    fireEvent.change(screen.getByLabelText("SW-P-08 port"), {
      target: { value: "2008" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Save Port" })[1]!);
    await waitFor(() => expect(onSetSwp08Config).toHaveBeenCalledWith({ port: 2008 }));
  });

  it.each([
    ["missing", "Install Companion Module", false],
    ["outdated", "Update Companion Module", false],
    ["current", "Installed", true],
    ["newer", "Newer Version Installed", true],
    ["invalid", "Install Unavailable", true],
    ["not_configured", "Set Up Companion", false]
  ] as const)(
    "renders the %s Companion module state",
    (state, buttonName, disabled) => {
      const installedVersion = ["outdated", "current", "newer"].includes(state)
        ? "0.1.0"
        : null;
      render(
        <WorkspaceSettings
          {...createProps({
            companionModuleStatus: {
              state,
              pathSource: state === "not_configured" ? null : "companion",
              bundledVersion: "0.1.0",
              installedVersion,
              targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
              message: `Companion state is ${state}.`,
              canInstall: state === "missing" || state === "outdated"
            }
          })}
        />
      );

      const button = screen.getByRole("button", { name: buttonName });
      if (disabled) {
        expect(button).toBeDisabled();
      } else {
        expect(button).toBeEnabled();
      }
      expect(screen.getByLabelText("Companion module status")).toHaveTextContent(
        `Companion state is ${state}.`
      );
    }
  );

  it("runs install and refresh actions and disables installation while busy", async () => {
    const onInstallCompanionModule = vi.fn(async () => undefined);
    const onRefreshCompanionModuleStatus = vi.fn(async () => undefined);
    const { rerender } = render(
      <WorkspaceSettings
        {...createProps({
          onInstallCompanionModule,
          onRefreshCompanionModuleStatus
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Install Companion Module" }));
    fireEvent.click(screen.getByRole("button", { name: "Check Again" }));

    expect(onInstallCompanionModule).toHaveBeenCalledOnce();
    expect(onRefreshCompanionModuleStatus).toHaveBeenCalledOnce();

    rerender(
      <WorkspaceSettings
        {...createProps({
          companionModuleBusy: true,
          onInstallCompanionModule,
          onRefreshCompanionModuleStatus
        })}
      />
    );
    expect(screen.getByRole("button", { name: "Installing…" })).toBeDisabled();
  });

  it("opens setup only after Set Up Companion is clicked", async () => {
    const onChooseAndInstallCompanionModule = vi.fn(async () => false);
    render(
      <WorkspaceSettings
        {...createProps({
          companionModuleStatus: {
            state: "not_configured",
            pathSource: null,
            bundledVersion: "1.0.0",
            installedVersion: null,
            targetPath: null,
            message: "Companion developer modules are not configured.",
            canInstall: false
          },
          onChooseAndInstallCompanionModule
        })}
      />
    );

    expect(onChooseAndInstallCompanionModule).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Set Up the Companion Module" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Set Up Companion" }));
    expect(screen.getByRole("dialog", { name: "Set Up the Companion Module" })).toBeVisible();
    expect(onChooseAndInstallCompanionModule).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Choose Folder & Install" }));
    await waitFor(() => expect(onChooseAndInstallCompanionModule).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "Set Up the Companion Module" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Set Up the Companion Module" })).toBeNull();
  });

  it("offers the same setup dialog to change a manual folder", () => {
    render(
      <WorkspaceSettings
        {...createProps({
          companionModuleStatus: {
            state: "current",
            pathSource: "manual",
            bundledVersion: "1.0.0",
            installedVersion: "1.0.0",
            targetPath: "/tmp/Companion Modules/lightlab-ditbrowse",
            message: "DIT Browse Companion module 1.0.0 is installed.",
            canInstall: false
          }
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Change Folder" }));
    expect(screen.getByRole("dialog", { name: "Set Up the Companion Module" })).toBeVisible();
  });

  it("shows installer errors and reload guidance", () => {
    const { rerender } = render(
      <WorkspaceSettings
        {...createProps({ companionModuleError: "Permission denied." })}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Permission denied.");

    rerender(
      <WorkspaceSettings
        {...createProps({
          companionModuleStatus: {
            state: "current",
            pathSource: "companion",
            bundledVersion: "0.1.0",
            installedVersion: "0.1.0",
            targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
            message: "DIT Browse Companion module 0.1.0 is installed.",
            canInstall: false
          }
        })}
      />
    );
    expect(screen.getByText(/Refresh modules list/)).toBeVisible();
  });

  it("manages visible global credential presets", () => {
    const onAddCredentialPreset = vi.fn();
    const onDeleteCredentialPreset = vi.fn();
    render(
      <WorkspaceSettings
        {...createProps({
          credentialPresets: [
            {
              id: "preset-1",
              username: "admin",
              password: "ABCD1234",
              cameraType: "VENICE 2"
            }
          ],
          onAddCredentialPreset,
          onDeleteCredentialPreset
        })}
      />
    );

    expect(screen.getByLabelText("Saved credential presets")).toHaveTextContent("admin");
    expect(screen.getByLabelText("Saved credential presets")).toHaveTextContent("ABCD1234");

    fireEvent.change(screen.getByLabelText("Preset username"), {
      target: { value: "operator" }
    });
    fireEvent.change(screen.getByLabelText("Preset password"), {
      target: { value: "secret" }
    });
    fireEvent.change(screen.getByLabelText("Preset model match"), {
      target: { value: "VENICE 2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onAddCredentialPreset).toHaveBeenCalledWith("operator", "secret", "VENICE 2");

    fireEvent.click(screen.getByLabelText("Saved credential presets").querySelector("button")!);
    expect(onDeleteCredentialPreset).toHaveBeenCalledWith("preset-1");
  });

  it("shows and deletes saved camera passwords", () => {
    const onDeletePasswordRecord = vi.fn();
    render(
      <WorkspaceSettings
        {...createProps({
          passwordRecords: [
            {
              id: "password-1",
              jobId: "job-sample",
              cameraListId: "list-sample",
              cameraId: "camera-41",
              url: "http://192.168.1.41",
              username: "admin",
              password: "ABCD1234"
            }
          ],
          onDeletePasswordRecord
        })}
      />
    );

    expect(screen.getByLabelText("Saved camera passwords")).toHaveTextContent(
      "http://192.168.1.41"
    );
    expect(screen.getByLabelText("Saved camera passwords")).toHaveTextContent("ABCD1234");

    fireEvent.click(screen.getByLabelText("Saved camera passwords").querySelector("button")!);
    expect(onDeletePasswordRecord).toHaveBeenCalledWith("password-1");
  });
});
