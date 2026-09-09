/**
 * The workspace UI preferences, kept in localStorage.
 *
 * Their own module because the stage reads them too, and the stage now lives
 * outside Home.tsx so a shared page can render it.
 */

export type UiSettings = {
  density: "comfortable" | "compact";
  displayScale: "standard" | "compact";
  theme: "ink" | "navy";
};
export const DEFAULT_UI_SETTINGS: UiSettings = {
  density: "comfortable",
  displayScale: "standard",
  theme: "ink",
};
export function readUiSettings(): UiSettings {
  try {
    const stored = {
      ...DEFAULT_UI_SETTINGS,
      ...JSON.parse(localStorage.getItem("meeting-prep-ui") ?? "{}"),
    } as UiSettings;
    const params = new URLSearchParams(window.location.search);
    return params.get("displayDensity") === "compact"
      ? { ...stored, displayScale: "compact" }
      : stored;
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
}
