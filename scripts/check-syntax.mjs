#!/usr/bin/env node
/**
 * Syntax-check application *.js / *.mjs under src/ (and any stray at the repo root).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function collectRootJs() {
  return readdirSync(root)
    .filter((name) => /\.m?js$/i.test(name))
    .map((name) => join(root, name));
}

function collectTreeJs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectTreeJs(full, acc);
    else if (/\.m?js$/i.test(name)) acc.push(full);
  }
  return acc;
}

const MODULE_JS = new Set(["mission.js", "discovery.js"]);

const targets = [...collectRootJs()];
const startLocal = join(root, "scripts", "start-local.mjs");
if (existsSync(startLocal)) targets.push(startLocal);

const srcDir = join(root, "src");
if (existsSync(srcDir) && statSync(srcDir).isDirectory()) {
  targets.push(...collectTreeJs(srcDir));
}

if (!targets.length) {
  console.error("check-syntax: no .js/.mjs files found");
  process.exit(1);
}

targets.sort();

for (const file of targets) {
  const base = file.split(/[/\\]/).pop();
  try {
    if (MODULE_JS.has(base)) {
      execFileSync(process.execPath, ["--input-type=module", "--check"], {
        input: readFileSync(file),
        stdio: ["pipe", "inherit", "inherit"],
      });
    } else {
      execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
    }
  } catch {
    console.error(`check-syntax: failed on ${relative(root, file)}`);
    process.exit(1);
  }
}

console.error(`check-syntax: ok (${targets.length} files)`);