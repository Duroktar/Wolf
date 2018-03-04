import { WolfColorSelection, WolfIcon, WolfIconColor } from "./types";
import { ExtensionContext } from "vscode";
import { wolfIconColorProvider } from "./colors";

export function wolfIconProvider(
  context: ExtensionContext,
  color: WolfColorSelection,
  pawprints: boolean
): WolfIcon {
  const iconColor: WolfIconColor = wolfIconColorProvider(color);
  return context
    .asAbsolutePath(`media\\wolf${pawprints ? "-paw" : ""}-${iconColor}.png`)
    .replace(/\\/g, "/");
}
