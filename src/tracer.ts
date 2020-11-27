import * as path from "path";
import { spawn } from "child_process"
import { indexOrLast } from "./helpers";
import { WolfOutputController } from "./output";
import { WolfTracerInterface, TracerParsedResultTuple } from "./types";

export function pythonTracerFactory(output: WolfOutputController): PythonTracer {
  return new PythonTracer(output);
}

export class PythonTracer {
  constructor(
    private outputPanel: WolfOutputController,
    private displayPythonOutput = true
  ) { }

  public tracePythonScript = async (
    options: WolfTracerInterface,
  ): Promise<TracerParsedResultTuple> => {
    return new Promise((resolve, reject) => {
      const { fileName, pythonPath, rootDir } = options

      if (this.timeout !== null) {
        clearTimeout(this.timeout)
      }
  
      const python = this.getPythonRunner(pythonPath, rootDir, fileName);
      this.timeout = setTimeout(function () { python.kill() }, 10 * 1000);
  
      python.stderr.on("data", (data: Buffer) => {
        reject(data.toString());
      });
  
      python.stdout.on("data", (data: Buffer): void => {
        resolve(this.tryParsePythonData(data));
      });
    })
  }

  public getPythonMajorVersion(pythonPath: string): Promise<string> {
    const child = spawn(pythonPath, ['--version']);
    return new Promise((resolve, reject) => {
      child.stderr.on('data', err => {
        reject(err)
      })
      child.stdout.on('data', (data: Buffer) => {
        resolve(data.toString().split(' ')[1].split('.')[0])
      })
    })
  }

  private timeout: null | NodeJS.Timeout = null;

  private getPythonRunner(pythonPath: string, rootDir: string, scriptName: string) {
    const wolfPath: string = path.join(rootDir, "scripts/wolf.py");
    const options = { env: { ...process.env } as Record<string, string> }
    
    /* Copied from https://github.com/Almenon/AREPL-backend/blob/209eb5b8ae8cda1677f925749a10cd263f6d9860/index.ts#L85-L93 */
    if (process.platform == "darwin") {
			// needed for Mac to prevent ENOENT
			options.env.PATH = ["/usr/local/bin", process.env.PATH].join(":")
		}
    else if (process.platform == "win32") {
			// needed for windows for encoding to match what it would be in terminal
			// https://docs.python.org/3/library/sys.html#sys.stdin
      options.env.PYTHONIOENCODING = 'utf8'
    }

    return spawn(pythonPath, [wolfPath, scriptName], options);
  }

  private tryParsePythonData = (buffer: Buffer): TracerParsedResultTuple => {
    const asString: string = buffer.toString();
    const index: number = indexOrLast(asString, "WOOF:");
    if (index !== -1) {
      try {
        return [
          JSON.parse(asString.slice(index)), // Trace Results
          asString.slice(0, index - "WOOF:".length),
        ];
      } catch (err) {
        console.error("Error parsing Wolf output. ->");
        console.error(asString);
        console.error(err);
      }
    }
    return [undefined, asString];
  }
}
