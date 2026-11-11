import * as path from 'path';
import * as net from 'net';

import { runTests } from '@vscode/test-electron';


async function findAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to allocate a local test port'));
        return;
      }
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}


async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const port = await findAvailablePort();
    const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH;

    // Reuse a provided VS Code executable, or let test-electron resolve/download one.
    await runTests({
      ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
      extensionTestsEnv: { WOLF_SERVER_PORT: String(port) },
    });
  } catch (err) {
    console.error(err);
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
