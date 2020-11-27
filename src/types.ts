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

export type WolfResponse = Record<string, string>

export interface WolfLineDecoration {
  data: string[];
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

export interface WolfDecorationMoveOptions {
  start: number;
  end?: number;
  swap?: boolean;
  step?: number;
}

export interface WolfStandardDecorationTypes {
  success: TextEditorDecorationType;
  error: TextEditorDecorationType;
}

export interface WolfDecorations {
  success: DecorationOptions[];
  error: DecorationOptions[];
}

export interface WolfTraceLineResult {
  lineno: number;
  value: string;
  kind: string;
  source: string;
  pretty: string;
  error: boolean;
  calls: number;
  _loop?: boolean;
}

export type WolfParsedTraceResults = WolfTraceLineResult[] | null | undefined;
export type TracerParsedResultTuple = [WolfParsedTraceResults, string]

export interface WolfTracerInterface {
  pythonPath: string;
  fileName: string;
  rootDir: string;
}

export type ActiveTextEditorChangeEventResult = TextEditor | undefined;

export type WolfEvent = 'decorations-changed';
