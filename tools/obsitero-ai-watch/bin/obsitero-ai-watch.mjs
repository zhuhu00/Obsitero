#!/usr/bin/env node
/* global process */

import { loadConfig, startWatcher } from "../lib/runtime.mjs";

const configPath = parseArgs(process.argv.slice(2));
const config = await loadConfig(configPath);

await startWatcher(config);

function parseArgs(args) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--config") {
      return args[index + 1];
    }
  }
  return undefined;
}
