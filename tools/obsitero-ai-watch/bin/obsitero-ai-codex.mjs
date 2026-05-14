#!/usr/bin/env node
/* global console, process */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { buildAiPrompt, loadAiContext } from "../lib/ai-context.mjs";

export function buildCodexArgs(job, jobFile, outputFile) {
  const jobWorkspaceDir = path.dirname(jobFile);
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "-C",
    jobWorkspaceDir,
    "--add-dir",
    jobWorkspaceDir,
  ];

  args.push("-o", outputFile, "-");
  return args;
}

export async function runCodexAdapter(jobFile) {
  const job = JSON.parse(await fs.readFile(jobFile, "utf8"));
  const aiContext = await loadAiContext(job);
  const prompt = buildAiPrompt(aiContext);
  const outputFile = job.codex_output_file;

  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  await runCodexExec(buildCodexArgs(job, jobFile, outputFile), prompt, jobFile);

  const content = await fs.readFile(outputFile, "utf8");
  const finalizedContent = content.replace(/\r\n/g, "\n").trim();
  await fs.writeFile(outputFile, finalizedContent, "utf8");
  return finalizedContent;
}

async function runCodexExec(args, prompt, jobFile) {
  await new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: path.dirname(jobFile),
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Drain stdout so Codex CLI banners / prompt echoes never leak into the
    // parent process output and pollute the managed markdown block.
    child.stdout.on("data", () => {});

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`codex exec failed with exit code ${code ?? 1}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function main(argv = process.argv) {
  const jobFile = argv[2];
  if (!jobFile) {
    console.error("Usage: node obsitero-ai-codex.mjs <job.json>");
    process.exit(1);
  }

  process.stdout.write(await runCodexAdapter(jobFile));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
