import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAiNotesContent,
  parsePaperNote,
  shouldProcessPaper,
  upsertAiNotes,
} from "../lib/core.mjs";

const SAMPLE_NOTE = `---
display_title: "Test Paper"
local_file: "file:///Users/hu/Zotero/storage/ABCD1234/paper.pdf"
pdf: "https://arxiv.org/abs/1234.5678"
---

# My Notes

Personal notes here.

<!-- ZOTERO-SYNC:BEGIN -->
# Zotero Notes

Imported note
<!-- ZOTERO-SYNC:END -->
`;

test("parsePaperNote extracts local file and section presence", () => {
  const parsed = parsePaperNote(SAMPLE_NOTE);

  assert.equal(
    parsed.localFilePath,
    "/Users/hu/Zotero/storage/ABCD1234/paper.pdf",
  );
  assert.equal(parsed.hasMyNotes, true);
  assert.equal(parsed.hasAiNotes, false);
  assert.equal(parsed.hasZoteroNotes, true);
});

test("upsertAiNotes inserts a managed AI block after My Notes and before Zotero Notes", () => {
  const updated = upsertAiNotes(
    SAMPLE_NOTE,
    "# AI Notes\n\nAI generated summary.\n",
  );

  assert.match(updated, /# My Notes/);
  assert.match(updated, /<!-- OBSITERO-AI-START -->/);
  assert.match(updated, /# AI Notes/);
  assert.match(updated, /AI generated summary\./);
  assert.match(updated, /# Zotero Notes/);
  assert.ok(updated.indexOf("# My Notes") < updated.indexOf("# AI Notes"));
  assert.ok(updated.indexOf("# AI Notes") < updated.indexOf("# Zotero Notes"));
});

test("upsertAiNotes replaces an existing managed AI block in place", () => {
  const existing = upsertAiNotes(SAMPLE_NOTE, "# AI Notes\n\nOld summary.\n");

  const updated = upsertAiNotes(existing, "# AI Notes\n\nNew summary.\n");

  assert.equal(updated.includes("Old summary."), false);
  assert.equal(updated.includes("New summary."), true);
  assert.equal(updated.match(/<!-- OBSITERO-AI-START -->/g)?.length, 1);
});

test("shouldProcessPaper requires a local file and missing or stale AI notes", () => {
  const parsed = parsePaperNote(SAMPLE_NOTE);

  assert.equal(
    shouldProcessPaper({
      parsedNote: parsed,
      markdownMtimeMs: 100,
      pdfMtimeMs: 200,
      stateEntry: undefined,
    }),
    true,
  );

  const withAi = parsePaperNote(
    upsertAiNotes(SAMPLE_NOTE, "# AI Notes\n\nFresh summary.\n"),
  );

  assert.equal(
    shouldProcessPaper({
      parsedNote: withAi,
      markdownMtimeMs: 100,
      pdfMtimeMs: 200,
      stateEntry: {
        markdownMtimeMs: 100,
        pdfMtimeMs: 200,
      },
    }),
    false,
  );

  assert.equal(
    shouldProcessPaper({
      parsedNote: withAi,
      markdownMtimeMs: 100,
      pdfMtimeMs: 300,
      stateEntry: {
        markdownMtimeMs: 100,
        pdfMtimeMs: 200,
      },
    }),
    false,
  );
});

test("shouldProcessPaper in watch mode only processes first-seen notes without AI notes", () => {
  const parsed = parsePaperNote(SAMPLE_NOTE);
  const withAi = parsePaperNote(
    upsertAiNotes(SAMPLE_NOTE, "# AI Notes\n\nFresh summary.\n"),
  );

  assert.equal(
    shouldProcessPaper({
      parsedNote: parsed,
      stateEntry: undefined,
      mode: "watch",
    }),
    true,
  );

  assert.equal(
    shouldProcessPaper({
      parsedNote: parsed,
      stateEntry: {
        firstSeenAt: "2026-04-12T00:00:00.000Z",
      },
      mode: "watch",
    }),
    false,
  );

  assert.equal(
    shouldProcessPaper({
      parsedNote: withAi,
      stateEntry: undefined,
      mode: "watch",
    }),
    false,
  );
});

test("normalizeAiNotesContent extracts the AI Notes block from noisy command output", () => {
  const normalized = normalizeAiNotesContent(`Here is the result:

\`\`\`md
<!-- OBSITERO-AI-START -->
# AI Notes

Useful analysis.
<!-- OBSITERO-AI-END -->
\`\`\`
`);

  assert.equal(normalized, "# AI Notes\n\nUseful analysis.");
});

test("normalizeAiNotesContent keeps only the first AI Notes block when duplicated", () => {
  const normalized = normalizeAiNotesContent(`# AI Notes

First block.

# AI Notes

Second block.
`);

  assert.equal(normalized, "# AI Notes\n\nFirst block.");
});
