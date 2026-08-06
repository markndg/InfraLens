#!/usr/bin/env node
/**
 * Public preview demo: ensure demo scan fixture exists, then start the Vite web app.
 * No API server required — the web app loads the bundle client-side.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const DEMO_BUNDLE = join(root, "fixtures", "scans", "demo.bundle.json");
const DEMO_URL = "http://localhost:5173";

function requireNode20() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isFinite(major) || major < 20) {
    console.error(
      `InfraLens demo requires Node.js >= 20 (found ${process.versions.node}).`,
    );
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited via signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} failed (exit ${code})`));
        return;
      }
      resolve();
    });
  });
}

async function ensureDemoBundle() {
  if (existsSync(DEMO_BUNDLE)) {
    console.log(`Using existing demo bundle: ${DEMO_BUNDLE}`);
    return;
  }
  console.log("Demo bundle missing — running npm run demo:scan …");
  await run("npm", ["run", "demo:scan"]);
  if (!existsSync(DEMO_BUNDLE)) {
    throw new Error(
      `demo:scan completed but ${DEMO_BUNDLE} was not created.`,
    );
  }
}

function startDevServer() {
  console.log("");
  console.log("Starting InfraLens web preview (no API required) …");
  console.log(`Open: ${DEMO_URL}`);
  console.log("Press Ctrl+C to stop.");
  console.log("");

  const child = spawn(
    "npm",
    ["run", "dev", "-w", "@infralens/web"],
    {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    },
  );

  const shutdown = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  child.on("error", (err) => {
    console.error("Failed to start web dev server:", err.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(0);
    }
    process.exit(code ?? 1);
  });
}

async function main() {
  requireNode20();
  await ensureDemoBundle();
  startDevServer();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
