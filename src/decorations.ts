import {
  DecorationOptions,
  DecorationRenderOptions,
  TextEditor,
  TextEditorDecorationType,
  window,
  TextLine,
  ExtensionContext,
  WorkspaceConfiguration
} from "vscode";

import {
  WolfColorSelection,
  WolfDecorationOptions,
  wolfHexColor,
  WolfDecorationMapping,
  WolfLineDecoration,
  WolfSessionDecorations,
  WolfStandardDecorationTypes,
  WolfTraceLineResult,
  WolfHexColorMap
} from "./types";

import { getActiveEditor, formatWolfResponseElement } from "./utils";
import { wolfIconProvider } from "./icons";

export function wolfDecorationStoreFactory(
  context: ExtensionContext,
  config: WorkspaceConfiguration
) {
  return new WolfDecorationsController(context, config);
}

export class WolfDecorationsController {
  private _decorations: WolfDecorationMapping = {};
  private _decorationTypes: WolfStandardDecorationTypes;
  private _preparedDecorations: WolfSessionDecorations;
  constructor(
    public context: ExtensionContext,
    public config: WorkspaceConfiguration
  ) {}

  private createGutterDecoration = (
    gutterIconColor: WolfColorSelection,
    leftMargin: number = 3
  ): TextEditorDecorationType => {
    return window.createTextEditorDecorationType({
      after: {
        margin: `0 0 0 ${leftMargin}em`,
        textDecoration: "none"
      },
      gutterIconPath: wolfIconProvider(
        this.context,
        gutterIconColor,
        this.pawprints
      ),
      gutterIconSize: "cover"
    } as DecorationRenderOptions);
  };

  private createWolfDecorationOptions = (
    options: WolfDecorationOptions
  ): DecorationOptions => {
    return {
      range: options.range,
      hoverMessage: {
        language: options.language || "python",
        value: options.hoverText
      },
      renderOptions: {
        after: {
          contentText: options.text,
          fontWeight: "normal",
          fontStyle: "normal",
          color: wolfTextColorProvider(options.color)
        }
      } as DecorationRenderOptions
    } as DecorationOptions;
  };
  public deleteDecorationAtLine = (lineNo: number): void => {
    delete this._decorations[lineNo];
  };

  public deleteDecorationsAndShiftUp = (
    start: number,
    end: number,
    step?: number
  ) => {
    for (let index = start + 1; index <= end + 1; index++) {
      delete this._decorations[index];
    }
    this.shiftDecorationsUp({
      start: start + 1,
      swap: false,
      step: step || end - start
    });
  };

  public getAllDecorations = (): WolfDecorationMapping => {
    return this._decorations;
  };

  public getDecorationAtLine = (lineNo: number): WolfLineDecoration => {
    return this._decorations[lineNo];
  };

  public getDecorationTypes = (): WolfStandardDecorationTypes => {
    return this._decorationTypes;
  };

  public getEmptyDecorations = (): WolfSessionDecorations => {
    return {
      success: [],
      error: []
    } as WolfSessionDecorations;
  };

  private getLineDecorationOrDefault = (lineNo: number): WolfLineDecoration => {
    return (
      this.getDecorationAtLine(lineNo) || ({ data: [] } as WolfLineDecoration)
    );
  };

  public getPreparedDecorations = (): WolfSessionDecorations => {
    if (this._preparedDecorations) {
      return this._preparedDecorations as WolfSessionDecorations;
    } else {
      return this.getEmptyDecorations();
    }
  };

  public parseLineAndSetDecoration = (line: WolfTraceLineResult): void => {
    const lineNo: number = line.line_number;
    const annotation = formatWolfResponseElement(line);
    const existing: WolfLineDecoration = this.getLineDecorationOrDefault(
      lineNo
    );
    const decoration = {
      data: [...existing.data, annotation],
      lineno: line.line_number,
      error: line.error ? true : false,
      loop: line.hasOwnProperty("_loop"),
      source: line.source,
      pretty: line.pretty
    } as WolfLineDecoration;
    this.setDecorationAtLine(lineNo, decoration);
  };

