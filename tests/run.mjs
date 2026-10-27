// Starts the production server, runs the end-to-end checks, and stops the
// server again, including the child process Next.js spawns, so no stale
// server is left holding port 3000 for the next run.
import { spawn } from 'node:child_process';
import net from 'node:net';

const PORT = 3000;
const inUse = await new Promise((resolve) => {
  const s = net.createServer().once('error', () => resolve(true)).once('listening', () => s.close(() => resolve(false))).listen(PORT);
});
if (inUse) {
  console.error(`Port ${PORT} is already in use. Stop whatever is running there and try again.`);
  process.exit(1);
}

const server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { stdio: 'inherit', detached: true });
const stop = () => { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ } };
process.on('exit', stop);

for (let i = 0; i < 60; i += 1) {
  try {
    const res = await fetch(`http://localhost:${PORT}/`);
    if (res.ok) break;
  } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const test = spawn('node', ['tests/e2e.mjs'], { stdio: 'inherit' });
test.on('exit', (code) => { stop(); process.exit(code ?? 1); });
