/* global process */

import { spawn } from "node:child_process";

const PROXY_ENV_KEYS = [
  "ALL_PROXY",
  "all_proxy",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
];

export function expandTemplateValue(value, variables) {
  return value.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key) => {
    const replacement = variables[key];
    return replacement == null ? "" : String(replacement);
  });
}

export function expandCommand(commandConfig, variables) {
  if (Array.isArray(commandConfig)) {
    const [command, ...args] = commandConfig.map((value) =>
      expandTemplateValue(String(value), variables),
    );
    if (!command) {
      throw new Error("Command array must include an executable.");
    }
    return { command, args, shell: false };
  }

  if (typeof commandConfig === "string" && commandConfig.trim()) {
    return {
      command: expandTemplateValue(commandConfig, variables),
      args: [],
      shell: true,
    };
  }

  throw new Error("Command must be a non-empty string or array.");
}

export async function runCommand(commandConfig, variables, options = {}) {
  const { command, args, shell } = expandCommand(commandConfig, variables);
  const env = { ...process.env, ...(options.env ?? {}) };
  if (options.unsetProxyEnv) {
    for (const key of PROXY_ENV_KEYS) {
      delete env[key];
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      shell,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        command,
        args,
        shell,
        code: code ?? 1,
        stdout,
        stderr,
      });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}
