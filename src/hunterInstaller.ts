import * as vscode from "vscode";

const { spawn } = require("child_process");

export function installHunter(postInstallHook: () => void) {
  // This means the 'hunter' package is not installed .. Notify
  // and offer to install for user automatically.
  const installHunter: vscode.MessageItem = { title: "Install Package" };
  vscode.window
    .showInformationMessage(
      "Wolf requires the hunter package. Install now or run 'pip install hunter --user' manually.",
      installHunter
    )
    .then(result => {
      if (result === installHunter) {
        const child = spawn("pip", ["install", "hunter", "--user"]);
        child.stderr.on("data", data => {
          console.error("INSTALL_ERROR:", data + "");
        });
        child.on("close", code => {
          if (code !== 0) {
            vscode.window.showWarningMessage(
              [
                "There was an error attempting to install hunter. Please try running",
                "'pip install hunter --user' manually."
              ].join(" ")
            );
          } else {
            vscode.window.showInformationMessage(
              "Hunter installed successfully. Re-running Wolf.."
            );
            postInstallHook();
          }
        });
      }
    });
}
