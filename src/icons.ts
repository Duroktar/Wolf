import {
  WolfColorSelection,
  WolfIcon,
  WolfIconColor,
  WolfIconColorMap
} from "./types";
import { ExtensionContext } from "vscode";

const iconColorMapping = {
  blue: "blue",
  cornflower: "blue",
  red: "red"
} as WolfIconColorMap;

export function wolfIconProvider(
  context: ExtensionContext,
  color: WolfColorSelection,
  pawprints: boolean
): WolfIcon {
  const iconColor: WolfIconColor = iconColorMapping[color];
  return context
    .asAbsolutePath(`media\\wolf${pawprints ? "-paw" : ""}-${iconColor}.png`)
    .replace(/\\/g, "/");
}
