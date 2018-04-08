import * as path from "path";
import { installHunter } from "./hunterInstaller";
import { WolfTracerInterface, WolfParsedTraceResults } from "./types";
import { getActiveEditor, indexOrLast } from "./utils";
import { spawn } from "child_process"

export function pythonTracerFactory() {
  return new PythonTracer();
}

export class PythonTracer {
  private timeout = null;

  private getPythonRunner(pythonPath: string, rootDir: string, scriptName: string) {
    const wolfPath: string = path.join(rootDir, "scripts/wolf.py");
    return spawn(pythonPath, [wolfPath, scriptName]);
  }

  public tracePythonScriptForActiveEditor({
    pythonPath,
    rootDir,
    afterInstall,
    onData,
    onError
  }: WolfTracerInterface) {
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
  }: WolfTracerInterface) {
    if (!fileName) return;

    if (this.timeout !== null) {
      clearTimeout(this.timeout)
    }
    const python = this.getPythonRunner(pythonPath, rootDir, fileName);
    this.timeout = setTimeout(function () { python.kill() }, 10 * 1000);

    python.stderr.on("data", (data: Buffer) => {
      if (data.includes("ImportError")) {
        console.log(data.toString())
        onError(installHunter(pythonPath, afterInstall));
      } else {
        onError(data.toString());
      }
    });

    python.stdout.on("data", (data: Buffer): void => {
      const wolfResults: WolfParsedTraceResults = this.tryParsePythonData(data);
      onData(wolfResults || ([] as WolfParsedTraceResults));
    });
  }

  private tryParsePythonData(jsonish: Buffer): WolfParsedTraceResults {
    // move to api
    const asString: string = jsonish.toString();
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
