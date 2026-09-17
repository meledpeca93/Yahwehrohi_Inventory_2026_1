const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const children = [];
const apiHealthUrl = 'http://127.0.0.1:3000/api/health';
const angularDevUrl = 'http://127.0.0.1:4200';
let electronProcess = null;
let electronRestartTimer = null;

function startProcess(command, args, extraEnv = {}, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: process.platform === 'win32' ? 'ignore' : 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });

  children.push(child);
  child.on('exit', (code) => {
    if (options.shutdownOnExit) {
      shutdown(code || 0);
      return;
    }

    if (code !== 0) {
      shutdown(code || 1);
    }
  });

  return child;
}

function shutdown(code) {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill('SIGINT');
    }
  }

  process.exit(code);
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(true);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(2500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, retries, errorMessage) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (await checkUrl(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(errorMessage);
}

function waitForAngularDevServer(retries = 120) {
  return waitForUrl(angularDevUrl, retries, `No se pudo iniciar Angular en ${angularDevUrl}`);
}

async function ensureApiDevServer() {
  if (await checkUrl(apiHealthUrl)) {
    return;
  }

  startProcess('node', ['server/server.js']);
  await waitForUrl(apiHealthUrl, 60, 'No se pudo iniciar el API en http://127.0.0.1:3000');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  await ensureApiDevServer();
  startProcess('npx', ['ng', 'serve', '--host', '127.0.0.1', '--proxy-config', 'proxy.conf.json']);
  await waitForAngularDevServer();
  startElectron();
  watchElectronBackendFiles();
}

function startElectron() {
  electronProcess = startProcess('npx', ['electron', '.'], { ELECTRON_DEV: 'true' }, { shutdownOnExit: true });
}

function restartElectron(reason) {
  if (electronRestartTimer) {
    clearTimeout(electronRestartTimer);
  }

  electronRestartTimer = setTimeout(() => {
    console.log(`Reiniciando Electron por cambio en ${reason}`);

    if (electronProcess && !electronProcess.killed) {
      const previousElectronProcess = electronProcess;
      electronProcess = null;
      previousElectronProcess.removeAllListeners('exit');
      previousElectronProcess.kill('SIGINT');
    }

    startElectron();
  }, 350);
}

function watchElectronBackendFiles() {
  const watchedDirectories = [
    path.join(rootDir, 'electron'),
    path.join(rootDir, 'server'),
  ];

  for (const directory of watchedDirectories) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    fs.watch(directory, { recursive: true }, (_eventType, fileName) => {
      const changedFile = String(fileName || '');

      if (!changedFile || !/\.(js|json|sql)$/i.test(changedFile)) {
        return;
      }

      restartElectron(path.join(path.basename(directory), changedFile));
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
