import type { ButtonHTMLAttributes, ReactElement } from "react";
import { ObsidianIcon } from "./ObsidianIcon";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: string;
  label: string;
  active?: boolean;
}

export function IconButton({
  icon,
  label,
  active = false,
  className = "",
  ...props
}: IconButtonProps): ReactElement {
  const classes = ["nyra-ruled-icon-button", active ? "is-active" : "", className].filter(Boolean).join(" ");

  return (
    <button type="button" className={classes} aria-label={label} title={label} {...props}>
      <ObsidianIcon name={icon} />
    </button>
  );
}
