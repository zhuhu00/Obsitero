import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadConfig, primeSeenNotes } from "../lib/runtime.mjs";

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
