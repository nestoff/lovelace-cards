import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Circle, RotateCw } from "lucide-react";
import {
  DEFAULT_HOST_PING_INTERVAL_SECONDS,
  type HostPingStatus
} from "../../shared/hostPing";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";

interface HostPingIndicatorProps {
  status: HostPingStatus;
  pingIntervalSeconds?: number;
  onReload?: () => void;
}

export const OFFLINE_RELOAD_DELAY_MS = 10_000;

interface PingPresentation {
  label: string;
  ariaLabel: string;
  tooltipTitle: string;
  tooltipDescription: string;
}

function formatLatency(latencyMs: number | null): string {
  if (latencyMs === null) {
    return "Online";
  }
  if (latencyMs < 1) {
    return "<1 ms";
  }
  if (latencyMs < 10) {
    return `${latencyMs.toFixed(1)} ms`;
  }
  return `${Math.round(latencyMs)} ms`;
}

function latencyAriaLabel(latencyMs: number | null): string {
  if (latencyMs === null) {
    return "reachable";
  }
  if (latencyMs < 1) {
    return "less than 1 millisecond";
  }

  const value = latencyMs < 10 ? latencyMs.toFixed(1) : String(Math.round(latencyMs));
  return `${value} milliseconds`;
}

function intervalDescription(seconds: number): string {
  return `One 16-byte ping packet is sent every ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
}

function presentationFor(
  status: HostPingStatus,
  pingIntervalSeconds: number
): PingPresentation {
  const interval = intervalDescription(pingIntervalSeconds);
  if (status.state === "checking") {
    return {
      label: "Checking",
      ariaLabel: `Ping ${status.host}: checking`,
      tooltipTitle: "Checking camera",
      tooltipDescription: `Waiting for a small ping reply from ${status.host}. ${interval}`
    };
  }

  if (status.state === "offline") {
    return {
      label: "Offline",
      ariaLabel: `Ping ${status.host}: offline`,
      tooltipTitle: "No ping response",
      tooltipDescription: `${status.host} did not reply to ICMP. ${interval}`
    };
  }

  const label = formatLatency(status.latencyMs);
  return {
    label,
    ariaLabel: `Ping ${status.host}: ${latencyAriaLabel(status.latencyMs)}`,
    tooltipTitle: "Camera reachable",
    tooltipDescription: `${status.host} replied${status.latencyMs === null ? "" : ` in ${label}`}. ${interval}`
  };
}

export function HostPingIndicator({
  status,
  pingIntervalSeconds = DEFAULT_HOST_PING_INTERVAL_SECONDS,
  onReload
}: HostPingIndicatorProps): ReactElement {
  const offlineSince = status.state === "offline" ? status.offlineSince : null;
  const [reloadAvailable, setReloadAvailable] = useState(
    () =>
      offlineSince !== null &&
      Date.now() - offlineSince >= OFFLINE_RELOAD_DELAY_MS
  );
  const presentation = presentationFor(status, pingIntervalSeconds);

  useEffect(() => {
    if (offlineSince === null || !onReload) {
      setReloadAvailable(false);
      return;
    }

    const remaining = OFFLINE_RELOAD_DELAY_MS - (Date.now() - offlineSince);
    if (remaining <= 0) {
      setReloadAvailable(true);
      return;
    }

    setReloadAvailable(false);
    const timeout = window.setTimeout(() => setReloadAvailable(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [offlineSince, onReload]);

  return (
    <span className="host-ping-controls">
      <Tooltip
        title={presentation.tooltipTitle}
        description={presentation.tooltipDescription}
      >
        {(triggerProps) => (
          <span
            ref={triggerProps.ref}
            className={`host-ping-indicator ${status.state}`}
            role="img"
            tabIndex={0}
            aria-label={presentation.ariaLabel}
            aria-describedby={triggerProps["aria-describedby"]}
            onPointerEnter={triggerProps.onPointerEnter}
            onPointerLeave={triggerProps.onPointerLeave}
            onFocus={triggerProps.onFocus}
            onBlur={triggerProps.onBlur}
            onClick={triggerProps.onClick}
          >
            <Circle
              className="host-ping-dot"
              size={7}
              strokeWidth={0}
              fill="currentColor"
              aria-hidden="true"
            />
            <span aria-hidden="true">{presentation.label}</span>
          </span>
        )}
      </Tooltip>
      {reloadAvailable && onReload && status.state === "offline" && (
        <Button
          className="host-ping-reload"
          variant="ghost"
          size="icon"
          icon={<RotateCw size={11} strokeWidth={2.2} />}
          aria-label={`Reload camera at ${status.host}`}
          onClick={onReload}
        />
      )}
    </span>
  );
}
