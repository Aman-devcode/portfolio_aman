import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const rootDir = process.cwd();
const serverDir = path.join(rootDir, 'server');
const children = [];
let shuttingDown = false;

function runNpm(args, cwd, label) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });
  if (result.error) {
    console.error(`[dev:all] ${label}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`[dev:all] ${label} exited with code ${result.status ?? 'unknown'}.`);
    return false;
  }
  return true;
}

function start(args, cwd, label) {
  const child = spawn(process.execPath, [npmCli, ...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[dev:all] ${label} failed to start: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev:all] ${label} stopped (code=${code}, signal=${signal ?? 'none'})`);
      shutdown(code || 1);
    }
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}

function main() {
  if (!fs.existsSync(path.join(serverDir, 'package.json'))) {
    console.error('[dev:all] server/package.json not found. Open the project root and try again.');
    process.exit(1);
  }

  const serverModules = path.join(serverDir, 'node_modules');
  if (!fs.existsSync(serverModules)) {
    console.log('[dev:all] Installing backend dependencies in server/ ...');
    console.log('[dev:all] Running: npm install --no-audit --no-fund (cwd=server)');
    if (!runNpm(['install', '--no-audit', '--no-fund'], serverDir, 'Backend dependency installation')) {
      console.error('[dev:all] Backend setup failed. You can run the same command manually:');
      console.error('         cd server');
      console.error('         npm install --no-audit --no-fund');
      process.exit(1);
    }
  }

  console.log('[dev:all] Starting frontend (Vite) and backend (Express/WebSocket)...');
  start(['run', 'dev'], rootDir, 'frontend');
  start(['run', 'dev'], serverDir, 'backend');
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
try {
  main();
} catch (error) {
  console.error(`[dev:all] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
}
