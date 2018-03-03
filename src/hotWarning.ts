import { MessageItem, WorkspaceConfiguration, window } from "vscode";

export function hotModeWarningFactory(config: WorkspaceConfiguration) {
  return onSuccess => hotModeWarning(config, onSuccess);
}

function hotModeWarning(config: WorkspaceConfiguration, onSuccess: () => void) {
  const disableWarnings: MessageItem = { title: "Don't ask me again." };
  const cancelHot: MessageItem = { title: "Cancel" };
  const okay: MessageItem = { title: "Okay" };
  window
    .showInformationMessage(
      "Setting Wolf to hot mode causes the file you are editing to be saved " +
        "between throttled changes to the active document. If you are calling " +
        "external resources/apis you should consider cacheing those calls.",
      cancelHot,
      okay
    )
    .then(result => {
      switch (result) {
        case cancelHot:
          return config.update("hot", false);

        case disableWarnings:
          config.update("disableHotModeWarning", true);

        default:
          onSuccess();
      }
    });
}
