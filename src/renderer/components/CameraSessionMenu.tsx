import type { ReactElement } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { KeyRound, LogOut, RefreshCcw, RotateCw } from "lucide-react";
import { Button } from "./ui/Button";

export interface CameraSessionMenuProps {
  canReloadSelected: boolean;
  canReloadAll: boolean;
  busy: boolean;
  onReloadSelected: () => void;
  onReloadAll: () => void;
  onSignOutSelected: () => void;
  onRequestSignOutAll: () => void;
}

export function CameraSessionMenu({
  canReloadSelected,
  canReloadAll,
  busy,
  onReloadSelected,
  onReloadAll,
  onSignOutSelected,
  onRequestSignOutAll
}: CameraSessionMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const wrapper = wrapperRef.current;
    const firstEnabledItem = wrapper?.querySelector<HTMLButtonElement>(
      "[role='menuitem']:not(:disabled)"
    );
    firstEnabledItem?.focus();

    const closeForOutsidePointer = (event: PointerEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeForEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        wrapperRef.current
          ?.querySelector<HTMLButtonElement>(".camera-session-trigger")
          ?.focus();
      }
    };

    document.addEventListener("pointerdown", closeForOutsidePointer);
    document.addEventListener("keydown", closeForEscape);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsidePointer);
      document.removeEventListener("keydown", closeForEscape);
    };
  }, [open]);

  const run = (callback: () => void): void => {
    setOpen(false);
    callback();
  };

  return (
    <div className="camera-session-menu" ref={wrapperRef}>
      <Button
        type="button"
        variant="subtle"
        size="compact"
        className="camera-session-trigger"
        icon={<KeyRound size={14} strokeWidth={2.2} />}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Camera Session
      </Button>
      {open && (
        <div id={menuId} className="camera-session-panel" role="menu">
          <Button
            role="menuitem"
            variant="ghost"
            size="compact"
            icon={<RotateCw size={14} strokeWidth={2.2} />}
            disabled={busy || !canReloadSelected}
            onClick={() => run(onReloadSelected)}
          >
            Reload selected
          </Button>
          <Button
            role="menuitem"
            variant="ghost"
            size="compact"
            icon={<RefreshCcw size={14} strokeWidth={2.2} />}
            disabled={busy || !canReloadAll}
            onClick={() => run(onReloadAll)}
          >
            Reload all
          </Button>
          <div className="camera-session-separator" role="separator" />
          <Button
            role="menuitem"
            variant="ghost"
            size="compact"
            className="camera-session-danger"
            icon={<LogOut size={14} strokeWidth={2.2} />}
            disabled={busy || !canReloadSelected}
            onClick={() => run(onSignOutSelected)}
          >
            Sign out, forget login &amp; reload selected
          </Button>
          <Button
            role="menuitem"
            variant="ghost"
            size="compact"
            className="camera-session-danger"
            icon={<LogOut size={14} strokeWidth={2.2} />}
            disabled={busy || !canReloadAll}
            onClick={() => run(onRequestSignOutAll)}
          >
            Sign out, forget active-list logins &amp; reload all…
          </Button>
        </div>
      )}
    </div>
  );
}
