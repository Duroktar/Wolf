import * as vscode from "vscode";
import { WolfAPI } from "./api";
import { WolfClient } from "./client";
import { WolfDecorationsController } from "./decorations";
import { ConsoleLogger } from "./logger";
import { WolfOutputController } from "./output";
import { WolfServerDaemon } from "./server";
import { WolfSessionController } from "./sessions";
import { randomString } from "./utils";

export function wolfStandardApiFactory(
  context: vscode.ExtensionContext,
  options: { output: vscode.OutputChannel }
): WolfAPI {
  return new WolfAPI(
    context,
    wolfOutputFactory(options.output),
    wolfDecorationStoreFactory(context),
    wolfSessionStoreFactory(),
  );
}

export function wolfSessionStoreFactory(): WolfSessionController {
  return new WolfSessionController();
}

export function wolfDecorationStoreFactory(
  context: vscode.ExtensionContext,
): WolfDecorationsController {
  return new WolfDecorationsController(context);
}

export function wolfClientFactory(
  identifier: string = randomString(),
  host = '0.0.0.0',
  port = '9879',
): WolfClient {
  return new WolfClient(host, port, identifier);
}

export function wolfServerDaemonFactory(
  wolfApi: WolfAPI,
  host = '0.0.0.0',
  port = '9879',
): WolfServerDaemon {
  return new WolfServerDaemon(
    host,
    port,
    wolfApi.pythonPath,
    wolfApi.rootExtensionDir,
  );
}

export function wolfOutputFactory(channel: vscode.OutputChannel): WolfOutputController {
  return new WolfOutputController(channel);
}

export function consoleLoggerFactory(
  identifier: string,
): ConsoleLogger {
  return new ConsoleLogger(identifier);
}
