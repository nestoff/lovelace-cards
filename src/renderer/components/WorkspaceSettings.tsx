import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { Download, ListRestart, Maximize2, RotateCcw, Trash2 } from "lucide-react";
import type { ControlApiBindHost, ControlApiInfo } from "../../shared/controlApi";
import type { CompanionModuleInstallStatus } from "../../shared/companionModule";
import type { Swp08Config, Swp08Info } from "../../shared/swp08Config";
import {
  MAX_HOST_PING_INTERVAL_SECONDS,
  MIN_HOST_PING_INTERVAL_SECONDS
} from "../../shared/hostPing";
import type {
  CameraList,
  CredentialPreset,
  Job,
  PasswordRecord
} from "../../shared/types";
import { JobListSelector } from "./JobListSelector";
import { Swp08SetupGuide } from "./Swp08SetupGuide";
import { Button } from "./ui/Button";
import { CompanionModuleSetupDialog } from "./CompanionModuleSetupDialog";

export interface WorkspaceSettingsProps {
  jobs: Job[];
  cameraLists: CameraList[];
  activeCameraListId: string | null;
  activeList: CameraList | null;
  onSelectCameraList: (cameraListId: string) => void;
  onCreateJob: (jobName: string, listName: string, defaultPrefix: string) => void;
  onUpdateJobName: (jobName: string) => void;
  onDeleteJob: (jobId: string) => void;
  credentialPresets: CredentialPreset[];
  passwordRecords: PasswordRecord[];
  onAddCredentialPreset: (
    username: string,
    password: string,
    cameraType?: string
  ) => void;
  onDeleteCredentialPreset: (presetId: string) => void;
  onDeletePasswordRecord: (passwordRecordId: string) => void;
  onResetSelectedScale: () => void;
  onResetGridOrder: () => void;
  pingIntervalSeconds: number;
  onSetPingIntervalSeconds: (seconds: number) => void;
  controlApiInfo: ControlApiInfo | null;
  onSetControlApiPort: (port: number | null) => Promise<void>;
  onSetControlApiBindHost: (bindHost: ControlApiBindHost) => Promise<void>;
  swp08Info: Swp08Info | null;
  onSetSwp08Config: (patch: Partial<Swp08Config>) => Promise<void>;
  companionModuleStatus: CompanionModuleInstallStatus | null;
  companionModuleBusy: boolean;
  companionModuleError: string;
  onRefreshCompanionModuleStatus: () => Promise<void>;
  onInstallCompanionModule: () => Promise<void>;
  onChooseAndInstallCompanionModule: () => Promise<boolean>;
}

function companionInstallButtonLabel(
  status: CompanionModuleInstallStatus | null,
  busy: boolean
): string {
  if (busy) {
    return "Installing…";
  }
  switch (status?.state) {
    case "missing":
      return "Install Companion Module";
    case "outdated":
      return "Update Companion Module";
    case "current":
      return "Installed";
    case "newer":
      return "Newer Version Installed";
    case "not_configured":
      return "Set Up Companion";
    default:
      return "Install Unavailable";
  }
}

