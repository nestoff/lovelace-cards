import type { ReactElement } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export type StatusNoticeTone = "progress" | "success" | "partial" | "error";

interface StatusNoticeProps {
  tone: StatusNoticeTone;
  message: string;
  onDismiss?: () => void;
}

export function StatusNotice({
  tone,
  message,
  onDismiss
}: StatusNoticeProps): ReactElement {
  return (
    <div
      className={`status-notice status-notice-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {tone === "progress" && <span className="status-notice-spinner" aria-hidden="true" />}
      <span>{message}</span>
      {onDismiss && tone !== "progress" && (
        <IconButton
          label="Dismiss message"
          tooltip={{ title: "Dismiss", description: "Hides this status message." }}
          icon={<X size={15} strokeWidth={2} />}
          onClick={onDismiss}
        />
      )}
    </div>
  );
}
