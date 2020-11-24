import { MessageItem, WorkspaceConfiguration, window, workspace } from "vscode";

export function hotModeWarning(): void {
  const config: WorkspaceConfiguration = workspace.getConfiguration("wolf");
  const disableWarnings: MessageItem = { title: "Don't ask again" };

  const notificationText =
    "Wolf evalutes your code when you stop typing for a while. You can " +
    'change the delay by editing "updateFrequency" in settings. If you ' +
    "are writing changes to the filesystem or calling external API's you " +
    "should consider cacheing the calls or increasing this value.";

  if (config.get("disableHotModeWarning") !== true) {
    window
      .showInformationMessage(notificationText, disableWarnings)
      .then(result => {
        if (result === disableWarnings) {
          config.update("disableHotModeWarning", true);
        }
      });
  }
}
