#!/usr/bin/env node
/* global console, process */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { buildAiPrompt, loadAiContext } from "../lib/ai-context.mjs";

const jobFile = process.argv[2];
if (!jobFile) {
  console.error("Usage: node obsitero-ai-codex.mjs <job.json>");
  process.exit(1);
}

const job = JSON.parse(await fs.readFile(jobFile, "utf8"));
const aiContext = await loadAiContext(job);
const prompt = buildAiPrompt(aiContext);
const outputFile = job.codex_output_file;

await fs.mkdir(path.dirname(outputFile), { recursive: true });

await new Promise((resolve, reject) => {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "-C",
    path.dirname(jobFile),
    "--add-dir",
    path.dirname(job.codex_pdf_path || job.pdf_path || jobFile),
    "-o",
    outputFile,
    "-",
  ];

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

const content = await fs.readFile(outputFile, "utf8");
const finalizedContent = content.replace(/\r\n/g, "\n").trim();
await fs.writeFile(outputFile, finalizedContent, "utf8");
process.stdout.write(finalizedContent);
