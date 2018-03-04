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
  red: "red",
  green: "green"
} as WolfIconColorType;

const WolfHexColorMap = {
  cornflower: "#6495ed",
  blue: "#00a1f1",
  green: "#7cbb00",
  red: "#ea2f36"
} as WolfHexColorType;

export function wolfIconColorProvider(color: WolfColorSelection) {
  return WolfIconColorMap[color] as WolfIconColor;
}

export function wolfTextColorProvider(color: WolfColorSelection) {
  return WolfHexColorMap[color] as WolfHexColor;
}
