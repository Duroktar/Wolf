import { MessageItem, WorkspaceConfiguration, window } from "vscode";

export function hotModeWarningFactory(config: WorkspaceConfiguration) {
  return onSuccess => hotModeWarning(config, onSuccess);
}

function hotModeWarning(config: WorkspaceConfiguration, onSuccess: () => void) {
  const disableWarnings: MessageItem = { title: "Don't ask again" };
  if (config.get("disableHotModeWarning") !== true) {
    window
      .showInformationMessage(
        "Setting Wolf to hot mode causes the file you are editing to be saved " +
          "between throttled changes to the active document. If you are calling " +
          "external resources/apis you should consider cacheing those calls.",
        disableWarnings
      )
      .then(result => {
        switch (result) {
          case disableWarnings:
            config.update("disableHotModeWarning", true);

          default:
            onSuccess();
        }
      });
  }
}
