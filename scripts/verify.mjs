#!/usr/bin/env node
/**
 * Fail-fast verification pipeline for public preview / CI.
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const stages = [];
let failed = false;

function requireNode20() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isFinite(major) || major < 20) {
    console.error(
      `InfraLens verify requires Node.js >= 20 (found ${process.versions.node}).`,
    );
    process.exit(1);
  }
}

function runNpm(args) {
  return new Promise((resolve) => {
    const child = spawn("npm", args, {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    child.on("error", (err) => {
      resolve({ ok: false, detail: err.message });
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve({ ok: false, detail: `signal ${signal}` });
        return;
      }
      resolve({ ok: code === 0, detail: code === 0 ? undefined : `exit ${code}` });
    });
  });
}

async function stage(name, fn) {
  console.log("");
  console.log(`── Stage: ${name} ──`);
  try {
    const result = await fn();
    if (result && result.skip) {
      stages.push({ name, status: "SKIP", detail: result.detail });
      console.log(`SKIP: ${name}${result.detail ? ` (${result.detail})` : ""}`);
      return;
    }
    if (result && result.ok === false) {
      stages.push({ name, status: "FAIL", detail: result.detail });
      failed = true;
      console.error(`FAIL: ${name}${result.detail ? ` — ${result.detail}` : ""}`);
      return;
    }
    stages.push({ name, status: "PASS" });
    console.log(`PASS: ${name}`);
  } catch (err) {
    stages.push({ name, status: "FAIL", detail: err.message });
    failed = true;
    console.error(`FAIL: ${name} — ${err.message}`);
  }
}

function playwrightBrowsersAvailable() {
  const probe = spawnSync(
    "npx",
    ["playwright", "install", "--dry-run"],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      shell: process.platform === "win32",
    },
  );
  // If playwright CLI is missing entirely, treat as skip.
  if (probe.error) {
    return { ok: false, reason: probe.error.message };
  }
  // Prefer a lighter check: try listing browsers via playwright's node API if present.
  try {
    const check = spawnSync(
      process.execPath,
      [
        "-e",
        `import('playwright').then(async (pw) => {
          const browsers = ['chromium'];
          for (const name of browsers) {
            const b = pw[name];
            if (!b) continue;
            try { b.executablePath(); } catch (e) { process.exit(2); }
          }
          process.exit(0);
        }).catch(() => process.exit(3));`,
      ],
      { cwd: root, encoding: "utf8", env: process.env },
    );
    if (check.status === 0) return { ok: true };
    if (check.status === 2) return { ok: false, reason: "Playwright browsers not installed" };
    if (check.status === 3) return { ok: false, reason: "playwright package unavailable" };
    return { ok: false, reason: `playwright probe exit ${check.status}` };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function printSummary() {
  console.log("");
  console.log("════════ Verify summary ════════");
  for (const s of stages) {
    const pad = s.name.padEnd(28);
    const line =
      s.status === "PASS"
        ? `PASS  ${pad}`
        : s.status === "SKIP"
          ? `SKIP  ${pad}${s.detail ? ` — ${s.detail}` : ""}`
          : `FAIL  ${pad}${s.detail ? ` — ${s.detail}` : ""}`;
    console.log(line);
  }
  console.log("════════════════════════════════");
  if (failed) {
    console.log("RESULT: FAIL");
  } else {
    console.log("RESULT: PASS");
  }
}

async function main() {
  requireNode20();

  await stage("lint:types", async () => runNpm(["run", "lint:types"]));
  if (failed) {
    printSummary();
    process.exit(1);
  }

  await stage("test", async () => runNpm(["test"]));
  if (failed) {
    printSummary();
    process.exit(1);
  }

  await stage("build:web", async () =>
    runNpm(["run", "build", "-w", "@infralens/web"]),
  );
  if (failed) {
    printSummary();
    process.exit(1);
  }

  await stage("build:scanner-cli", async () =>
    runNpm(["run", "build", "-w", "@infralens/scanner-cli"]),
  );
  if (failed) {
    printSummary();
    process.exit(1);
  }

  await stage("demo:scan", async () => runNpm(["run", "demo:scan"]));
  if (failed) {
    printSummary();
    process.exit(1);
  }

  await stage("demo:verify", async () =>
    runNpm(["run", "demo:verify"]),
  );
  if (failed) {
    printSummary();
    process.exit(1);
  }

  // Optional e2e
  if (process.env.PLAYWRIGHT_SKIP === "1") {
    await stage("test:e2e", async () => ({
      skip: true,
      detail: "PLAYWRIGHT_SKIP=1",
    }));
  } else {
    const browsers = playwrightBrowsersAvailable();
    if (!browsers.ok) {
      await stage("test:e2e", async () => ({
        skip: true,
        detail: browsers.reason || "browsers missing (optional)",
      }));
    } else {
      await stage("test:e2e", async () => runNpm(["run", "test:e2e"]));
      if (failed) {
        printSummary();
        process.exit(1);
      }
    }
  }

  printSummary();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
