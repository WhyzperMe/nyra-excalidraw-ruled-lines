import { Platform } from "obsidian";
import { PLUGIN_VERSION, SETTINGS_SCHEMA_VERSION } from "../core/constants";
import type { SettingsStore } from "../core/SettingsStore";
import type { ViewAttachmentManager } from "../lifecycle/ViewAttachmentManager";

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function copyText(text: string, doc: Document): Promise<boolean> {
  try {
    const clipboard = doc.defaultView?.navigator.clipboard ?? globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Use the DOM fallback below.
  }

  try {
    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    doc.body.appendChild(textarea);
    textarea.select();
    const ok = doc.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export class DiagnosticsService {
  public constructor(
    private readonly store: SettingsStore,
    private readonly manager: ViewAttachmentManager,
  ) {}

  public buildReport(): string {
    const settings = this.store.getSnapshot();
    const attachments = this.manager.getDiagnostics();
    const lines = [
      `Nyra Excalidraw Ruled Lines v${PLUGIN_VERSION}`,
      `settingsSchema=${SETTINGS_SCHEMA_VERSION}`,
      `platform=${Platform.isIosApp ? "ios" : Platform.isAndroidApp ? "android" : "desktop"}`,
      `documentVisibility=${document.visibilityState}`,
      `profiles=${settings.profiles.length}`,
      `fileOverrides=${Object.keys(settings.fileOverrides).length}`,
      `globalPaperMode=${settings.paperMode}`,
      `globalFollowCanvas=${settings.followCanvas}`,
      `globalHideUnderObjects=${settings.hideUnderObjects}`,
      `globalDockVisibility=${settings.dockVisibility}`,
      `attachments=${attachments.length}`,
    ];

    attachments.forEach((attachment, index) => {
      lines.push(
        `attachment[${index}]=${JSON.stringify({
          ...attachment,
          zoom: round(attachment.zoom),
          scrollX: round(attachment.scrollX),
          scrollY: round(attachment.scrollY),
        })}`,
      );
    });

    return lines.join("\n");
  }

  public async copy(doc = document): Promise<boolean> {
    return copyText(this.buildReport(), doc);
  }
}
