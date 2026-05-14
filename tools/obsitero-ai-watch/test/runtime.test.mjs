import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  createJob,
  loadConfig,
  primeSeenNotes,
  processNote,
} from "../lib/runtime.mjs";

test("loadConfig accepts the direct Codex PDF config", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obsitero-runtime-"));
  const configPath = path.join(tempDir, "config.json");
  await fs.writeFile(
    configPath,
    JSON.stringify({
      vaultDir: tempDir,
      watchDir: tempDir,
      stateFile: "state.json",
      workRoot: path.join(tempDir, "work"),
      aiCommand: ["node", "adapter.mjs"],
    }),
  );

  const config = await loadConfig(configPath);

  assert.deepEqual(config.aiCommand, ["node", "adapter.mjs"]);
  assert.equal(config.stateFile, path.join(tempDir, "state.json"));
});

test("primeSeenNotes marks existing notes as seen without overwriting prior state", () => {
  const state = {
    notes: {
      "/vault/Zotero/existing.md": {
        firstSeenAt: "2026-04-10T00:00:00.000Z",
        lastProcessedAt: "2026-04-11T00:00:00.000Z",
      },
    },
  };

  const result = primeSeenNotes(
    ["/vault/Zotero/existing.md", "/vault/Zotero/new.md"],
    state,
    "2026-04-12T00:00:00.000Z",
  );

  assert.equal(result.primed, 1);
  assert.equal(
    state.notes["/vault/Zotero/existing.md"].firstSeenAt,
    "2026-04-10T00:00:00.000Z",
  );
  assert.equal(
    state.notes["/vault/Zotero/new.md"].firstSeenAt,
    "2026-04-12T00:00:00.000Z",
  );
});

test("createJob derives figure asset paths and markdown embeds", async () => {
  const vaultDir = "/Users/hu/Desktop/obsidian";
  const notePath = path.join(vaultDir, "Zotero", "A Great Paper.md");
  const job = await createJob(
    notePath,
    { localFilePath: "/tmp/source.pdf" },
    {
      repoRoot: "/repo",
      configDir: "/repo/tools/obsitero-ai-watch",
      watchDir: path.join(vaultDir, "Zotero"),
      vaultDir,
      workRoot: "/tmp/obsitero-ai-watch",
      codexModel: "",
    },
  );

  assert.equal(
    job.descriptor.figure_asset_dir,
    "/Users/hu/Desktop/obsidian/assets/obsitero/a-great-paper/images",
  );
  assert.equal(
    job.descriptor.figure_asset_markdown_dir,
    "../assets/obsitero/a-great-paper/images",
  );
  assert.equal(
    job.descriptor.teaser_image_path,
    "/Users/hu/Desktop/obsidian/assets/obsitero/a-great-paper/images/teaser.jpg",
  );
  assert.equal(
    job.descriptor.pipeline_image_path,
    "/Users/hu/Desktop/obsidian/assets/obsitero/a-great-paper/images/pipeline.jpg",
  );
  assert.equal(
    job.descriptor.teaser_markdown_embed,
    "![](../assets/obsitero/a-great-paper/images/teaser.jpg)",
  );
  assert.equal(
    job.descriptor.pipeline_markdown_embed,
    "![](../assets/obsitero/a-great-paper/images/pipeline.jpg)",
  );
  assert.equal(
    job.variables.teaser_markdown_embed,
    job.descriptor.teaser_markdown_embed,
  );
});

test("processNote creates the figure asset directory before running AI", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obsitero-runtime-"));
  const vaultDir = path.join(tempDir, "vault");
  const watchDir = path.join(vaultDir, "Zotero");
  const workRoot = path.join(tempDir, "work");
  const pdfPath = path.join(tempDir, "paper.pdf");
  const notePath = path.join(watchDir, "Dir Check Paper.md");
  const aiScriptPath = path.join(tempDir, "fake-ai.mjs");
  const expectedAssetDir = path.join(
    vaultDir,
    "assets",
    "obsitero",
    "dir-check-paper",
    "images",
  );

  await fs.mkdir(watchDir, { recursive: true });
  await fs.writeFile(pdfPath, "fake pdf");
  await fs.writeFile(
    notePath,
    `---\nlocal_file: ${JSON.stringify(pdfPath)}\n---\n\n# My Notes\n`,
  );
  await fs.writeFile(
    aiScriptPath,
    `
import fs from "node:fs";

if (!fs.existsSync(process.argv[2])) {
  console.error("missing figure asset dir");
  process.exit(2);
}

console.log("# AI Notes\\n\\n## 关键图表\\n");
`.trim(),
  );

  const result = await processNote(
    notePath,
    {
      repoRoot: process.cwd(),
      configDir: tempDir,
      watchDir,
      vaultDir,
      stateFile: path.join(tempDir, "state.json"),
      workRoot,
      aiCommand: [process.execPath, aiScriptPath, "{{figure_asset_dir}}"],
      codexModel: "",
    },
    { notes: {} },
    { mode: "run-once" },
  );

  assert.equal(result.status, "processed");
  assert.ok(await pathExists(expectedAssetDir));
});

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
