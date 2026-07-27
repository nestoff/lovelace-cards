import type { ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  Maximize2,
  Minimize2,
  Rows3,
  Save
} from "lucide-react";
import type { TileState, ViewportSize } from "../../shared/types";
import { AddressBar } from "./AddressBar";
import { CameraSessionMenu } from "./CameraSessionMenu";
import { GridControls } from "./GridControls";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";

interface BrowserToolbarProps {
  selectedTile: TileState | null;
  columns: number;
  defaultZoom: number;
  globalZoom: number;
  onNavigate: (input: string, target: "selected" | "new") => void;
  canSaveSelectedUrl: boolean;
  onSaveSelectedUrl: () => void;
  showReturnToPrefix: boolean;
  onReturnSelectedCameraToPrefix: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onReloadAll: () => void;
  hasTiles: boolean;
  sessionBusy: boolean;
  onSignOutSelected: () => void;
  onRequestSignOutAll: () => void;
  onColumnsChange: (columns: number) => void;
  onRelativeGlobalZoomChange: (factor: number) => void;
  onGlobalViewportChange: (viewport: ViewportSize) => void;
  onZoomChange: (zoom: number) => void;
  onViewportChange: (viewport: ViewportSize) => void;
  expansionEnabled: boolean;
  focusMode: boolean;
  onFocusModeToggle: () => void;
}

export function BrowserToolbar({
  selectedTile,
  columns,
  defaultZoom,
  globalZoom,
  onNavigate,
  canSaveSelectedUrl,
  onSaveSelectedUrl,
  showReturnToPrefix,
  onReturnSelectedCameraToPrefix,
  onBack,
  onForward,
  onReload,
  onReloadAll,
  hasTiles,
  sessionBusy,
  onSignOutSelected,
  onRequestSignOutAll,
  onColumnsChange,
  onRelativeGlobalZoomChange,
  onGlobalViewportChange,
  onZoomChange,
  onViewportChange,
  expansionEnabled,
  focusMode,
  onFocusModeToggle
}: BrowserToolbarProps): ReactElement {
  return (
    <header className="browser-toolbar" aria-label="Browser toolbar">
      <div className="toolbar-group browser-navigation" aria-label="Navigation controls">
        <IconButton
          label="Back"
          tooltip={{
            title: "Back",
            description: "Returns the selected camera to its previous page."
          }}
          icon={<ArrowLeft size={16} strokeWidth={2.2} />}
          onClick={onBack}
        />
        <IconButton
          label="Forward"
          tooltip={{
            title: "Forward",
            description: "Moves the selected camera to its next page."
          }}
          icon={<ArrowRight size={16} strokeWidth={2.2} />}
          onClick={onForward}
        />
        <CameraSessionMenu
          canReloadSelected={!!selectedTile}
          canReloadAll={hasTiles}
          busy={sessionBusy}
          onReloadSelected={onReload}
          onReloadAll={onReloadAll}
          onSignOutSelected={onSignOutSelected}
          onRequestSignOutAll={onRequestSignOutAll}
        />
      </div>
      <div className="browser-toolbar-main">
        <AddressBar value={selectedTile?.url ?? ""} onNavigate={onNavigate} />
        <IconButton
          label="Save current URL to camera list"
          tooltip={{
            title: "Save current URL",
            description: "Stores this live address in the selected camera row."
          }}
          icon={<Save size={14} strokeWidth={2.2} />}
          disabled={!canSaveSelectedUrl}
          onClick={onSaveSelectedUrl}
        />
        {showReturnToPrefix && (
          <Button
            className="return-prefix-button"
            icon={<Link2 size={14} strokeWidth={2.2} />}
            variant="subtle"
            size="compact"
            aria-label="Go back to prefix and suffix style"
            tooltip={{
              title: "Use list address",
              description: "Restores this camera to the list prefix plus its camera number."
            }}
            onClick={onReturnSelectedCameraToPrefix}
          >
            Use list address
          </Button>
        )}
      </div>
      <div className="toolbar-group browser-layout-controls" aria-label="Layout controls">
        <IconButton
          label={focusMode ? "Show all pages" : "Focus selected page"}
          tooltip={
            !expansionEnabled
              ? {
                  title: "Expansion locked",
                  description:
                    "Companion expansion mode is off, so the camera grid stays visible."
                }
              : focusMode
              ? {
                  title: "Show all pages",
                  description: "Returns to the camera grid without reloading any pages."
                }
              : {
                  title: "Focus selected page",
                  description: "Shows only the selected camera without reloading any pages."
                }
          }
          icon={
            focusMode ? (
              <Minimize2 size={14} strokeWidth={2.2} />
            ) : (
              <Maximize2 size={14} strokeWidth={2.2} />
            )
          }
          active={focusMode}
          disabled={!selectedTile || !expansionEnabled}
          onClick={onFocusModeToggle}
        />
        <GridControls
          columns={columns}
          selectedZoom={selectedTile?.zoom ?? defaultZoom}
          globalZoom={globalZoom}
          selectedViewport={selectedTile?.viewport ?? null}
          onColumnsChange={onColumnsChange}
          onRelativeGlobalZoomChange={onRelativeGlobalZoomChange}
          onGlobalViewportChange={onGlobalViewportChange}
          onZoomChange={onZoomChange}
          onViewportChange={onViewportChange}
          icon={<Rows3 size={14} strokeWidth={2.2} />}
        />
      </div>
    </header>
  );
}
