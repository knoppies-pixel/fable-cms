#!/usr/bin/env node
/**
 * Kills any process still LISTENING on the given TCP ports. Wired as a
 * pre-step for dev/build/start so a zombie server can never hold the port
 * (EADDRINUSE) or hold .next open while `next build` rewrites it — on Windows
 * that combination produces builds whose static assets 404.
 *
 * Usage: node scripts/free-port.mjs 3001 3100
 * No-ops on CI/Vercel and when nothing holds the ports. Never fails the chain.
 */
import { execSync } from "node:child_process";

const ports = process.argv.slice(2).filter((p) => /^\d+$/.test(p));
if (ports.length === 0 || process.env.CI || process.env.VERCEL) process.exit(0);

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

for (const port of ports) {
  try {
    if (process.platform === "win32") {
      const pids = new Set();
      for (const line of sh("netstat -ano -p tcp").split(/\r?\n/)) {
        const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/);
        if (m && m[1] === port && !["0", "4", String(process.pid)].includes(m[2])) {
          pids.add(m[2]);
        }
      }
      // IPv6 rows repeat the same PID; the Set kills each once.
      for (const pid of pids) {
        sh(`taskkill /F /PID ${pid}`);
        console.log(`free-port: killed PID ${pid} holding :${port}`);
      }
    } else {
      const out = sh(`lsof -ti tcp:${port} -s tcp:LISTEN`).trim();
      for (const pid of out.split(/\s+/).filter(Boolean)) {
        sh(`kill -9 ${pid}`);
        console.log(`free-port: killed PID ${pid} holding :${port}`);
      }
    }
  } catch {
    // Nothing listening on this port (or lsof absent) — exactly what we want.
  }
}
