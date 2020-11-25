import * as fs from 'fs';
import { dirname } from 'path';
import * as vscode from 'vscode';

export async function createTextDocument(content: string, language?: string): Promise<vscode.TextDocument> {
  return await vscode.workspace.openTextDocument({ language, content });
}

export function setActiveTextEditor(editor: vscode.TextEditor): void {
  vscode.window.activeTextEditor = editor
}

export async function openAndShowTextDocument(filepath: string): Promise<vscode.TextEditor> {
  const uri = vscode.Uri.parse('file:' + filepath, true);
  console.log('filepath:', 'file:' + filepath)
  console.log('uri:', uri)
  listFiles(dirname(filepath))
  const document = await vscode.workspace.openTextDocument(uri);
  return await vscode.window.showTextDocument(document, { preview: false });
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function listFiles(directory: string): void {
  try {
    const files = fs.readdirSync(directory);
    console.log('Files: --------');
    files.forEach(file => {
      console.log(file);
    });
  } catch (err) {
    console.log(err);
  }
  console.log('--------------');
}
