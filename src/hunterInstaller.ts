import * as vscode from "vscode";
import { spawn } from "child_process";

const installerMessage: vscode.MessageItem = { title: "Install Package" };

export function installHunter(pythonPath: string, postInstall: () => void, onError = () => null): void {
  // This means the 'hunter' package is not installed .. Notify
  // and offer to install for user automatically.
  vscode.window
    .showInformationMessage(
      "Wolf requires the hunter package. Install now or run 'pip install hunter --user' manually.",
      installerMessage
    )
    .then(result => {
      if (result === installerMessage) {
        const child = spawn(pythonPath, ["-m", "pip", "install", "hunter", "--user"]);
        child.stderr.on("data", data => {
          console.error("INSTALL_ERROR:", data + "");
          onError();
        });
        child.on("close", code => {
          if (code !== 0) {
            vscode.window.showWarningMessage(
              [
                "There was an error attempting to install hunter. Please try running",
                "'pip install hunter --user' manually."
              ].join(" ")
            );
            onError();
          } else {
            vscode.window.showInformationMessage(
              "Hunter installed successfully. Re-running Wolf.."
            );
            postInstall();
          }
        });
      }
    });
}
