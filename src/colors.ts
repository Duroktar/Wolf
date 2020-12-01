import {
  WolfIconColorType,
  WolfHexColorType,
  WolfColorSelection,
  WolfHexColor,
  WolfIconColor
} from "./types";

const WolfIconColorMap = {
  blue: "blue",
  cornflower: "blue",
  green: "green",
  orange: "orange",
  red: "red",
} as WolfIconColorType;

const WolfHexColorMap = {
  blue: "#00a1f1",
  cornflower: "#6495ed",
  green: "#7cbb00",
  orange: "#ffae19",
  red: "#ea2f36",
} as WolfHexColorType;

export function wolfIconColorProvider(color: WolfColorSelection): WolfIconColor {
  return WolfIconColorMap[color];
}

export function wolfTextColorProvider(color: WolfColorSelection): WolfHexColor {
  return WolfHexColorMap[color];
}
