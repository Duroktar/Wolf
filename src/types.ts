import {
  DecorationOptions,
  Range,
  TextEditor,
  TextEditorDecorationType
} from "vscode";

export type WolfIcon = string;
export type WolfHexColor = string;
export type WolfColorSelection = "red" | "cornflower" | "blue" | "green";
export type WolfIconColor = "red" | "green" | "blue";

export type WolfHexColorType = { [P in WolfColorSelection]: WolfHexColor };
export type WolfIconColorType = { [P in WolfColorSelection]: WolfIconColor };

export interface WolfActiveSessionCollection {
  [id: string]: TextEditor;
}

export interface WolfGutterDecorationOptions {
  gutterIconColor: WolfColorSelection;
  leftMargin?: number;
}

export type WolfValue = string | number;

export interface WolfResponse {}

export interface WolfLineDecoration {
  data: WolfValue[];
  lineno: number;
  error: boolean;
  loop: boolean;
  source: string;
  pretty: string[];
  calls: number;
}

export interface WolfDecorationMapping {
  [id: string]: WolfLineDecoration;
}

export interface WolfDecorationOptions {
  range: Range;
  text: string;
  hoverText: string;
  color: WolfColorSelection;
  language?: "python" | string;
}

export interface WolfStandardDecorationTypes {
  success: TextEditorDecorationType;
  error: TextEditorDecorationType;
}

export interface WolfSessionDecorations {
  success: DecorationOptions[];
  error: DecorationOptions[];
}

export interface WolfTraceLineResult {
  line_number: number;
  value: WolfValue;
  kind: string;
  source: string;
  pretty: string;
  error: boolean;
  calls: number;
  _loop?: boolean;
}

export type WolfParsedTraceResults = WolfTraceLineResult[] | null;

export interface WolfTracerInterface {
  rootDir: string;
  afterInstall: () => void;
  onData: (string) => void;
  onError: (string) => void;
}

export type ActiveTextEditorChangeEventResult = TextEditor | undefined;
