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
    wolfServerDaemonFactory()
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
  host = '127.0.0.1',
  port = '9879',
  authToken?: string,
): WolfClient {
  return new WolfClient(host, port, identifier, authToken);
}

export function wolfServerDaemonFactory(
  host = '127.0.0.1',
  port = '9879',
): WolfServerDaemon {
  return new WolfServerDaemon(
    host,
    port,
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
