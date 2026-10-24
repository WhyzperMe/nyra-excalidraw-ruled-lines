import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { ObsidianIcon } from "./ObsidianIcon";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  hint?: string;
  value: string;
  options: readonly SelectOption[];
  disabled?: boolean;
  children?: ReactNode;
  portalRoot?: HTMLElement | null;
  onChange(value: string): void;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  direction: "up" | "down";
}

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;
const OPTION_HEIGHT = 38;
const MENU_PADDING = 8;
const MAX_MENU_HEIGHT = 280;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SelectField({
  label,
  hint,
  value,
  options,
  disabled = false,
  children,
  portalRoot,
  onChange,
}: SelectFieldProps): ReactElement {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const labelId = useId();
  const hintId = useId();
  const listboxId = useId();
  const valueId = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(
    () =>
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    [options, value],
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const selectedOption = options[selectedIndex] ?? options[0];

  const getOwnerDocument = useCallback(
    () => triggerRef.current?.ownerDocument ?? portalRoot?.ownerDocument ?? document,
    [portalRoot],
  );

  const updatePosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const doc = trigger.ownerDocument;
    const win = doc.defaultView ?? window;
    const viewport = win.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? doc.documentElement.clientWidth;
    const viewportHeight = viewport?.height ?? doc.documentElement.clientHeight;
    const rect = trigger.getBoundingClientRect();
    const optionHeight = win.matchMedia?.("(pointer: coarse)").matches ? 44 : OPTION_HEIGHT;
    const desiredHeight = Math.min(MAX_MENU_HEIGHT, options.length * optionHeight + MENU_PADDING);
    const spaceBelow = viewportTop + viewportHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - viewportTop - VIEWPORT_MARGIN;
    const direction: MenuPosition["direction"] =
      spaceBelow < Math.min(desiredHeight, 160) && spaceAbove > spaceBelow ? "up" : "down";
    const availableHeight = Math.max(1, direction === "down" ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(MAX_MENU_HEIGHT, availableHeight);
    const availableWidth = Math.max(1, viewportWidth - VIEWPORT_MARGIN * 2);
    const preferredMinimumWidth = Math.min(172, availableWidth);
    const width = Math.min(Math.max(rect.width, preferredMinimumWidth), availableWidth);
    const minLeft = viewportLeft + VIEWPORT_MARGIN;
    const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - width - VIEWPORT_MARGIN);
    const left = clamp(rect.left, minLeft, maxLeft);
    const top =
      direction === "down"
        ? rect.bottom + MENU_GAP
        : Math.max(viewportTop + VIEWPORT_MARGIN, rect.top - Math.min(desiredHeight, maxHeight) - MENU_GAP);

    const next = { left, top, width, maxHeight, direction };
    setMenuPosition((current) =>
      current &&
      current.left === next.left &&
      current.top === next.top &&
      current.width === next.width &&
      current.maxHeight === next.maxHeight &&
      current.direction === next.direction
        ? current
        : next,
    );
  }, [options.length]);

  const closeMenu = useCallback((restoreFocus = false): void => {
    setOpen(false);
    if (restoreFocus) {
      const win = triggerRef.current?.ownerDocument.defaultView;
      if (win) win.requestAnimationFrame(() => triggerRef.current?.focus());
      else requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const selectIndex = useCallback(
    (index: number): void => {
      const option = options[index];
      if (!option) return;
      if (option.value !== value) onChange(option.value);
      setActiveIndex(index);
      closeMenu(true);
    },
    [closeMenu, onChange, options, value],
  );

  const openMenu = useCallback(
    (initialIndex = selectedIndex): void => {
      if (disabled || options.length === 0) return;
      setActiveIndex(clamp(initialIndex, 0, options.length - 1));
      setOpen(true);
    },
    [disabled, options.length, selectedIndex],
  );

  const moveActive = useCallback(
    (delta: number): void => {
      if (!options.length) return;
      setActiveIndex((current) => (current + delta + options.length) % options.length);
    },
    [options.length],
  );

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (disabled || options.length === 0) {
      if (open) setOpen(false);
      return;
    }
    setActiveIndex((current) => clamp(current, 0, options.length - 1));
  }, [disabled, open, options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const win = triggerRef.current?.ownerDocument.defaultView;
    const focusListbox = (): void => {
      listboxRef.current?.focus({ preventScroll: true });
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    };
    if (win) win.requestAnimationFrame(focusListbox);
    else requestAnimationFrame(focusListbox);
  }, [activeIndex, open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    const doc = getOwnerDocument();
    const win = doc.defaultView ?? window;
    const viewport = win.visualViewport;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!target || typeof (target as Node).nodeType !== "number") return;
      const node = target as Node;
      if (triggerRef.current?.contains(node) || listboxRef.current?.contains(node)) return;
      closeMenu(false);
    };
    const onWindowChange = (event?: Event): void => {
      if (event?.target === listboxRef.current) return;
      updatePosition();
    };

    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("scroll", onWindowChange, true);
    win.addEventListener("resize", onWindowChange, { passive: true });
    viewport?.addEventListener("resize", onWindowChange, { passive: true });
    viewport?.addEventListener("scroll", onWindowChange, { passive: true });

    return () => {
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.removeEventListener("scroll", onWindowChange, true);
      win.removeEventListener("resize", onWindowChange);
      viewport?.removeEventListener("resize", onWindowChange);
      viewport?.removeEventListener("scroll", onWindowChange);
    };
  }, [closeMenu, getOwnerDocument, open, updatePosition]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (open) moveActive(1);
      else openMenu(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (open) moveActive(-1);
      else openMenu(selectedIndex);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) closeMenu(false);
      else openMenu();
    } else if (event.key === "Home") {
      event.preventDefault();
      openMenu(0);
    } else if (event.key === "End") {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  };

  const handleListboxKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectIndex(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu(false);
    }
  };

  const menu =
    open && menuPosition ? (
      <div
        ref={listboxRef}
        id={listboxId}
        className="nyra-select-popover"
        role="listbox"
        tabIndex={-1}
        aria-labelledby={labelId}
        aria-activedescendant={`${listboxId}-option-${activeIndex}`}
        data-direction={menuPosition.direction}
        style={
          {
            left: `${menuPosition.left}px`,
            top: `${menuPosition.top}px`,
            width: `${menuPosition.width}px`,
            maxHeight: `${menuPosition.maxHeight}px`,
          } as CSSProperties
        }
        onKeyDown={handleListboxKeyDown}
      >
        <div className="nyra-select-options">
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <div
                key={option.value}
                ref={(element: HTMLDivElement | null) => {
                  optionRefs.current[index] = element;
                }}
                id={`${listboxId}-option-${index}`}
                className={`nyra-select-option${selected ? " is-selected" : ""}${active ? " is-active" : ""}`}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => selectIndex(index)}
              >
                <span className="nyra-select-option-label">{option.label}</span>
                <span className="nyra-select-option-check" aria-hidden="true">
                  {selected ? <ObsidianIcon name="check" /> : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  const target = portalRoot ?? triggerRef.current?.ownerDocument.body ?? null;

  return (
    <div className={`nyra-select-field${disabled ? " is-disabled" : ""}`}>
      <span className="nyra-ruled-field-copy">
        <span id={labelId} className="nyra-ruled-field-title">
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="nyra-ruled-field-hint">
            {hint}
          </span>
        ) : null}
      </span>
      <span className="nyra-select-control-wrap">
        <button
          ref={triggerRef}
          type="button"
          className={`nyra-select-trigger${open ? " is-open" : ""}`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => (open ? closeMenu(false) : openMenu())}
          onKeyDown={handleTriggerKeyDown}
        >
          <span id={valueId} className="nyra-select-trigger-value">
            {selectedOption?.label ?? "Select…"}
          </span>
          <ObsidianIcon name="chevron-down" className="nyra-select-trigger-chevron" />
        </button>
        {children}
      </span>
      {target && menu ? createPortal(menu, target) : null}
    </div>
  );
}
