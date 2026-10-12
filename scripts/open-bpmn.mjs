// Opens a .bpmn file in the modeler.
//
//   npm run open -- <file.bpmn> [--no-open]
//
// Copies the file to public/diagrams/<name>.bpmn, starts the dev server in the
// background if it isn't running, and opens http://localhost:5173/?diagram=<name>.
// If that page is already open it reloads the diagram by itself, so pass
// --no-open to skip opening another browser tab.

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAMS_DIR = path.join(ROOT, 'public', 'diagrams');
const BASE_URL = 'http://localhost:5173';

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const src = args.find((a) => !a.startsWith('--'));

if (!src || !existsSync(src)) {
  console.error('Usage: npm run open -- <file.bpmn> [--no-open]');
  process.exit(1);
}

const name = path.basename(src).replace(/\.(bpmn|xml)$/i, '').replace(/[^\w.-]/g, '_');
mkdirSync(DIAGRAMS_DIR, { recursive: true });
copyFileSync(src, path.join(DIAGRAMS_DIR, `${name}.bpmn`));

/** True if our modeler (not some other app) is answering on the port. */
async function isServerUp() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(1000) });
    return res.ok && (await res.text()).includes('BPMN Modeler');
  } catch {
    return false;
  }
}

if (!(await isServerUp())) {
  console.log('Starting dev server…');
  spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--strictPort'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, BPMN_NO_AUTO_OPEN: '1' }
  }).unref();

  const deadline = Date.now() + 20_000;
  while (!(await isServerUp())) {
    if (Date.now() > deadline) {
      console.error(`Dev server did not start on ${BASE_URL}. Try "npm run dev" to see the error.`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const url = `${BASE_URL}/?diagram=${encodeURIComponent(name)}`;
console.log(url);

if (!noOpen) {
  const [cmd, cmdArgs] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
}
