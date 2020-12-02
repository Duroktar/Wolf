import type {
  DecorationOptions,
  Range,
  TextEditor,
  TextEditorDecorationType
} from "vscode";

// -- Colors
export type WolfIcon = string;
export type WolfHexColor = string;
export type WolfColorSelection = "red" | "cornflower" | "blue" | "green" | "orange";
export type WolfIconColor = "red" | "green" | "blue" | "orange";

export type WolfHexColorType = { [P in WolfColorSelection]: WolfHexColor };
export type WolfIconColorType = { [P in WolfColorSelection]: WolfIconColor };

// -- Sessions
export type WolfSession = {
  decorationTypes: WolfDecorationTypes;
  decorations: WolfDecorationMapping;
  editor: TextEditor;
  isLiveEditing: boolean;
};

export type WolfSessionInit = Pick<WolfSession, 'decorationTypes' | 'decorations'>

export type WolfActiveSessionCollection = Record<string, WolfSession>

// -- Decorations
export interface WolfGutterDecorationOptions {
  gutterIconColor: WolfColorSelection;
  leftMargin?: number;
}

export interface WolfLineDecoration {
  data: string[];
  lineno: number;
  error?: boolean;
  loop?: boolean;
  source?: string;
  pretty?: string[];
  calls?: number;
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

export interface WolfDecorationTypes {
  success: TextEditorDecorationType;
  error: TextEditorDecorationType;
}

export interface WolfDecorations {
  success: DecorationOptions[];
  error: DecorationOptions[];
}

// -- Wolf
export type WolfResponse = Record<string, string>

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

// -- Client
export type BaseWolfClientResponse = {
  statusCode: number;
  path: string;
};

export type WolfClientErrorResponse = BaseWolfClientResponse & {
  message: string;
}

export type WolfClientEofResponse = BaseWolfClientResponse & {
  total_output: string;
  eof: number;
}

export type WolfClientDataResponse = BaseWolfClientResponse & {
  output: string;
}

export type WolfClientErrorCallback = (err: Error) => void
export type WolfClientOnErrorEventCallback = (data: WolfClientErrorResponse) => void
export type WolfClientOnEofEventCallback = (data: WolfClientEofResponse) => void
export type WolfClientOnDataCallback = (data: WolfClientDataResponse) => void

export type WolfClientEventCallbackMap = {
  ready: AnyFunc;
  close: AnyFunc;
  data: WolfClientOnDataCallback;
  eof: WolfClientOnEofEventCallback;
  error: WolfClientErrorCallback;
}

export type WolfClientEvent = keyof WolfClientEventCallbackMap


// -- Events
export type ActiveTextEditorChangeEventResult = TextEditor | undefined;

export type WolfEvent =
  | 'connection-closed'
  | 'connection-error'
  | 'decorations-changed'
  | 'decorations-error'
  | 'decorations-updated';


// -- Utils
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ANY = any

export type AnyFunc = (...args: ANY[]) => void;
export type AnyFuncAsync = (...args: ANY[]) => Promise<void>;

export interface ILogger {
  info(...args: ANY[]): void
  log(...args: ANY[]): void
  error(...args: ANY[]): void
  warn(...args: ANY[]): void
  debug(...args: ANY[]): void
}
