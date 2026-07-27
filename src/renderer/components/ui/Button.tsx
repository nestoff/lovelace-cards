import type {
  ButtonHTMLAttributes,
  FocusEvent,
  MouseEvent,
  PointerEvent,
  ReactElement,
  ReactNode
} from "react";
import { Tooltip, type TooltipContent, type TooltipTriggerProps } from "./Tooltip";

export type ButtonVariant = "ghost" | "subtle" | "primary" | "danger";
export type ButtonSize = "icon" | "compact" | "default";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  tooltip?: TooltipContent;
  busy?: boolean;
}

export function Button({
  variant = "subtle",
  size = "default",
  icon,
  tooltip,
  busy = false,
  className = "",
  type = "button",
  disabled,
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onClick,
  ...buttonProps
}: ButtonProps): ReactElement {
  const classes = ["button", `button-${variant}`, `button-${size}`, className]
    .filter(Boolean)
    .join(" ");

  const renderButton = (triggerProps?: TooltipTriggerProps): ReactElement => (
    <button
      {...buttonProps}
      ref={triggerProps?.ref as (node: HTMLButtonElement | null) => void}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-describedby={triggerProps?.["aria-describedby"]}
      onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
        onPointerEnter?.(event);
        triggerProps?.onPointerEnter();
      }}
      onPointerLeave={(event: PointerEvent<HTMLButtonElement>) => {
        onPointerLeave?.(event);
        triggerProps?.onPointerLeave();
      }}
      onFocus={(event: FocusEvent<HTMLButtonElement>) => {
        onFocus?.(event);
        triggerProps?.onFocus();
      }}
      onBlur={(event: FocusEvent<HTMLButtonElement>) => {
        onBlur?.(event);
        triggerProps?.onBlur();
      }}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        triggerProps?.onClick();
        onClick?.(event);
      }}
    >
      {busy && <span className="button-spinner" aria-hidden="true" />}
      {!busy && icon && <span className="button-leading-icon">{icon}</span>}
      {children && <span className="button-label">{children}</span>}
    </button>
  );

  return tooltip ? (
    <Tooltip {...tooltip}>{(triggerProps) => renderButton(triggerProps)}</Tooltip>
  ) : (
    renderButton()
  );
}