  public prepareDecorations = (): void => {
    const activeEditor: TextEditor = getActiveEditor();

    const decorations: DecorationOptions[] = [];
    const errorDecorations: DecorationOptions[] = [];

    Object.keys(this._decorations).forEach(key => {
      const lineNo: number = parseInt(key, 10);
      const decorationData: WolfLineDecoration = this.getDecorationAtLine(
        lineNo
      );

      if (!decorationData.data || activeEditor.document.lineCount < lineNo) {
        return;
      }

      const textLine: TextLine = activeEditor.document.lineAt(lineNo - 1);
      const decoration: DecorationOptions = this.createWolfDecorationOptions({
        range: textLine.range,
        text: decorationData.data.join(" => "),
        hoverText: decorationData.pretty,
        color: decorationData.error ? "red" : "cornflower"
      } as WolfDecorationOptions);
      (decorationData.error ? errorDecorations : decorations).push(decoration);
    });

    this._preparedDecorations = {
      success: decorations,
      error: errorDecorations
    } as WolfSessionDecorations;
  };

  public reInitDecorationCollection = (): void => {
    this._decorations = {} as WolfDecorationMapping;
  };

  public setDecorationAtLine = (
    lineNo: number,
    decoration: WolfLineDecoration
  ): void => {
    this._decorations[lineNo] = decoration;
  };

  public setDefaultDecorationOptions = (
    successColor: WolfColorSelection,
    errorColor: WolfColorSelection
  ): void => {
    const successDecorationType = this.createGutterDecoration(successColor);
    const errorDecorationType = this.createGutterDecoration(errorColor);
    this._decorationTypes = {
      success: successDecorationType,
      error: errorDecorationType
    };
  };

  public shiftDecorationsDown = ({
    start,
    end = -1,
    swap = true,
    step = 1
  }) => {
    const nextAnnotations = {};
    Object.keys(this._decorations).forEach(key => {
      const intKey = parseInt(key, 10);
      let nextKey;
      if (end !== -1) {
        nextKey = start <= intKey && intKey <= end ? intKey + step : intKey;
      } else {
        nextKey = start <= intKey ? intKey + step : intKey;
      }
      nextAnnotations[nextKey] = { ...this._decorations[key] };
    });
    if (swap) {
      nextAnnotations[start] = { ...this._decorations[end] };
      nextAnnotations[end + 1] = { ...this._decorations[end + 1] };
    }

    this._decorations = { ...nextAnnotations };
  };

  public shiftDecorationsUp = ({ start, end = -1, swap = true, step = 1 }) => {
    const nextAnnotations = {};
    Object.keys(this._decorations).forEach(key => {
      const intKey = parseInt(key, 10);
      let nextKey;
      if (end !== -1) {
        nextKey = start <= intKey && intKey <= end ? intKey - step : intKey;
      } else {
        nextKey = start <= intKey ? intKey - step : intKey;
      }
      nextAnnotations[nextKey] = { ...this._decorations[key] };
    });
    if (swap) {
      nextAnnotations[end] = { ...this._decorations[start] };
      nextAnnotations[start - 1] = { ...this._decorations[start - 1] };
    }
    this._decorations = { ...nextAnnotations };
  };

  public get collection(): WolfDecorationMapping {
    return this._decorations;
  }

  public get pawprints(): boolean {
    return this.config.get("pawPrintsInGutter") ? true : false;
  }
}

const WolfColorMap = {
  cornflower: "#6495ed",
  blue: "#00a1f1",
  green: "#7cbb00",
  red: "#ea2f36"
} as WolfHexColorMap;

function wolfTextColorProvider(color: WolfColorSelection) {
  return WolfColorMap[color] as wolfHexColor;
}