export function WorkspaceSettings({
  jobs,
  cameraLists,
  activeCameraListId,
  activeList,
  onSelectCameraList,
  onCreateJob,
  onUpdateJobName,
  onDeleteJob,
  credentialPresets,
  passwordRecords,
  onAddCredentialPreset,
  onDeleteCredentialPreset,
  onDeletePasswordRecord,
  onResetSelectedScale,
  onResetGridOrder,
  pingIntervalSeconds,
  onSetPingIntervalSeconds,
  controlApiInfo,
  onSetControlApiPort,
  onSetControlApiBindHost,
  swp08Info,
  onSetSwp08Config,
  companionModuleStatus,
  companionModuleBusy,
  companionModuleError,
  onRefreshCompanionModuleStatus,
  onInstallCompanionModule,
  onChooseAndInstallCompanionModule
}: WorkspaceSettingsProps): ReactElement {
  const [portDraft, setPortDraft] = useState("");
  const [portError, setPortError] = useState("");
  const [swp08PortDraft, setSwp08PortDraft] = useState("8910");
  const [swp08Error, setSwp08Error] = useState("");
  const [pingIntervalDraft, setPingIntervalDraft] = useState(
    String(pingIntervalSeconds)
  );
  const [pingIntervalError, setPingIntervalError] = useState("");
  const [presetUsername, setPresetUsername] = useState("");
  const [presetPassword, setPresetPassword] = useState("");
  const [presetCameraType, setPresetCameraType] = useState("");
  const [companionSetupOpen, setCompanionSetupOpen] = useState(false);

  useEffect(() => {
    setPortDraft(controlApiInfo?.configuredPort ? String(controlApiInfo.configuredPort) : "");
    setPortError(controlApiInfo?.error ?? "");
  }, [controlApiInfo]);

  useEffect(() => {
    setSwp08PortDraft(String(swp08Info?.port ?? 8910));
    setSwp08Error(swp08Info?.error ?? "");
  }, [swp08Info]);

  useEffect(() => {
    setPingIntervalDraft(String(pingIntervalSeconds));
    setPingIntervalError("");
  }, [pingIntervalSeconds]);

  const savePort = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = portDraft.trim();
    const parsedPort = trimmed ? Number(trimmed) : null;

    if (
      parsedPort !== null &&
      (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535)
    ) {
      setPortError("Port must be an integer between 1 and 65535.");
      return;
    }

    try {
      setPortError("");
      await onSetControlApiPort(parsedPort);
    } catch (error) {
      setPortError(error instanceof Error ? error.message : "Could not set API port.");
    }
  };

  const addPreset = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onAddCredentialPreset(presetUsername, presetPassword, presetCameraType);
    setPresetUsername("");
    setPresetPassword("");
    setPresetCameraType("");
  };

  const savePingInterval = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const seconds = Number(pingIntervalDraft.trim());
    if (
      !Number.isInteger(seconds) ||
      seconds < MIN_HOST_PING_INTERVAL_SECONDS ||
      seconds > MAX_HOST_PING_INTERVAL_SECONDS
    ) {
      setPingIntervalError(
        `Ping interval must be a whole number between ${MIN_HOST_PING_INTERVAL_SECONDS} and ${MAX_HOST_PING_INTERVAL_SECONDS} seconds.`
      );
      return;
    }

    setPingIntervalError("");
    onSetPingIntervalSeconds(seconds);
  };

  return (
    <section className="workspace-settings" aria-label="Camera workspace settings">
      <header className="workspace-settings-header">
        <div>
          <span>Workspace</span>
          <h3>Settings</h3>
        </div>
        <p>Jobs, passwords, and local control.</p>
      </header>

      <div className="workspace-settings-section workspace-job-section">
        <div className="tools-section-header">
          <span>Job and camera list</span>
          <strong>{activeList?.name ?? "No camera list"}</strong>
        </div>
        <JobListSelector
          jobs={jobs}
          cameraLists={cameraLists}
          activeCameraListId={activeCameraListId}
          activeList={activeList}
          onSelectCameraList={onSelectCameraList}
          onCreateJob={onCreateJob}
          onUpdateJobName={onUpdateJobName}
          onDeleteJob={onDeleteJob}
        />
      </div>

      <div className="workspace-settings-section">
        <div className="tools-section-header">
          <span>Camera commands</span>
          <strong>{activeList?.cameras.length ?? 0}</strong>
        </div>
        <div className="tools-actions workspace-command-grid">
          <Button
            className="tool-command"
            variant="ghost"
            size="compact"
            icon={<Maximize2 size={15} strokeWidth={2.2} />}
            tooltip={{
              title: "Reset selected scaling",
              description: "Returns the selected camera's saved zoom and viewport to list defaults."
            }}
            onClick={onResetSelectedScale}
          >
            Reset Scale
          </Button>
          <Button
            className="tool-command"
            variant="ghost"
            size="compact"
            icon={<ListRestart size={15} strokeWidth={2.2} />}
            tooltip={{
              title: "Reset camera order",
              description: "Restores open tabs and grid tiles to the saved camera-list order."
            }}
            onClick={onResetGridOrder}
          >
            Reset Order
          </Button>
        </div>
      </div>

      <div className="workspace-settings-section ping-settings-section">
        <div className="tools-section-header">
          <span>Network monitoring</span>
          <strong>{pingIntervalSeconds}s</strong>
        </div>
        <form className="ping-interval-form" noValidate onSubmit={savePingInterval}>
          <label className="job-inline-field">
            <span>Ping interval</span>
            <input
              aria-label="Ping interval in seconds"
              type="number"
              inputMode="numeric"
              min={MIN_HOST_PING_INTERVAL_SECONDS}
              max={MAX_HOST_PING_INTERVAL_SECONDS}
              step={1}
              value={pingIntervalDraft}
              onChange={(event) => setPingIntervalDraft(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="subtle"
            size="compact"
            tooltip={{
              title: "Save ping interval",
              description: "Changes how often one small packet is sent to each unique camera IP."
            }}
          >
            Save Interval
          </Button>
        </form>
        {pingIntervalError && (
          <p className="ping-interval-error" role="alert">
            {pingIntervalError}
          </p>
        )}
      </div>

      <div className="workspace-settings-section credential-preset-section">
        <div className="tools-section-header">
          <span>Password presets</span>
          <strong>{credentialPresets.length}</strong>
        </div>
        <form className="credential-preset-form" onSubmit={addPreset}>
          <label className="job-inline-field">
            <span>Username</span>
            <input
              aria-label="Preset username"
              value={presetUsername}
              onChange={(event) => setPresetUsername(event.target.value)}
            />
          </label>
          <label className="job-inline-field">
            <span>Password</span>
            <input
              aria-label="Preset password"
              type="text"
              value={presetPassword}
              onChange={(event) => setPresetPassword(event.target.value)}
            />
          </label>
          <label className="job-inline-field">
            <span>Camera type</span>
            <input
              aria-label="Preset model match"
              placeholder="VENICE 2"
              value={presetCameraType}
              onChange={(event) => setPresetCameraType(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="subtle"
            size="compact"
            disabled={!presetUsername.trim() || !presetPassword}
          >
            Add
          </Button>
        </form>
        {credentialPresets.length > 0 && (
          <div className="credential-preset-list" aria-label="Saved credential presets">
            {credentialPresets.map((preset) => (
              <div key={preset.id} className="credential-preset-row">
                <span>{preset.username}</span>
                <small>{preset.cameraType || "Manual"}</small>
                <code>{preset.password}</code>
                <Button
                  variant="danger"
                  size="compact"
                  icon={<Trash2 size={13} strokeWidth={2.2} />}
                  onClick={() => onDeleteCredentialPreset(preset.id)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="workspace-settings-section saved-password-section">
        <div className="tools-section-header">
          <span>Saved camera passwords</span>
          <strong>{passwordRecords.length}</strong>
        </div>
        {passwordRecords.length > 0 && (
          <div className="saved-password-list" aria-label="Saved camera passwords">
            {passwordRecords.map((record) => (
              <div key={record.id} className="saved-password-row">
                <span>{record.url}</span>
                <small>{record.cameraId ?? "Web address"}</small>
                <code>{record.username}</code>
                <code>{record.password}</code>
                <Button
                  variant="danger"
                  size="compact"
                  icon={<Trash2 size={13} strokeWidth={2.2} />}
                  onClick={() => onDeletePasswordRecord(record.id)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="workspace-settings-section control-api-section">
        <div className="tools-section-header">
          <span>Local API</span>
          <strong>{controlApiInfo?.baseUrl ?? "Starting"}</strong>
        </div>
        <div className="control-api-shortcuts" aria-label="Local API shortcuts">
          <code>GET /api/focus/1</code>
          <code>GET /api/grid</code>
          <code>
            {controlApiInfo
              ? `${controlApiInfo.baseUrl.replace(/^http:/, "ws:")}/api/ws`
              : "ws://127.0.0.1:52780/api/ws"}
          </code>
        </div>
        <p>
          Companion connects on this computer over the Local API. For SKAARHOJ Blue Pill
          camera select / routing triggers, enable <strong>Probel SW-P-08</strong> below
          and use the built-in SW-P-08 device core on the panel.
        </p>
        <label className="job-inline-field control-api-lan-toggle">
          <span>Allow LAN access (Companion / tools on the network)</span>
          <input
            aria-label="Allow LAN access"
            type="checkbox"
            checked={Boolean(controlApiInfo?.lanAccess)}
            onChange={(event) => {
              const bindHost: ControlApiBindHost = event.target.checked
                ? "0.0.0.0"
                : "127.0.0.1";
              void onSetControlApiBindHost(bindHost).catch((error) => {
                setPortError(
                  error instanceof Error
                    ? error.message
                    : "Could not change LAN access."
                );
              });
            }}
          />
        </label>
        {controlApiInfo?.lanAccess && (
          <p className="control-api-lan-hint">
            Local API listening on all interfaces at{" "}
            <code>{controlApiInfo.host}:{controlApiInfo.port}</code>.
          </p>
        )}
        <form className="control-api-form" onSubmit={(event) => void savePort(event)}>
          <label className="job-inline-field">
            <span>API port</span>
            <input
              aria-label="API port"
              inputMode="numeric"
              placeholder="Auto"
              value={portDraft}
              onChange={(event) => setPortDraft(event.target.value)}
            />
          </label>
          <div className="control-api-actions">
            <Button type="submit" variant="subtle" size="compact">
              Save Port
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => {
                setPortDraft("");
                void onSetControlApiPort(null).catch((error) => {
                  setPortError(error instanceof Error ? error.message : "Could not set API port.");
                });
              }}
            >
              Auto
            </Button>
          </div>
        </form>
        {portError && <p className="control-api-error">{portError}</p>}
      </div>

      <div className="workspace-settings-section control-api-section">
        <div className="tools-section-header">
          <span>Probel SW-P-08 (Blue Pill)</span>
          <strong>
            {swp08Info?.listening
              ? `${swp08Info.host}:${swp08Info.port}`
              : swp08Info?.enabled
                ? "Starting…"
                : "Off"}
          </strong>
        </div>
        <p>
          DIT Browse acts as a small SW-P-08 router. Use SKAARHOJ&apos;s stock{" "}
          <strong>Probel SW-P-08 → Configurable Model</strong> — no custom core package.
          Routing source <code>N</code> → destination{" "}
          <code>{swp08Info?.focusDestination ?? 1}</code> focuses camera <code>N</code>.
        </p>
        <label className="job-inline-field control-api-lan-toggle">
          <span>Enable SW-P-08 server</span>
          <input
            aria-label="Enable SW-P-08 server"
            type="checkbox"
            checked={Boolean(swp08Info?.enabled)}
            onChange={(event) => {
              void onSetSwp08Config({ enabled: event.target.checked }).catch((error) => {
                setSwp08Error(
                  error instanceof Error ? error.message : "Could not change SW-P-08."
                );
              });
            }}
          />
        </label>
        <form
          className="control-api-form"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = Number(swp08PortDraft.trim());
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
              setSwp08Error("SW-P-08 port must be an integer between 1 and 65535");
              return;
            }
            void onSetSwp08Config({ port: parsed }).catch((error) => {
              setSwp08Error(
                error instanceof Error ? error.message : "Could not set SW-P-08 port."
              );
            });
          }}
        >
          <label className="job-inline-field">
            <span>SW-P-08 port</span>
            <input
              aria-label="SW-P-08 port"
              inputMode="numeric"
              value={swp08PortDraft}
              onChange={(event) => setSwp08PortDraft(event.target.value)}
            />
          </label>
          <div className="control-api-actions">
            <Button type="submit" variant="subtle" size="compact">
              Save Port
            </Button>
          </div>
        </form>
        {swp08Error && <p className="control-api-error">{swp08Error}</p>}

        <Swp08SetupGuide info={swp08Info} />
      </div>

      <div className="workspace-settings-section control-api-section">
        <div
          className={`companion-module-status companion-module-${companionModuleStatus?.state ?? "checking"}`}
          aria-label="Companion module status"
          aria-live="polite"
        >
          <div className="companion-module-copy">
            <div className="tools-section-header">
              <span>Companion module</span>
              <strong>
                {companionModuleStatus?.bundledVersion
                  ? `Bundled ${companionModuleStatus.bundledVersion}`
                  : "Checking"}
              </strong>
            </div>
            <p>
              {companionModuleStatus?.message ??
                "Checking Companion's developer-module folder…"}
            </p>
            {companionModuleStatus?.installedVersion && (
              <small className="companion-module-meta">
                Installed version {companionModuleStatus.installedVersion}
              </small>
            )}
            {companionModuleStatus?.state === "current" && (
              <small className="companion-module-guidance">
                Companion normally reloads this automatically. If it does not appear, use
                Companion&apos;s Refresh modules list control.
              </small>
            )}
            {companionModuleError && (
              <p className="companion-module-error" role="alert">
                {companionModuleError}
              </p>
            )}
          </div>
          <div className="companion-module-actions">
            <Button
              type="button"
              variant="subtle"
              size="compact"
              icon={<Download size={13} strokeWidth={2.2} />}
              disabled={
                companionModuleBusy ||
                (companionModuleStatus?.state !== "not_configured" &&
                  !companionModuleStatus?.canInstall)
              }
              onClick={() => {
                if (companionModuleStatus?.state === "not_configured") {
                  setCompanionSetupOpen(true);
                  return;
                }
                void onInstallCompanionModule();
              }}
            >
              {companionInstallButtonLabel(companionModuleStatus, companionModuleBusy)}
            </Button>
            {companionModuleStatus?.pathSource === "manual" && (
              <Button
                type="button"
                variant="ghost"
                size="compact"
                disabled={companionModuleBusy}
                onClick={() => setCompanionSetupOpen(true)}
              >
                Change Folder
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="compact"
              icon={<RotateCcw size={13} strokeWidth={2.2} />}
              disabled={companionModuleBusy}
              onClick={() => void onRefreshCompanionModuleStatus()}
            >
              Check Again
            </Button>
          </div>
        </div>
      </div>
      {companionSetupOpen && (
        <CompanionModuleSetupDialog
          busy={companionModuleBusy}
          error={companionModuleError}
          onClose={() => setCompanionSetupOpen(false)}
          onChoose={onChooseAndInstallCompanionModule}
        />
      )}
    </section>
  );
}
