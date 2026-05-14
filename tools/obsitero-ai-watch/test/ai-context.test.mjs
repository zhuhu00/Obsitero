import test from "node:test";
import assert from "node:assert/strict";

import { buildAiPrompt, stripManagedAiBlock } from "../lib/ai-context.mjs";

test("buildAiPrompt lets Codex inspect the PDF", () => {
  const prompt = buildAiPrompt({
    noteContent: "---\ndisplay_title: Test Paper\n---\n\n# My Notes\n",
    templateContent: "# AI Notes\n\n## 元信息\n",
    pdfPath: "/tmp/obsitero-ai-watch/demo/paper.pdf",
  });

  assert.match(prompt, /PDF file to analyze/);
  assert.match(prompt, /\/tmp\/obsitero-ai-watch\/demo\/paper\.pdf/);
  assert.match(prompt, /Use tools only to read and inspect the PDF/i);
  assert.match(
    prompt,
    /Return ONLY markdown content starting with "# AI Notes"/,
  );
  assert.match(prompt, /Current paper note/);
  assert.match(prompt, /AI note template/);
});

test("stripManagedAiBlock removes existing managed AI notes before prompting", () => {
  const stripped = stripManagedAiBlock(`# My Notes

<!-- OBSITERO-AI-START -->
# AI Notes

Old AI block.
<!-- OBSITERO-AI-END -->

<!-- ZOTERO-SYNC:BEGIN -->
# Zotero Notes
Imported note
<!-- ZOTERO-SYNC:END -->
`);

  assert.equal(stripped.includes("Old AI block."), false);
  assert.equal(stripped.includes("# AI Notes"), false);
  assert.match(stripped, /# My Notes/);
  assert.match(stripped, /# Zotero Notes/);
});
