import * as path from "path";
import { installHunter } from "./hunterInstaller";
import { WolfTracerInterface, WolfParsedTraceResults } from "./types";
import { getActiveEditor, indexOrLast } from "./utils";

const { spawn } = require("child_process");

export function pythonTracerFactory() {
  return new PythonTracer();
}

export class PythonTracer {
  private timeout = null;

  private getPythonRunner(rootDir: string, scriptName: string) {
    const wolfPath: string = path.join(rootDir, "scripts/wolf.py");
    return spawn("python", [wolfPath, scriptName]);
  }

  public tracePythonScriptForActiveEditor({
    rootDir,
    afterInstall,
    onData,
    onError
  }: WolfTracerInterface) {
    return this.tracePythonScriptForDocument({
      fileName: getActiveEditor().document.fileName,
      rootDir,
      afterInstall,
      onData,
      onError
    });
  }

  public tracePythonScriptForDocument({
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
    const python = this.getPythonRunner(rootDir, fileName);
    this.timeout = setTimeout(function(){ python.kill()}, 10 * 1000);
    

    python.stderr.on("data", (data: Buffer) => {
      if (data.includes("IMPORT_ERROR")) {
        onError(installHunter(afterInstall));
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
