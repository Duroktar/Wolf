import type { ExtensionContext } from "vscode";
import type { WolfColorSelection, WolfIcon } from "./types";
import { wolfIconColorProvider } from "./colors";

export function wolfIconProvider(
  context: ExtensionContext,
  color: WolfColorSelection,
  pawprints: boolean
): WolfIcon {
  const iconColor = wolfIconColorProvider(color);
  return context
    .asAbsolutePath(`media\\wolf${pawprints ? "-paw" : ""}-${iconColor}.png`)
    .replace(/\\/g, "/");
}
