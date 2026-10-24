import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactElement } from "react";

interface ConfirmActionButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "onBlur" | "children"
> {
  label: string;
  confirmLabel?: string;
  confirmTimeoutMs?: number;
  onConfirm(): void | Promise<void>;
}

export function ConfirmActionButton({
  label,
  confirmLabel = "Click again to confirm",
  confirmTimeoutMs = 4500,
  onConfirm,
  ...props
}: ConfirmActionButtonProps): ReactElement {
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const disarm = (): void => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setArmed(false);
  };

  const handleClick = (): void => {
    if (armed) {
      disarm();
      void (async () => {
        try {
          await onConfirm();
        } catch (error: unknown) {
          console.error("Nyra Excalidraw Ruled Lines: confirmed action failed", error);
        }
      })();
      return;
    }

    setArmed(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setArmed(false);
    }, confirmTimeoutMs);
  };

  return (
    <button
      {...props}
      type="button"
      data-confirm-armed={armed ? "true" : "false"}
      aria-label={armed ? confirmLabel : label}
      onBlur={() => {
        if (armed) disarm();
      }}
      onClick={handleClick}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
