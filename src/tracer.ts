import * as path from "path";
import { installHunter } from "./hunterInstaller";
import { WolfTracerInterface, WolfParsedTraceResults } from "./types";
import { getActiveEditor, indexOrLast } from "./helpers";
import { spawn } from "child_process"

export function pythonTracerFactory(): PythonTracer {
  return new PythonTracer();
}

export class PythonTracer {
  public tracePythonScriptForActiveEditor({
    pythonPath,
    rootDir,
    afterInstall,
    onData,
    onError
  }: WolfTracerInterface): void {
    return this.tracePythonScriptForDocument({
      pythonPath,
      fileName: getActiveEditor().document.fileName,
      rootDir,
      afterInstall,
      onData,
      onError
    });
  }

  public tracePythonScriptForDocument({
    pythonPath,
    fileName,
    rootDir,
    afterInstall,
    onData,
    onError
  }: WolfTracerInterface): void {
    if (!fileName) return;

    if (this.timeout !== null) {
      clearTimeout(this.timeout)
    }

    const python = this.getPythonRunner(pythonPath, rootDir, fileName);
    this.timeout = setTimeout(function () { python.kill() }, 10 * 1000);

    console.error('Running Python script')
    python.stderr.on("data", (data: Buffer) => {
      if (data.includes("ImportError")) {
        console.error('IMPORT ERROR')
        console.log(data.toString());
        installHunter(pythonPath, afterInstall);
        onError();
      } else {
        console.error('OUTPUT ERROR')
        onError(data.toString());
      }
    });

    python.stdout.on("data", (data: Buffer): void => {
      console.error('RECIEVED DATA:', data.toString())
      onData(this.tryParsePythonData(data) ?? []);
    });
  }

  private timeout: null | NodeJS.Timeout = null;

  private getPythonRunner(pythonPath: string, rootDir: string, scriptName: string) {
    const wolfPath: string = path.join(rootDir, "scripts/wolf.py");
    return spawn(pythonPath, [wolfPath, scriptName]);
  }

  private tryParsePythonData(buffer: Buffer): WolfParsedTraceResults | undefined {
    // move to api
    const asString: string = buffer.toString();
    const index: number = indexOrLast(asString, "WOOF:");
    if (index !== -1) {
      try {
        return JSON.parse(asString.slice(index));
      } catch (err) {
        console.error("Error parsing Wolf output. ->");
        console.error(asString);
        console.error(err);
      }
    } else {
      return null;
    }
  }
}
