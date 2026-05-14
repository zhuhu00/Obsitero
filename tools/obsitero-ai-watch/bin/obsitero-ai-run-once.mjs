#!/usr/bin/env node
/* global console, process */

import path from "node:path";

import { loadConfig, runOnce } from "../lib/runtime.mjs";

const { configPath, notePaths } = parseArgs(process.argv.slice(2));

const config = await loadConfig(configPath);
const results = await runOnce(config, {
  notePaths,
});

for (const result of results) {
  console.log(
    `[obsitero-ai-watch] ${result.status}: ${path.basename(result.notePath)}`,
  );
}

function parseArgs(args) {
  const notePaths = [];
  let configPath;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--config") {
      configPath = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--note") {
      notePaths.push(args[index + 1]);
      index += 1;
      continue;
    }
  }

  return { configPath, notePaths };
}
