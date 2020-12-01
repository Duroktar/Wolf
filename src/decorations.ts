import * as vscode from "vscode";
import type * as T from "./types";
import { consoleLoggerFactory } from "./factories";
import { wolfTextColorProvider } from "./colors";
import { wolfIconProvider } from "./icons";
import { formatWolfResponseElement } from "./helpers";
import { clamp, nameOf, stringEscape } from "./utils";

import { js as beautify } from "js-beautify";


export class WolfDecorationsController {
  private _logger = consoleLoggerFactory(nameOf(WolfDecorationsController))

  constructor(private context: vscode.ExtensionContext) {}

  public init = (liveMode?: boolean): T.WolfSessionInit => {
    const decorationTypes = this.createDecorationTypes(
      liveMode ? 'orange' : 'green'
    );
    return { decorationTypes, decorations: {} };
  };

  public set = (
    session: T.WolfSession,
    lines: T.WolfTraceLineResult[] = [],
  ): void => {
    session.decorations = lines.reduce((accum, line) => {
      this.setDataAtLine(accum, line);
      return accum
    }, {})
  };

  public setDataAtLine = (
    decorations: T.WolfDecorationMapping,
    line: T.WolfTraceLineResult,
  ): void => {
    const lineNo = line.lineno;
    const { data, pretty } = decorations[lineNo] ?? { data: [], pretty: [] };
    const annotation = formatWolfResponseElement(line);

    decorations[lineNo] = {
      data: [...data, stringEscape(annotation)],
      lineno: lineNo,
      error: line.error ? true : false,
      loop: line["_loop"],
      pretty: [...(pretty ?? []), beautify(line.value, {
        indent_size: 4,
        space_in_empty_paren: true
      })]
    };
  };

  public render = (
    session: T.WolfSession,
  ): void => {
    this.setEditorDecorations(
      session.editor,
      session.decorationTypes,
      this.createWolfDecorations(session),
    )
  }

  public renderTo = (
    editor: vscode.TextEditor,
    session: T.WolfSession,
  ): void => {
    this.setEditorDecorations(
      editor,
      session.decorationTypes,
      this.createWolfDecorations(session),
    )
  }

  public clear = (
    session: T.WolfSession,
  ): void => {
    this.setEditorDecorations(
      session.editor,
      session.decorationTypes,
      this.getEmptyWolfDecorations(),
    )
  }

  public clearFor = (
    editor: vscode.TextEditor,
    session: T.WolfSession,
  ): void => {
    this.setEditorDecorations(
      editor,
      session.decorationTypes,
      this.getEmptyWolfDecorations(),
    )
  }

  private setEditorDecorations = (
    editor: vscode.TextEditor,
    decorationTypes: T.WolfDecorationTypes,
    decorations: T.WolfDecorations,
  ): void => {
    this._logger.debug('Rendering')
    editor.setDecorations(decorationTypes.success, decorations.success);
    editor.setDecorations(decorationTypes.error, decorations.error);
  };

  private createLineDecoration(
    session: T.WolfSession,
    lineno: string,
  ): [vscode.DecorationOptions, T.WolfLineDecoration] | [] {
    const { decorations, editor } = session
    const line = parseInt(lineno, 10);
    const lineIndex = line - 1;
    const decorationData = decorations[line];

    if (!decorationData.data || editor.document.lineCount < line) {
      return [];
    }

    const textLine = editor.document.lineAt(lineIndex);
    const source = textLine.text;
    const decoRange = new vscode.Range(
      new vscode.Position(lineIndex, textLine.firstNonWhitespaceCharacterIndex),
      new vscode.Position(lineIndex, textLine.text.indexOf(source) + source.length)
    );

    const decoration = this.createWolfDecorationOptions({
      range: decoRange,
      text: decorationData.data.join(" => "), // TODO: This seperator should be adjustable from the config
      hoverText: decorationData.pretty?.join("\n") ?? '',
      color: decorationData.error ? "red" : "cornflower"
    });

    return [ decoration, decorationData ]
  }

  private createWolfDecorationOptions = (
    options: T.WolfDecorationOptions
  ): vscode.DecorationOptions => {
    const truncLength = vscode.workspace
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

  private createDecorationTypes = (
    successColor: T.WolfColorSelection = 'green',
    errorColor: T.WolfColorSelection = 'red',
  ): T.WolfDecorationTypes => {
    return {
      success: this.createGutterDecorations(successColor),
      error: this.createGutterDecorations(errorColor),
    };
  };

  private createGutterDecorations = (
    gutterIconColor: T.WolfColorSelection,
    leftMargin = 3
  ): vscode.TextEditorDecorationType => {
    return vscode.window.createTextEditorDecorationType({
      after: {
        margin: `0 0 0 ${leftMargin}em`,
        textDecoration: "none"
      },
      isWholeLine: true,
      rangeBehavior: 1,
      overviewRulerLane: 1,
      overviewRulerColor: wolfTextColorProvider(gutterIconColor),
      gutterIconPath: wolfIconProvider(this.context, gutterIconColor, this.pawprints),
      gutterIconSize: "cover"
    });
  };

  private createWolfDecorations = (
    session: T.WolfSession,
  ): T.WolfDecorations => {
    this._logger.debug('Preparing')
    const { decorations } = session

    const prepared = {
      success: [] as vscode.DecorationOptions[],
      error: [] as vscode.DecorationOptions[],
    }
    
    Object.keys(decorations).forEach(lineno => {
      const [
        vscodeDecoration,
        wolfDecoration,
      ] = this.createLineDecoration(session, lineno)

      if (vscodeDecoration && wolfDecoration) {
        if (wolfDecoration.error)
          prepared.error.push(vscodeDecoration)
        else
          prepared.success.push(vscodeDecoration)
      }
    });

    return prepared;
  };

  private getEmptyWolfDecorations = (): T.WolfDecorations => {
    return { success: [], error: [] };
  };

  private get pawprints(): boolean {
    return vscode.workspace
      .getConfiguration("wolf")
      .get<boolean>("pawPrintsInGutter") ?? false;
  }
}
