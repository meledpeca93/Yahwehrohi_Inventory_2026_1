#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const recoveryRoot = path.join(projectRoot, 'recovery');
const logsDir = path.join(recoveryRoot, 'logs');
const backupsDir = path.join(recoveryRoot, 'backups');
const checkpointsFile = path.join(recoveryRoot, 'checkpoints.json');
const frontendPort = Number(process.env.YR_FRONTEND_PORT || 4200);
const backendPort = Number(process.env.PORT || 3000);
const backendHealthUrl = `http://127.0.0.1:${backendPort}/api/health`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const angularCliScript = path.join(projectRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

function ensureRecoveryDirs() {
  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(backupsDir, { recursive: true });
}

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '_' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');
}

function compactStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function logAction(action, details = {}) {
  ensureRecoveryDirs();
  const row = {
    at: new Date().toISOString(),
    action,
    ...details,
  };
  const file = path.join(logsDir, `recovery-${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(file, `${JSON.stringify(row)}${os.EOL}`, 'utf8');
  return row;
}

function printHeader() {
  console.log('');
  console.log('YR RECOVERY TOOL');
  console.log('================');
}

function mask(value) {
  if (!value) {
    return '';
  }
  return '***';
}

function run(command, args = [], options = {}) {
  const startedAt = Date.now();
  const useShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    shell: useShell,
    timeout: options.timeoutMs || 120000,
    windowsHide: true,
  });

  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : '',
    stdout,
    stderr,
    durationMs: Date.now() - startedAt,
    command: `${command} ${args.join(' ')}`.trim(),
  };
}

function runForLog(command, args = [], options = {}) {
  const result = run(command, args, options);
  logAction('command', {
    command: result.command,
    ok: result.ok,
    status: result.status,
    durationMs: result.durationMs,
    stdoutTail: tail(result.stdout, 3000),
    stderrTail: tail(result.stderr, 3000),
  });
  return result;
}

function gitEnv() {
  const name = run('git', ['config', 'user.name']).stdout || 'YR Recovery Tool';
  const email = run('git', ['config', 'user.email']).stdout || 'yr-recovery@example.local';
  return {
    GIT_AUTHOR_NAME: name.trim(),
    GIT_AUTHOR_EMAIL: email.trim(),
    GIT_COMMITTER_NAME: name.trim(),
    GIT_COMMITTER_EMAIL: email.trim(),
  };
}

function tail(text, maxChars = 2000) {
  const value = String(text || '');
  return value.length > maxChars ? value.slice(value.length - maxChars) : value;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}${os.EOL}`, 'utf8');
}

function loadCheckpoints() {
  return readJson(checkpointsFile, { checkpoints: [] });
}

function saveCheckpoints(data) {
  writeJson(checkpointsFile, {
    checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
  });
}

function isGitRepo() {
  return fs.existsSync(path.join(projectRoot, '.git')) && run('git', ['rev-parse', '--is-inside-work-tree']).ok;
}

function currentCommit() {
  const result = run('git', ['rev-parse', 'HEAD']);
  return result.ok ? result.stdout.trim() : '';
}

function currentBranch() {
  const result = run('git', ['branch', '--show-current']);
  return result.ok ? result.stdout.trim() : '';
}

function gitStatusShort() {
  const result = run('git', ['status', '--short']);
  return result.ok ? result.stdout : '';
}

function hasPackageScript(scriptName) {
  const pkg = readJson(path.join(projectRoot, 'package.json'), {});
  return Boolean(pkg.scripts && pkg.scripts[scriptName]);
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(900);
    socket.once('connect', () => {
      socket.destroy();
      resolve({ port, open: true });
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve({ port, open: false });
    });
    socket.once('error', () => resolve({ port, open: false }));
    socket.connect(port, '127.0.0.1');
  });
}

async function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          statusCode: res.statusCode,
          body: tail(body, 1200),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({ ok: false, statusCode: 0, body: '', error: error.message });
    });
  });
}

