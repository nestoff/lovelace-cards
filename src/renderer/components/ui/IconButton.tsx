import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { Button } from "./Button";
import type { TooltipContent } from "./Tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  tooltip?: string | TooltipContent;
}

export function IconButton({
  label,
  icon,
  active = false,
  tooltip,
  className = "",
  type = "button",
  ...buttonProps
}: IconButtonProps): ReactElement {
  const classes = ["icon-button", active ? "active" : "", className].filter(Boolean).join(" ");
  const tooltipContent =
    typeof tooltip === "string"
      ? { title: label, description: tooltip }
      : tooltip;

  return (
    <Button
      {...buttonProps}
      type={type}
      aria-label={label}
      tooltip={tooltipContent}
      variant="ghost"
      size="icon"
      icon={icon}
      className={classes}
    />
  );
}
