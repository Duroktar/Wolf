import {
  DecorationOptions,
  TextEditor,
  TextEditorDecorationType,
  window,
  ExtensionContext,
  Range,
  Position,
  workspace
} from "vscode";
import type {
  WolfColorSelection,
  WolfDecorationOptions,
  WolfDecorationMapping,
  WolfLineDecoration,
  WolfDecorations,
  WolfStandardDecorationTypes,
  WolfTraceLineResult,
  WolfParsedTraceResults,
} from "./types";
import { wolfTextColorProvider } from "./colors";
import { wolfIconProvider } from "./icons";
import { formatWolfResponseElement } from "./helpers";
import { clamp, stringEscape } from "./utils";

import { js as beautify } from "js-beautify";

export function wolfDecorationStoreFactory(
  context: ExtensionContext,
): WolfDecorationsController {
  return new WolfDecorationsController(context);
}

export class WolfDecorationsController {
  private _decorations: WolfDecorationMapping = {};
  private _decorationTypes: WolfStandardDecorationTypes | null = null;
  private _preparedDecorations: WolfDecorations | null = null;

  constructor(public context: ExtensionContext) {}

  public getDecorationTypes = (): WolfStandardDecorationTypes | undefined => {
    if (this._decorationTypes)
      return this._decorationTypes;
  };

  public getEmptyDecorations = (): WolfDecorations => {
    return { success: [], error: [] };
  };

  public getPreparedDecorations = (): WolfDecorations => {
    if (this._preparedDecorations) {
      return this._preparedDecorations;
    } else {
      return this.getEmptyDecorations();
    }
  };

  public prepareParsedPythonData = (data: WolfParsedTraceResults): void => {
    for (const line of data ?? []) {
      this.setDecorationAtLine(line);
    }
  };

  public reInitDecorationCollection = (): void => {
    this._decorations = {};
  };

  public setDefaultDecorationOptions = (
    successColor: WolfColorSelection,
    errorColor: WolfColorSelection
  ): void => {
    this._decorationTypes = {
      success: this.createGutterDecorations(successColor),
      error: this.createGutterDecorations(errorColor),
    };
  };

  public setPreparedDecorationsForEditor = (editor: TextEditor): void => {
    const decorations: DecorationOptions[] = [];
    const errorDecorations: DecorationOptions[] = [];

    Object.keys(this._decorations).forEach(key => {
      const lineNo = parseInt(key, 10);
      const lineIndex = lineNo - 1;
      const decorationData = this.getDecorationAtLine(lineNo);

      if (!decorationData.data || editor.document.lineCount < lineNo) {
        return;
      }

      const textLine = editor.document.lineAt(lineIndex);
      const source = textLine.text;
      const decoRange = new Range(
        new Position(lineIndex, textLine.firstNonWhitespaceCharacterIndex),
        new Position(lineIndex, textLine.text.indexOf(source) + source.length)
      );

      const decoration = this.createWolfDecorationOptions({
        range: decoRange,
        text: decorationData.data.join(" => "), // This seperator should be adjustable from the config
        hoverText: decorationData.pretty.join("\n"),
        color: decorationData.error ? "red" : "cornflower"
      });

      if (decorationData.error)
        errorDecorations.push(decoration)
      else
        decorations.push(decoration)
    });

    this._preparedDecorations = {
      success: decorations,
      error: errorDecorations
    };
  };

  public get hasDecorations(): boolean {
    return Object.keys(this._decorations).length > 0;
  }


  private createWolfDecorationOptions = (
    options: WolfDecorationOptions
  ): DecorationOptions => {
    const truncLength = workspace
      .getConfiguration("wolf")
      .get<number>("maxLineLength") ?? 100;
    const textLength = options.text.length;
    const ellipsis = textLength > truncLength ? " ..." : "";
    return {
      range: options.range,
      hoverMessage: {
        language: options.language || "python",
        value: options.hoverText
      },
      renderOptions: {
        after: {
          contentText:
            options.text.slice(0, clamp(1, 1000, truncLength)) + ellipsis,
          fontWeight: "normal",
          fontStyle: "normal",
          color: wolfTextColorProvider(options.color)
        }
      }
    };
  };

  private createGutterDecorations = (
    gutterIconColor: WolfColorSelection,
    leftMargin = 3
  ): TextEditorDecorationType => {
    return window.createTextEditorDecorationType({
      after: {
        margin: `0 0 0 ${leftMargin}em`,
        textDecoration: "none"
      },
      isWholeLine: true,
      rangeBehavior: 1,
      overviewRulerLane: 1,
      overviewRulerColor: wolfTextColorProvider(gutterIconColor),
      gutterIconPath: wolfIconProvider(
        this.context,
        gutterIconColor,
        this.pawprints
      ),
      gutterIconSize: "cover"
    });
  };

  private getDecorationAtLine = (lineNo: number): WolfLineDecoration => {
    return this._decorations[lineNo];
  };

  private getDecorationAtLineOrDefault = (lineNo: number): WolfLineDecoration => {
    return (this.getDecorationAtLine(lineNo) || { data: [], pretty: [] });
  };

  private setDecorationAtLine = (line: WolfTraceLineResult): void => {
    const lineNo = line.lineno;
    const { data, pretty } = this.getDecorationAtLineOrDefault(lineNo);
    const annotation = formatWolfResponseElement(line);

    this._decorations[lineNo] = {
      data: [...data, stringEscape(annotation)],
      lineno: lineNo,
      error: line.error ? true : false,
      loop: line["_loop"],
      pretty: [...pretty, beautify(line.value, {
        indent_size: 4,
        space_in_empty_paren: true
      })]
    };
  };

  private get pawprints(): boolean {
    return workspace
      .getConfiguration("wolf")
      .get<boolean>("pawPrintsInGutter") ?? false;
  }
}
