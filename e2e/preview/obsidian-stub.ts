/** Browser stand-in for the few `obsidian` exports the UI uses, so the stylesheet can be reviewed offline. */
const SVG_NS = "http://www.w3.org/2000/svg";
const ICONS: Record<string, string[]> = {
  square: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"],
  "rows-3": [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M21 9H3",
    "M21 15H3",
  ],
  "grid-2x2": [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M3 12h18",
    "M12 3v18",
  ],
  grip: [
    "M12 5h.01",
    "M19 5h.01",
    "M5 5h.01",
    "M12 12h.01",
    "M19 12h.01",
    "M5 12h.01",
    "M12 19h.01",
    "M19 19h.01",
    "M5 19h.01",
  ],
  eye: [
    "M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0",
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
  check: ["M20 6 9 17l-5-5"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "grip-vertical": ["M9 5h.01", "M9 12h.01", "M9 19h.01", "M15 5h.01", "M15 12h.01", "M15 19h.01"],
  "rotate-ccw": ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  "rotate-cw": ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  "maximize-2": ["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"],
  "minimize-2": ["m14 10 7-7", "M20 10h-6V4", "m3 21 7-7", "M4 14h6v6"],
  "eye-off": [
    "M10.7 5.1A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.7 2.7",
    "M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6",
    "m2 2 20 20",
  ],
};

export function setIcon(element: HTMLElement, name: string): void {
  const paths = ICONS[name];
  if (!paths) return;
  const svg = document.createElementNS(SVG_NS, "svg");
  const attributes: Record<string, string> = {
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: `svg-icon lucide-${name}`,
  };
  for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value);
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  element.replaceChildren(svg);
}

export const Platform = { isIosApp: false, isAndroidApp: false, isMobileApp: false, isDesktopApp: true };
export class Notice {
  constructor(message: string) {
    console.log(`[notice] ${message}`);
  }
}
export class Plugin {}
export class PluginSettingTab {}
