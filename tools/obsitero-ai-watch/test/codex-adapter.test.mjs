import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildCodexArgs } from "../bin/obsitero-ai-codex.mjs";

test("buildCodexArgs grants workspace-write and the controlled figure directory", () => {
  const jobFile = "/tmp/obsitero-ai-watch/demo/job.json";
  const outputFile = "/tmp/obsitero-ai-watch/demo/codex-output.md";
  const figureAssetDir =
    "/Users/hu/Desktop/obsidian/assets/obsitero/demo/images";
  const args = buildCodexArgs(
    {
      codex_pdf_path: "/tmp/obsitero-ai-watch/demo/paper.pdf",
      figure_asset_dir: figureAssetDir,
    },
    jobFile,
    outputFile,
  );

  assert.deepEqual(args.slice(0, 7), [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--ephemeral",
    "-C",
    path.dirname(jobFile),
  ]);
  assert.equal(args.includes("danger-full-access"), false);
  assert.equal(args.includes("read-only"), false);
  assert.deepEqual(args.filter((arg) => arg === "--add-dir").length, 2);
  assert.match(
    args.join("\n"),
    /\/tmp\/obsitero-ai-watch\/demo\n[\s\S]*\/Users\/hu\/Desktop\/obsidian\/assets\/obsitero\/demo\/images/,
  );
  assert.deepEqual(args.slice(-3), ["-o", outputFile, "-"]);
});

test("buildCodexArgs does not grant external PDF directories", () => {
  const args = buildCodexArgs(
    { pdf_path: "/Users/hu/Downloads/source-paper.pdf" },
    "/tmp/obsitero-ai-watch/demo/job.json",
    "/tmp/obsitero-ai-watch/demo/codex-output.md",
  );

  assert.equal(args.filter((arg) => arg === "--add-dir").length, 1);
  assert.equal(args.includes("/Users/hu/Downloads"), false);
});
