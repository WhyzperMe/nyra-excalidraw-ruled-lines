import { useSyncExternalStore } from "react";
import type { SettingsStore } from "../../core/SettingsStore";
import type { NyraSettings } from "../../core/types";

export function useNyraSettings(store: SettingsStore): NyraSettings {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
