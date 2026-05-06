const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const children = [];

function startProcess(command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  children.push(child);
  child.on('exit', (code) => {
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

function waitForAngularDevServer(retries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get('http://127.0.0.1:4200', (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (retries <= 0) {
          reject(new Error('No se pudo iniciar Angular en http://127.0.0.1:4200'));
          return;
        }

        retries -= 1;
        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  startProcess('npx', ['ng', 'serve', '--host', '127.0.0.1']);
  await waitForAngularDevServer();
  startProcess('npx', ['electron', '.']);
}

main().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
