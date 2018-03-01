import {
  TextDocumentChangeEvent,
  TextDocument,
  TextEditor,
  WorkspaceConfiguration
} from "vscode";
import { annotatedLineIsChanged, getActiveEditor } from "./utils";
import { WolfDecorationsController } from "./decorations";

export function wolfStickyControllerFactory(
  config: WorkspaceConfiguration,
  decorationController: WolfDecorationsController
) {
  return new WolfStickyController(config, decorationController);
}

export class WolfStickyController {
  constructor(
    private config: WorkspaceConfiguration,
    private decorationController: WolfDecorationsController
  ) {}

  public updateStickyDecorations = (
    event: TextDocumentChangeEvent,
    oldLineCount: number
  ): void => {
    const activeEditor: TextEditor = getActiveEditor();
    const activeDocument: TextDocument = activeEditor.document;
    const diff = event.document.lineCount - oldLineCount;

    const decorations = this.decorationController.getAllDecorations();

    if (event.contentChanges.length === 1) {
      const { range, range: { start, end }, text } = event.contentChanges[0];
      // const actualStartLineNo: number = start.line + 1;
      const actualEndLineNo: number = end.line + 1;

      if (event.document.lineCount != oldLineCount) {
        if (event.document.lineCount > oldLineCount) {
          // Added lines
          if (event.contentChanges[0].text.startsWith("\n")) {
            if (start.character > 0) {
              if (
                annotatedLineIsChanged(activeDocument, start.line, decorations)
              ) {
                this.decorationController.deleteDecorationAtLine(
                  start.line + 1
                );
              }
            }
            if (end.character > 0) {
              if (
                annotatedLineIsChanged(activeDocument, end.line, decorations)
              ) {
                this.decorationController.deleteDecorationAtLine(end.line + 1);
              }
            }

            const bias = start.character === 0 && end.character === 0 ? 1 : 2;
            this.decorationController.shiftDecorationsDown({
              start: end.line + bias,
              swap: false,
              step: diff
            });
          }
        } else if (event.document.lineCount < oldLineCount) {
          const diff = oldLineCount - event.document.lineCount;
          //                     vvv  NOTE: Won't this always be an empty string?
          if (diff === 1 && text === "") {
            // CASE: Only a single line affected
            if (start.character === 0 && end.character === 0) {
              // Delete/Backspace an empty line to end of empty line
              this.decorationController.deleteDecorationsAndShiftUp(
                start.line,
                start.line,
                1
              );
            } else {
              if (start.character > 0) {
                // Delete/Backspace an empty line to the end of non empty line
                if (
                  annotatedLineIsChanged(
                    activeDocument,
                    start.line,
                    decorations
                  )
                ) {
                  delete decorations[start.line + 1];
                }
              }
              if (end.character > 0) {
                if (
                  annotatedLineIsChanged(activeDocument, end.line, decorations)
                ) {
                  delete decorations[end.line + 1];
                }
              }
              this.decorationController.shiftDecorationsUp({
                start: end.line + 1,
                swap: false,
                step: diff
              });
            }
          } else {
            // CASE: Multiple lines affected
            if (start.character === 0) {
              // edit beginning IS AT the start of a line
              if (end.character === 0) {
                // edit ending IS AT the start of a line  (delete annotation on that line)
                this.decorationController.deleteDecorationsAndShiftUp(
                  start.line,
                  start.line,
                  1
                );
              } else {
                // edit ending NOT AT the start of a line (delete decorations on all affected lines)
                this.decorationController.deleteDecorationsAndShiftUp(
                  start.line,
                  end.line
                );
              }
            } else {
              // edit beginning NOT AT start of a line
              this.decorationController.deleteDecorationsAndShiftUp(
                start.line + 1,
                end.line
              );
            }
          }
        }
      } else if (range.isSingleLine) {
        if (annotatedLineIsChanged(activeDocument, end.line, decorations)) {
          // same line edit that changed the original characters (delete annotation on that line)
          delete decorations[actualEndLineNo];
        }
      }
    } else if (event.contentChanges.length === 2) {
      // Multi line or indented edit
      if (activeEditor.selections.length === 1) {
        if (
          event.contentChanges[0].text.startsWith("\n") &&
          event.contentChanges[1].text === ""
        ) {
          // Newline at end of blank indented line
          const { range: { start, end } } = event.contentChanges[0];
          if (start.character > 0) {
            if (
              annotatedLineIsChanged(activeDocument, start.line, decorations)
            ) {
              this.decorationController.deleteDecorationAtLine(start.line + 1);
            }
          }
          this.decorationController.shiftDecorationsDown({
            start: end.line,
            swap: false,
            step: diff
          });
        }
        // whats this for?
        const start: number = event.contentChanges[1].range.end.line;
        const end: number = event.contentChanges[0].range.end.line;
        if (event.contentChanges[0].text === "") {
          this.decorationController.shiftDecorationsDown({
            start: start + 1,
            end: end + 1
          });
        } else if (event.contentChanges[1].text === "") {
          this.decorationController.shiftDecorationsUp({ start, end: end + 1 });
        }
      }
    }
  };
}