function recentLogs() {
  const rootLogs = ['angular-dev.err.log', 'angular-dev.log', 'api-dev.err.log', 'api-dev.log']
    .map((name) => ({ name, filePath: path.join(projectRoot, name) }))
    .filter((entry) => fs.existsSync(entry.filePath))
    .map((entry) => ({
      name: entry.name,
      size: fs.statSync(entry.filePath).size,
      modifiedAt: fs.statSync(entry.filePath).mtime.toISOString(),
      tail: tail(fs.readFileSync(entry.filePath, 'utf8'), 4000),
    }));

  const recoveryLogs = fs.existsSync(logsDir)
    ? fs.readdirSync(logsDir)
      .filter((name) => name.endsWith('.log'))
      .sort()
      .slice(-3)
      .map((name) => ({
        name: path.join('recovery', 'logs', name),
        size: fs.statSync(path.join(logsDir, name)).size,
        modifiedAt: fs.statSync(path.join(logsDir, name)).mtime.toISOString(),
        tail: tail(fs.readFileSync(path.join(logsDir, name), 'utf8'), 4000),
      }))
    : [];

  return [...rootLogs, ...recoveryLogs];
}

function listBackupFiles() {
  let backupDir = path.join(projectRoot, 'database-backups');
  const backupConfigFile = path.join(projectRoot, 'server', 'modules', 'database-backup', 'storage', 'backup-config.json');
  const config = readJson(backupConfigFile, null);
  if (config && config.backupDir) {
    backupDir = path.resolve(config.backupDir);
  }

  const files = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir)
      .filter((fileName) => fileName.toLowerCase().endsWith('.bak'))
      .map((fileName) => {
        const filePath = path.join(backupDir, fileName);
        const stats = fs.statSync(filePath);
        return {
          fileName,
          filePath,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    : [];

  return { backupDir, latest: files[0] || null, files };
}

function findOwnSystemProcesses() {
  if (process.platform !== 'win32') {
    return [];
  }

  const escapedRoot = projectRoot.replace(/'/g, "''");
  const ps = [
    '$ErrorActionPreference = "SilentlyContinue"',
    `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escapedRoot}*' -and ($_.Name -match 'node|electron') } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress`,
  ].join('; ');
  const result = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { timeoutMs: 10000 });

  if (!result.ok || !result.stdout) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .filter((row) => Number(row.ProcessId) !== process.pid)
      .map((row) => ({
        pid: Number(row.ProcessId),
        name: row.Name,
        commandLine: row.CommandLine,
      }));
  } catch {
    return [];
  }
}

function stopOwnSystemProcesses() {
  const processes = findOwnSystemProcesses();
  const targets = processes.filter((processInfo) =>
    String(processInfo.commandLine || '').includes(projectRoot) &&
    Number(processInfo.pid) !== process.pid
  );

  for (const target of targets) {
    runForLog('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Stop-Process -Id ${target.pid} -Force`,
    ], { timeoutMs: 10000 });
  }

  logAction('stop-own-system-processes', { count: targets.length, targets: targets.map((target) => ({ pid: target.pid, name: target.name })) });
  return targets;
}

async function verifyDatabase() {
  const result = run('node', ['server/test-db-connection.js'], { timeoutMs: 45000 });
  const backups = listBackupFiles();
  return {
    ok: result.ok,
    output: result.ok ? result.stdout : `${result.stdout}${os.EOL}${result.stderr}`.trim(),
    latestBackup: backups.latest,
    backupDir: backups.backupDir,
  };
}

