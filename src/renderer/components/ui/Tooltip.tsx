import type { ReactElement, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

const DEFAULT_DELAY_MS = 400;
const VIEWPORT_MARGIN = 8;
const TOOLTIP_GAP = 8;

export interface TooltipContent {
  title: string;
  description: string;
  shortcut?: string;
}

export interface TooltipTriggerProps {
  ref: (node: HTMLElement | null) => void;
  "aria-describedby"?: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
}

interface TooltipProps extends TooltipContent {
  children: (props: TooltipTriggerProps) => ReactNode;
  delayMs?: number;
}

interface TooltipPosition {
  left: number;
  top: number;
}

export function Tooltip({
  title,
  description,
  shortcut,
  children,
  delayMs = DEFAULT_DELAY_MS
}: TooltipProps): ReactElement {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const focusedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback((): void => {
    clearTimer();
    setOpen(false);
    setPosition(null);
  }, [clearTimer]);

  const openAfterDelay = useCallback((): void => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setOpen(true);
    }, delayMs);
  }, [clearTimer, delayMs]);

  const updatePosition = useCallback((): void => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const anchorBounds = anchor.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const centeredLeft =
      anchorBounds.left + anchorBounds.width / 2 - tooltipBounds.width / 2;
    const left = Math.min(
      window.innerWidth - tooltipBounds.width - VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, centeredLeft)
    );
    const below = anchorBounds.bottom + TOOLTIP_GAP;
    const top =
      below + tooltipBounds.height <= window.innerHeight - VIEWPORT_MARGIN
        ? below
        : Math.max(VIEWPORT_MARGIN, anchorBounds.top - tooltipBounds.height - TOOLTIP_GAP);

    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [close, open]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const triggerProps: TooltipTriggerProps = {
    ref: (node) => {
      anchorRef.current = node;
    },
    "aria-describedby": open ? tooltipId : undefined,
    onPointerEnter: openAfterDelay,
    onPointerLeave: () => {
      clearTimer();
      if (!focusedRef.current) {
        close();
      }
    },
    onFocus: () => {
      focusedRef.current = true;
      clearTimer();
      setOpen(true);
    },
    onBlur: () => {
      focusedRef.current = false;
      close();
    },
    onClick: close
  };

  return (
    <>
      {children(triggerProps)}
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="tooltip-surface"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden"
            }}
          >
            <div className="tooltip-title-row">
              <strong>{title}</strong>
              {shortcut && <kbd>{shortcut}</kbd>}
            </div>
            <span>{description}</span>
          </div>,
          document.body
        )}
    </>
  );
}
