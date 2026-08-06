#!/usr/bin/env node
/**
 * Validate fixtures/scans/demo.bundle.json exists and looks like a scan bundle
 * (resources + edges at top level or under graph).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const DEMO_BUNDLE = join(root, "fixtures", "scans", "demo.bundle.json");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function main() {
  if (!existsSync(DEMO_BUNDLE)) {
    fail(`demo bundle not found: ${DEMO_BUNDLE}\nRun: npm run demo:scan`);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(DEMO_BUNDLE, "utf8"));
  } catch (err) {
    fail(`demo bundle is not valid JSON: ${err.message}`);
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    fail("demo bundle must be a JSON object");
  }

  const graph =
    data.graph != null && typeof data.graph === "object" && !Array.isArray(data.graph)
      ? data.graph
      : data;

  const resources = graph.resources;
  const edges = graph.edges;

  if (!Array.isArray(resources)) {
    fail("demo bundle missing resources array (expected at top level or under graph)");
  }
  if (!Array.isArray(edges)) {
    fail("demo bundle missing edges array (expected at top level or under graph)");
  }
  if (resources.length === 0) {
    fail("demo bundle resources array is empty");
  }

  console.log(
    `PASS: demo.bundle.json OK (${resources.length} resources, ${edges.length} edges)`,
  );
}

main();