async function diagnose({ build = true, includeServerStart = false } = {}) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail: String(detail || '') });

  add('package.json', fileExists('package.json'), 'Archivo de configuracion npm');
  add('package-lock.json', fileExists('package-lock.json'), 'Lockfile npm');
  add('server/server.js', fileExists('server/server.js'), 'Backend Express');
  add('server/db.js', fileExists('server/db.js'), 'Configuracion SQL Server');
  add('src/app/app.ts', fileExists('src/app/app.ts'), 'Frontend Angular');
  add('.env', fileExists('.env'), fileExists('.env') ? 'Existe, no se imprimen secretos' : 'Falta .env');

  const nodeVersion = run('node', ['--version'], { timeoutMs: 10000 });
  add('Node.js', nodeVersion.ok, nodeVersion.stdout || nodeVersion.stderr || nodeVersion.error);

  const npmVersion = run(npmCommand, ['--version'], { timeoutMs: 10000 });
  add('npm', npmVersion.ok, npmVersion.stdout || npmVersion.stderr || npmVersion.error);

  add('node_modules', fs.existsSync(path.join(projectRoot, 'node_modules')), 'Dependencias instaladas');
  add('script build', hasPackageScript('build'), 'npm run build');
  add('script desktop:dev', hasPackageScript('desktop:dev'), 'npm run desktop:dev');

  const frontendPortState = await checkPort(frontendPort);
  const backendPortState = await checkPort(backendPort);
  add(`puerto frontend ${frontendPort}`, true, frontendPortState.open ? 'En uso' : 'Libre');
  add(`puerto backend ${backendPort}`, true, backendPortState.open ? 'En uso' : 'Libre');

  const db = await verifyDatabase();
  add('SQL Server', db.ok, db.ok ? 'Conexion OK' : tail(db.output, 1000));
  add('ultimo .bak', Boolean(db.latestBackup), db.latestBackup ? `${db.latestBackup.fileName} (${db.latestBackup.modifiedAt})` : `No hay .bak en ${db.backupDir}`);

  if (build) {
    const buildResult = run(npmCommand, ['run', 'build'], { timeoutMs: 180000 });
    add('frontend compila', buildResult.ok, buildResult.ok ? 'ng build OK' : tail(`${buildResult.stdout}${os.EOL}${buildResult.stderr}`, 3000));
  }

  const backendProbe = await probeBackend();
  add('backend inicia/responde', backendProbe.ok, backendProbe.detail);

  if (includeServerStart) {
    const frontendProbe = await probeFrontend();
    add('frontend inicia/responde', frontendProbe.ok, frontendProbe.detail);
  }

  const logs = recentLogs();
  const recentThreshold = Date.now() - 30 * 60 * 1000;
  const criticalLogHits = logs.filter((entry) =>
    !String(entry.name || '').startsWith(`recovery${path.sep}`) &&
    new Date(entry.modifiedAt || 0).getTime() >= recentThreshold
  ).flatMap((entry) => {
    const matches = entry.tail
      .split(/\r?\n/)
      .filter((line) => /error|exception|failed|eaddrinuse|cannot find|ng[0-9]+/i.test(line))
      .slice(-5);
    return matches.map((line) => `${entry.name}: ${line}`);
  });
  add('logs recientes', criticalLogHits.length === 0, criticalLogHits.length ? criticalLogHits.join(os.EOL) : 'Sin errores criticos recientes detectados');

  const ok = checks.every((check) => check.ok);
  logAction('diagnose', { ok, checks });
  return { ok, checks, db };
}

