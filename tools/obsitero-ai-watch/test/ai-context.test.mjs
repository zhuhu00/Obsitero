import test from "node:test";
import assert from "node:assert/strict";

import { buildAiPrompt, stripManagedAiBlock } from "../lib/ai-context.mjs";

test("buildAiPrompt lets Codex inspect the PDF", () => {
  const prompt = buildAiPrompt({
    noteContent: "---\ndisplay_title: Test Paper\n---\n\n# My Notes\n",
    templateContent: "# AI Notes\n\n## 元信息\n",
    pdfPath: "/tmp/obsitero-ai-watch/demo/paper.pdf",
    figureAssetDir: "/tmp/vault/assets/obsitero/test-paper/images",
    teaserImagePath: "/tmp/vault/assets/obsitero/test-paper/images/teaser.jpg",
    pipelineImagePath:
      "/tmp/vault/assets/obsitero/test-paper/images/pipeline.jpg",
    teaserMarkdownEmbed: "![](../assets/obsitero/test-paper/images/teaser.jpg)",
    pipelineMarkdownEmbed:
      "![](../assets/obsitero/test-paper/images/pipeline.jpg)",
  });

  assert.match(prompt, /PDF file to analyze/);
  assert.match(prompt, /\/tmp\/obsitero-ai-watch\/demo\/paper\.pdf/);
  assert.match(prompt, /Use tools to read and inspect the PDF/i);
  assert.match(
    prompt,
    /Return ONLY markdown content starting with "# AI Notes"/,
  );
  assert.match(prompt, /Do not create, overwrite, or modify image files/);
  assert.match(prompt, /teaser\/overview figure/);
  assert.match(prompt, /pipeline\/architecture\/method figure/);
  assert.match(prompt, /Prefer explicit Figure\/Fig\. numbers/);
  assert.match(prompt, /leave image embed lines empty as "!\[]\(\)"/);
  assert.match(
    prompt,
    /\/tmp\/vault\/assets\/obsitero\/test-paper\/images\/teaser\.jpg/,
  );
  assert.match(
    prompt,
    /\/tmp\/vault\/assets\/obsitero\/test-paper\/images\/pipeline\.jpg/,
  );
  assert.match(
    prompt,
    /!\[\]\(\.\.\/assets\/obsitero\/test-paper\/images\/teaser\.jpg\)/,
  );
  assert.match(
    prompt,
    /!\[\]\(\.\.\/assets\/obsitero\/test-paper\/images\/pipeline\.jpg\)/,
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
