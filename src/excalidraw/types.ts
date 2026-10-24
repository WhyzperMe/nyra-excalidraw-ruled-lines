import type { TFile } from "obsidian";
import type { ThemeMode } from "../core/types";

export interface ExcalidrawAppStateLike {
  theme?: ThemeMode;
  zoom?: number | { value?: number };
  scrollX?: number;
  scrollY?: number;
  offsetLeft?: number;
  offsetTop?: number;
}

export interface ExcalidrawElementLike {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  opacity?: number;
  backgroundColor?: string;
  fillStyle?: string;
  isDeleted?: boolean;
  version?: number;
  updated?: number;
}

export interface ExcalidrawApiLike {
  getAppState?(): ExcalidrawAppStateLike | undefined;
  getSceneElements?(): readonly ExcalidrawElementLike[];
}

export interface ExcalidrawViewLike {
  containerEl: HTMLElement;
  file?: TFile | null;
  excalidrawAPI?: ExcalidrawApiLike;
  getViewType?(): string;
}

export interface ViewTransform {
  zoom: number;
  scrollX: number;
  scrollY: number;
}