async function probeBackend() {
  const active = await httpGet(backendHealthUrl, 2500);
  if (active.ok) {
    return { ok: true, detail: `${backendHealthUrl} respondio ${active.statusCode}` };
  }

  const child = childProcess.spawn('node', ['server/server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(backendPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  await sleep(4500);
  const response = await httpGet(backendHealthUrl, 3500);
  if (!child.killed) {
    child.kill('SIGTERM');
  }
  await sleep(500);

  return {
    ok: response.ok,
    detail: response.ok
      ? `${backendHealthUrl} respondio ${response.statusCode}`
      : tail(output || active.error || 'No respondio /api/health', 2000),
  };
}

async function probeFrontend() {
  const active = await httpGet(frontendUrl, 2500);
  if (active.ok) {
    return { ok: true, detail: `${frontendUrl} respondio ${active.statusCode}` };
  }

  if (!fs.existsSync(angularCliScript)) {
    return { ok: false, detail: 'No existe node_modules/@angular/cli/bin/ng.js. Ejecuta reparacion segura para restaurar dependencias.' };
  }

  const child = childProcess.spawn(process.execPath, [angularCliScript, 'serve', '--host', '127.0.0.1', '--proxy-config', 'proxy.conf.json'], {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  let response = { ok: false };
  for (let index = 0; index < 24; index += 1) {
    await sleep(2500);
    response = await httpGet(frontendUrl, 2500);
    if (response.ok) {
      break;
    }
    if (child.exitCode !== null) {
      break;
    }
  }

  if (!child.killed) {
    child.kill('SIGTERM');
  }
  await sleep(500);

  return {
    ok: response.ok,
    detail: response.ok ? `${frontendUrl} respondio ${response.statusCode}` : tail(output || 'No respondio Angular dev server', 3000),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printDiagnosis(result) {
  printHeader();
  console.log(result.ok ? 'Sistema OK' : 'Se detectaron problemas');
  console.log('');
  for (const check of result.checks) {
    console.log(`${check.ok ? '[OK]' : '[PROBLEMA]'} ${check.name}`);
    if (check.detail) {
      console.log(`  ${check.detail}`);
    }
  }
}

async function healthCheck() {
  const result = await diagnose({ build: true, includeServerStart: true });
  printDiagnosis(result);
  logAction('health-check', { ok: result.ok });
  return result.ok;
}

async function safeRepair() {
  printHeader();
  console.log('Intentando reparaciones seguras...');
  const actions = [];

  if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
    const install = runForLog(npmCommand, ['install'], { timeoutMs: 300000 });
    actions.push({ action: 'npm install', ok: install.ok });
  } else {
    actions.push({ action: 'npm install omitido', ok: true });
  }

  for (const relativePath of [path.join('.angular', 'cache'), 'dist']) {
    const targetPath = path.join(projectRoot, relativePath);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      logAction('remove-generated', { path: relativePath });
      actions.push({ action: `limpiar ${relativePath}`, ok: true });
    }
  }

  stopOwnSystemProcesses();
  const build = runForLog(npmCommand, ['run', 'build'], { timeoutMs: 180000 });
  actions.push({ action: 'npm run build', ok: build.ok });

  const ok = actions.every((action) => action.ok);
  logAction('safe-repair', { ok, actions });
  console.log(ok ? 'Reparacion segura completada.' : 'Se detectaron problemas durante la reparacion segura.');
  for (const action of actions) {
    console.log(`${action.ok ? '[OK]' : '[PROBLEMA]'} ${action.action}`);
  }
  return ok;
}

function startSystem() {
  printHeader();
  console.log('Iniciando sistema con npm run desktop:dev...');
  logAction('start-system', { command: 'npm run desktop:dev' });
  const child = childProcess.spawn(npmCommand, ['run', 'desktop:dev'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: false,
  });
  child.on('exit', (code) => {
    logAction('start-system-exit', { code });
  });
}

function restartSystem() {
  printHeader();
  const stopped = stopOwnSystemProcesses();
  console.log(`Procesos propios detenidos: ${stopped.length}`);
  startSystem();
}

function createCheckpoint({ stable = false, label = '' } = {}) {
  if (!isGitRepo()) {
    throw new Error('Este proyecto no parece ser un repositorio Git.');
  }

  const name = label || `checkpoint_${compactStamp()}`;
  const statusBefore = gitStatusShort();
  let commitSha = currentCommit();
  let committed = false;

  if (statusBefore.trim()) {
    runForLog('git', [
      'add',
      '-A',
      '--',
      '.',
      ':(exclude)recovery/logs/**',
      ':(exclude)recovery/backups/**',
      ':(exclude)database-backups/**',
      ':(exclude)public/product-thumbnails/**',
      ':(exclude)node_modules/**',
      ':(exclude)dist/**',
    ]);
    const commit = runForLog('git', ['commit', '-m', `YR checkpoint ${name}`], { timeoutMs: 180000, env: gitEnv() });
    if (!commit.ok) {
      throw new Error(`No se pudo crear commit de checkpoint: ${commit.stderr || commit.stdout}`);
    }
    commitSha = currentCommit();
    committed = true;
  }

  const tagArgs = ['tag', '-a', name, '-m', `YR Recovery checkpoint ${name}`];
  const tag = runForLog('git', tagArgs, { timeoutMs: 60000 });
  if (!tag.ok && !/already exists/i.test(`${tag.stderr}${tag.stdout}`)) {
    throw new Error(`No se pudo crear tag de checkpoint: ${tag.stderr || tag.stdout}`);
  }

  const data = loadCheckpoints();
  const row = {
    name,
    commit: commitSha,
    branch: currentBranch(),
    createdAt: new Date().toISOString(),
    stable: Boolean(stable),
    stableAt: stable ? new Date().toISOString() : null,
    committedWorktree: committed,
  };
  data.checkpoints = [row, ...data.checkpoints.filter((checkpoint) => checkpoint.name !== name)];
  saveCheckpoints(data);
  logAction('create-checkpoint', row);
  return row;
}

async function markStable() {
  const data = loadCheckpoints();
  const latest = data.checkpoints[0];
  if (!latest) {
    throw new Error('No hay puntos de restauracion para marcar.');
  }

  console.log(`Se ejecutara health-check antes de marcar estable: ${latest.name}`);
  const ok = await healthCheck();
  if (!ok) {
    throw new Error('Health-check fallo. No se marca como version estable.');
  }

  latest.stable = true;
  latest.stableAt = new Date().toISOString();
  data.checkpoints = [latest, ...data.checkpoints.slice(1)];
  saveCheckpoints(data);
  const stableTag = `stable_${latest.name}`;
  const tag = runForLog('git', ['tag', '-a', stableTag, latest.commit, '-m', `YR stable checkpoint ${latest.name}`]);
  if (!tag.ok && !/already exists/i.test(`${tag.stderr}${tag.stdout}`)) {
    throw new Error(`No se pudo crear tag estable: ${tag.stderr || tag.stdout}`);
  }
  logAction('mark-stable', latest);
  return latest;
}

function listCheckpoints() {
  const data = loadCheckpoints();
  printHeader();
  if (!data.checkpoints.length) {
    console.log('No hay puntos de restauracion registrados.');
    return data.checkpoints;
  }

  for (const checkpoint of data.checkpoints) {
    console.log(`${checkpoint.stable ? '[ESTABLE]' : '[checkpoint]'} ${checkpoint.name}`);
    console.log(`  commit: ${checkpoint.commit}`);
    console.log(`  fecha: ${checkpoint.createdAt}`);
    if (checkpoint.stableAt) {
      console.log(`  estable desde: ${checkpoint.stableAt}`);
    }
  }
  return data.checkpoints;
}

function latestStableCheckpoint() {
  const data = loadCheckpoints();
  return data.checkpoints.find((checkpoint) => checkpoint.stable && checkpoint.commit) || null;
}

async function backupCurrentCodeState(reason = 'pre-restore') {
  const name = `${reason}_${compactStamp()}`;
  const backup = createCheckpoint({ stable: false, label: name });
  logAction('backup-current-code-state', backup);
  return backup;
}

async function restoreLatestStable({ confirmed = false } = {}) {
  if (!isGitRepo()) {
    throw new Error('Este proyecto no parece ser un repositorio Git.');
  }

  const stable = latestStableCheckpoint();
  if (!stable) {
    throw new Error('No hay una version estable registrada.');
  }

  printHeader();
  console.log('Restaurar ultima version estable');
  console.log(`Version: ${stable.name}`);
  console.log(`Fecha: ${stable.stableAt || stable.createdAt}`);
  console.log(`Commit: ${stable.commit}`);
  console.log('');
  console.log('Esto restaurara solo codigo/configuracion controlada por Git.');
  console.log('No se restaurara ni reemplazara la base de datos.');

  if (!confirmed) {
    const answer = await ask('Escribe RESTAURAR para continuar: ');
    if (answer.trim() !== 'RESTAURAR') {
      logAction('restore-cancelled', { target: stable.name });
      console.log('Restauracion cancelada.');
      return false;
    }
  }

  const backup = await backupCurrentCodeState('pre_restore_code_backup');
  const reset = runForLog('git', ['reset', '--hard', stable.commit], { timeoutMs: 120000 });
  if (!reset.ok) {
    throw new Error(`No se pudo restaurar version estable. Respaldo actual: ${backup.name}. Error: ${reset.stderr || reset.stdout}`);
  }

  logAction('restore-stable', { ok: true, target: stable, backup });
  console.log(`Restaurado: ${stable.name}`);
  console.log(`Respaldo previo creado: ${backup.name}`);
  return true;
}

function showLogs() {
  printHeader();
  const logs = recentLogs();
  if (!logs.length) {
    console.log('No hay logs recientes.');
    return;
  }

  for (const entry of logs) {
    console.log('');
    console.log(`--- ${entry.name} (${entry.size} bytes) ---`);
    console.log(entry.tail || '(vacio)');
  }
}

async function showDatabaseStatus() {
  printHeader();
  const db = await verifyDatabase();
  console.log(db.ok ? '[OK] SQL Server responde' : '[PROBLEMA] SQL Server no responde');
  if (db.output) {
    console.log(db.output);
  }
  console.log('');
  console.log(`Carpeta de respaldos: ${db.backupDir}`);
  if (db.latestBackup) {
    console.log(`Ultimo .bak: ${db.latestBackup.fileName}`);
    console.log(`Fecha: ${db.latestBackup.modifiedAt}`);
    console.log(`Tamano: ${db.latestBackup.size} bytes`);
  } else {
    console.log('No se encontro ningun .bak.');
  }
  logAction('database-status', { ok: db.ok, latestBackup: db.latestBackup, backupDir: db.backupDir });
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function menu() {
  ensureRecoveryDirs();

  for (;;) {
    printHeader();
    console.log('[1] Verificar sistema');
    console.log('[2] Intentar reparacion segura');
    console.log('[3] Iniciar sistema');
    console.log('[4] Reiniciar sistema');
    console.log('[5] Crear punto de restauracion');
    console.log('[6] Ver puntos de restauracion');
    console.log('[7] Restaurar ultima version estable');
    console.log('[8] Ver logs');
    console.log('[9] Verificar base de datos');
    console.log('[0] Salir');
    const option = await ask('Seleccion: ');

    try {
      if (option === '1') {
        printDiagnosis(await diagnose({ build: true, includeServerStart: false }));
      } else if (option === '2') {
        await safeRepair();
      } else if (option === '3') {
        startSystem();
        return;
      } else if (option === '4') {
        restartSystem();
        return;
      } else if (option === '5') {
        const checkpoint = createCheckpoint();
        console.log(`Punto creado: ${checkpoint.name}`);
        const stableAnswer = await ask('Marcar como version estable ahora? (s/N): ');
        if (/^s/i.test(stableAnswer.trim())) {
          const stable = await markStable();
          console.log(`Version estable: ${stable.name}`);
        }
      } else if (option === '6') {
        listCheckpoints();
      } else if (option === '7') {
        await restoreLatestStable();
      } else if (option === '8') {
        showLogs();
      } else if (option === '9') {
        await showDatabaseStatus();
      } else if (option === '0') {
        return;
      }
    } catch (error) {
      logAction('error', { message: error.message, stack: error.stack });
      console.error(`[PROBLEMA] ${error.message}`);
    }

    await ask(`${os.EOL}Presiona Enter para continuar...`);
  }
}

async function simulateBuildFailure() {
  const tempFile = path.join(recoveryRoot, 'self-test-build-failure.js');
  fs.writeFileSync(tempFile, 'function broken( {', 'utf8');
  const result = run('node', ['--check', tempFile], { timeoutMs: 10000 });
  fs.rmSync(tempFile, { force: true });
  logAction('simulate-build-failure', { ok: !result.ok, stderr: tail(result.stderr, 1000) });
  console.log(result.ok ? '[PROBLEMA] No se pudo simular fallo' : '[OK] Fallo simulado detectado');
  return !result.ok;
}

function selfTestCheckpointAndRestore() {
  const sandbox = path.join(recoveryRoot, 'self-test-repo');
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
  run('git', ['init'], { cwd: sandbox });
  fs.writeFileSync(path.join(sandbox, 'file.txt'), 'stable', 'utf8');
  run('git', ['add', '.'], { cwd: sandbox });
  run('git', ['commit', '-m', 'stable'], { cwd: sandbox, env: gitTestEnv() });
  const stableSha = run('git', ['rev-parse', 'HEAD'], { cwd: sandbox }).stdout.trim();
  fs.writeFileSync(path.join(sandbox, 'file.txt'), 'broken', 'utf8');
  run('git', ['add', '.'], { cwd: sandbox });
  run('git', ['commit', '-m', 'broken'], { cwd: sandbox, env: gitTestEnv() });
  run('git', ['reset', '--hard', stableSha], { cwd: sandbox });
  const restored = fs.readFileSync(path.join(sandbox, 'file.txt'), 'utf8') === 'stable';
  fs.rmSync(sandbox, { recursive: true, force: true });
  logAction('self-test-checkpoint-restore', { ok: restored });
  console.log(restored ? '[OK] Checkpoint/restauracion validado en sandbox' : '[PROBLEMA] Fallo self-test de restauracion');
  return restored;
}

function gitTestEnv() {
  return {
    GIT_AUTHOR_NAME: 'YR Recovery Tool',
    GIT_AUTHOR_EMAIL: 'yr-recovery@example.local',
    GIT_COMMITTER_NAME: 'YR Recovery Tool',
    GIT_COMMITTER_EMAIL: 'yr-recovery@example.local',
  };
}

async function runSelfTest() {
  printHeader();
  console.log('Ejecutando pruebas internas seguras...');
  const buildFailure = await simulateBuildFailure();
  const restore = selfTestCheckpointAndRestore();
  const health = await healthCheck();
  const ok = buildFailure && restore && health;
  logAction('self-test', { ok, buildFailure, restore, health });
  return ok;
}

async function main() {
  ensureRecoveryDirs();
  const command = process.argv[2] || 'menu';

  try {
    if (command === 'menu') {
      await menu();
    } else if (command === 'verify' || command === 'diagnose') {
      printDiagnosis(await diagnose({ build: true, includeServerStart: false }));
    } else if (command === 'health-check') {
      process.exitCode = (await healthCheck()) ? 0 : 1;
    } else if (command === 'repair') {
      process.exitCode = (await safeRepair()) ? 0 : 1;
    } else if (command === 'start') {
      startSystem();
    } else if (command === 'restart') {
      restartSystem();
    } else if (command === 'checkpoint') {
      console.log(JSON.stringify(createCheckpoint(), null, 2));
    } else if (command === 'mark-stable') {
      console.log(JSON.stringify(await markStable(), null, 2));
    } else if (command === 'list-checkpoints') {
      listCheckpoints();
    } else if (command === 'restore-stable') {
      await restoreLatestStable({ confirmed: process.argv.includes('--yes') });
    } else if (command === 'logs') {
      showLogs();
    } else if (command === 'db') {
      await showDatabaseStatus();
    } else if (command === 'simulate-build-failure') {
      process.exitCode = (await simulateBuildFailure()) ? 0 : 1;
    } else if (command === 'self-test') {
      process.exitCode = (await runSelfTest()) ? 0 : 1;
    } else {
      console.error(`Comando no reconocido: ${command}`);
      process.exitCode = 1;
    }
  } catch (error) {
    logAction('fatal-error', { command, message: error.message, stack: error.stack });
    console.error(`[PROBLEMA] ${error.message}`);
    process.exitCode = 1;
  }
}

main();
