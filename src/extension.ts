import * as vscode from 'vscode';

const PYTHON: vscode.DocumentFilter = { language: 'python' };

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {

    console.log('decorator sample is activated');

    let activeEditor = vscode.window.activeTextEditor;

    // create a decorator type that we use to decorate small numbers
    const smallNumberDecorationType = vscode.window.createTextEditorDecorationType({
        borderWidth: '1px',
        borderStyle: 'solid',
        overviewRulerColor: 'blue',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        light: {
            // this color will be used in light color themes
            borderColor: 'darkblue'
        },
        dark: {
            // this color will be used in dark color themes
            borderColor: 'lightblue'
        }
    });

    // create a decorator type that we use to decorate large numbers
    const largeNumberDecorationType = vscode.window.createTextEditorDecorationType({
        cursor: 'crosshair',
        backgroundColor: 'rgba(255,0,0,0.3)'
    });

    // if (activeEditor) {
    //     triggerUpdateDecorations();
    // }

    // vscode.window.onDidChangeActiveTextEditor(editor => {
    //     activeEditor = editor;
    //     if (editor) {
    //         triggerUpdateDecorations();
    //     }
    // }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(event => {
        if (activeEditor && event.fileName === activeEditor.document.fileName) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    var timeout = null;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, 500);
    }

    function updateDecorations() {
        if (!activeEditor) {
            return;
        }
        const regEx = /\d+/g;
        const text = activeEditor.document.getText();
        const smallNumbers: vscode.DecorationOptions[] = [];
        const largeNumbers: vscode.DecorationOptions[] = [];
        let match;
        while (match = regEx.exec(text)) {
            const startPos = activeEditor.document.positionAt(match.index);
            const endPos = activeEditor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Number **' + match[0] + '**' };
            if (match[0].length < 3) {
                smallNumbers.push(decoration);
            } else {
                largeNumbers.push(decoration);
            }
        }
        activeEditor.setDecorations(smallNumberDecorationType, smallNumbers);
        activeEditor.setDecorations(largeNumberDecorationType, largeNumbers);
    }
    let disposable = vscode.commands.registerCommand('extension.barkAtCurrentFile', () => {
        return
    });

    context.subscriptions.push(disposable);

}