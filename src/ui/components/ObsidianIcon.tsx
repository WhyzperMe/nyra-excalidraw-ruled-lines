import { setIcon } from "obsidian";
import { useLayoutEffect, useRef, type ReactElement } from "react";

export interface ObsidianIconProps {
  name: string;
  className?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function createBaseSvg(element: HTMLSpanElement): SVGSVGElement {
  const svg = element.ownerDocument.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

function renderGridFallback(element: HTMLSpanElement): void {
  const doc = element.ownerDocument;
  const svg = createBaseSvg(element);

  for (const [x, y] of [
    [3, 3],
    [13, 3],
    [3, 13],
    [13, 13],
  ]) {
    const rect = doc.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", "8");
    rect.setAttribute("height", "8");
    rect.setAttribute("rx", "1");
    svg.appendChild(rect);
  }

  element.replaceChildren(svg);
}

function renderGenericFallback(element: HTMLSpanElement): void {
  const rect = element.ownerDocument.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "4");
  rect.setAttribute("y", "4");
  rect.setAttribute("width", "16");
  rect.setAttribute("height", "16");
  rect.setAttribute("rx", "3");
  const svg = createBaseSvg(element);
  svg.appendChild(rect);
  element.replaceChildren(svg);
}

function renderFallback(element: HTMLSpanElement, name: string): void {
  if (name === "grid-2x2" || name === "grid-3x3") renderGridFallback(element);
  else renderGenericFallback(element);
}

export function ObsidianIcon({ name, className }: ObsidianIconProps): ReactElement {
  const ref = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.replaceChildren();
    try {
      setIcon(element, name);
    } catch {
      // Obsidian/Lucide icon inventories can differ between app versions.
      // The deterministic fallback below keeps control geometry and meaning.
    }
    if (!element.querySelector("svg")) renderFallback(element, name);
  }, [name]);

  return <span ref={ref} className={className} aria-hidden="true" />;
}
