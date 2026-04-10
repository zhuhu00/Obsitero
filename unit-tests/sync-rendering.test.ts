import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SYNC_FIELDS,
  buildBasesFile,
  renderSyncedMarkdown,
  resolveMarkdownFilename,
  resolveUniqueMarkdownFilename,
  type SyncItemData,
} from "../src/sync/markdown.ts";

describe("sync markdown rendering", function () {
  const sampleItem: SyncItemData = {
    itemKey: "ABCD1234",
    title: "EmbodiedSAM",
    authors: ["Alice Zhang", "Bob Li"],
    authorsShort: ["Alice Zhang", "Bob Li"],
    year: "2025",
    publication: "ICLR",
    tags: ["Unread"],
    collections: ["Robotics", "Reading"],
    citationKey: "zhang2025embodiedsam",
    zoteroUri: "zotero://select/library/items/ABCD1234",
    doi: "10.1000/example",
    url: "https://example.com/paper",
    link: "https://example.com/paper",
    pdf: "file:///Users/hu/Zotero/storage/ABCD1234/paper.pdf",
    dateAdded: "2026-04-08T10:00:00Z",
    dateModified: "2026-04-08T12:00:00Z",
    childNotes: [],
  };

  it("prefers citation key when resolving filenames", function () {
    assert.equal(
      resolveMarkdownFilename(sampleItem, "citationKey"),
      "zhang2025embodiedsam.md",
    );
  });

  it("falls back to item key when citation key is unavailable", function () {
    assert.equal(
      resolveMarkdownFilename(
        { ...sampleItem, citationKey: undefined },
        "citationKey",
      ),
      "ABCD1234.md",
    );
  });

  it("uses the paper title when resolving filenames with the title strategy", function () {
    assert.equal(
      resolveMarkdownFilename(
        {
          ...sampleItem,
          title: "OccAny: Generalized Unconstrained Urban 3D Occupancy",
        },
        "title",
      ),
      "OccAny_ Generalized Unconstrained Urban 3D Occupancy.md",
    );
  });

  it("appends the citation key when title-based filenames collide", function () {
    const usedNames = new Set(["Loc3R-VLM_ Language-based Localization.md"]);
    assert.equal(
      resolveUniqueMarkdownFilename(
        {
          ...sampleItem,
          title: "Loc3R-VLM: Language-based Localization",
          citationKey: "qu2026loc3rvlm",
        },
        "title",
        usedNames,
      ),
      "Loc3R-VLM_ Language-based Localization - qu2026loc3rvlm.md",
    );
  });

  it("renders selected fields into frontmatter and creates a My Notes section", function () {
    const markdown = renderSyncedMarkdown({
      item: sampleItem,
      selectedFields: DEFAULT_SYNC_FIELDS,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(
      markdown.includes(
        [
          "---",
          "cssclasses:",
          '  - "zotero-paper"',
          'display_title: "EmbodiedSAM"',
          "authors:",
          '  - "Alice Zhang"',
          '  - "Bob Li"',
          'publication: "ICLR"',
          "tags:",
          '  - "Unread"',
          'link: "https://example.com/paper"',
          'pdf: "file:///Users/hu/Zotero/storage/ABCD1234/paper.pdf"',
          'zotero_url: "zotero://select/library/items/ABCD1234"',
          "code:",
          "page:",
          "authors_short:",
          '  - "Alice Zhang"',
          '  - "Bob Li"',
          'last_synced_at: "2026-04-09T01:20:00.000Z"',
          "---",
        ].join("\n"),
      ),
    );
    assert.ok(!markdown.includes("<!-- ZOTERO-SYNC:BEGIN -->"));
    assert.match(markdown, /\n## My Notes\n\n$/);
  });

  it("quotes YAML-sensitive scalar values so Obsidian properties stay valid", function () {
    const markdown = renderSyncedMarkdown({
      item: {
        ...sampleItem,
        title: "OccAny: Generalized Unconstrained Urban 3D Occupancy",
      },
      selectedFields: [
        "title",
        "authors",
        "publication",
        "tags",
        "pdf",
        "zotero_url",
        "link",
      ],
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(
      markdown.includes(
        'title: "OccAny: Generalized Unconstrained Urban 3D Occupancy"',
      ),
    );
    assert.ok(markdown.includes('publication: "ICLR"'));
    assert.ok(markdown.includes('  - "Unread"'));
    assert.ok(markdown.includes('link: "https://example.com/paper"'));
    assert.ok(
      markdown.includes('pdf: "file:///Users/hu/Zotero/storage/ABCD1234/paper.pdf"'),
    );
  });

  it("includes a short author list for index rendering and maps tags", function () {
    const markdown = renderSyncedMarkdown({
      item: sampleItem,
      selectedFields: DEFAULT_SYNC_FIELDS,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(markdown.includes("authors_short:"));
    assert.ok(markdown.includes('  - "Alice Zhang"'));
    assert.ok(markdown.includes('  - "Bob Li"'));
    assert.ok(markdown.includes('  - "Unread"'));
  });

  it("preserves user content under My Notes when updating an existing file", function () {
    const existing = [
      "---",
      "title: Old Title",
      'code: "https://github.com/example/project"',
      'page: "https://project.example.com"',
      "---",
      "",
      "## My Notes",
      "",
      "- keep this note",
      "- and this one too",
      "",
    ].join("\n");

    const markdown = renderSyncedMarkdown({
      item: sampleItem,
      selectedFields: ["title", "citation_key", "date_modified"],
      existingContent: existing,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(markdown.includes('title: "EmbodiedSAM"'));
    assert.ok(markdown.includes('citation_key: "zhang2025embodiedsam"'));
    assert.ok(markdown.includes('date_modified: "2026-04-08T12:00:00Z"'));
    assert.ok(markdown.includes('last_synced_at: "2026-04-09T01:20:00.000Z"'));
    assert.ok(markdown.includes('  - "zotero-paper"'));
    assert.ok(markdown.includes('code: "https://github.com/example/project"'));
    assert.ok(markdown.includes('page: "https://project.example.com"'));
    assert.ok(!markdown.includes("old managed content"));
    assert.ok(
      markdown.includes("## My Notes\n\n- keep this note\n- and this one too"),
    );
  });

  it("preserves Obsidian-owned frontmatter fields on subsequent syncs", function () {
    const existing = [
      "---",
      "cssclasses:",
      '  - "zotero-paper"',
      'display_title: "Custom Local Title"',
      "authors:",
      '  - "Local Author"',
      'publication: "CVPR2026"',
      "tags:",
      '  - "Done"',
      'link: "https://local.example.com/paper"',
      'pdf: "file:///Users/hu/Zotero/storage/LOCAL1234/local.pdf"',
      'zotero_url: "zotero://select/library/items/LOCAL1234"',
      'code: "https://github.com/example/project"',
      'page: "https://project.example.com"',
      "authors_short:",
      '  - "Local Author"',
      'last_synced_at: "2026-04-09T01:20:00.000Z"',
      "---",
      "",
      "## My Notes",
      "",
      "- keep this note",
      "",
    ].join("\n");

    const markdown = renderSyncedMarkdown({
      item: sampleItem,
      selectedFields: DEFAULT_SYNC_FIELDS,
      existingContent: existing,
      syncedAt: "2026-04-09T02:00:00.000Z",
    });

    assert.ok(markdown.includes('display_title: "Custom Local Title"'));
    assert.ok(markdown.includes('  - "Local Author"'));
    assert.ok(markdown.includes('publication: "CVPR2026"'));
    assert.ok(markdown.includes('  - "Done"'));
    assert.ok(markdown.includes('link: "https://local.example.com/paper"'));
    assert.ok(
      markdown.includes('pdf: "file:///Users/hu/Zotero/storage/ABCD1234/paper.pdf"'),
    );
    assert.ok(
      markdown.includes(
        'zotero_url: "zotero://select/library/items/LOCAL1234"',
      ),
    );
    assert.ok(markdown.includes('code: "https://github.com/example/project"'));
    assert.ok(markdown.includes('page: "https://project.example.com"'));
    assert.ok(markdown.includes('last_synced_at: "2026-04-09T02:00:00.000Z"'));
    assert.ok(!markdown.includes('display_title: "EmbodiedSAM"'));
    assert.ok(!markdown.includes('publication: "ICLR"'));
    assert.ok(!markdown.includes("zotero://select/library/items/ABCD1234"));
  });

  it("renders all Zotero child notes after My Notes in a managed block", function () {
    const markdown = renderSyncedMarkdown({
      item: {
        ...sampleItem,
        childNotes: [
          { title: "AI-管家", body: "Long AI summary" },
          { title: "Comment", body: "Short human note" },
        ],
      },
      selectedFields: DEFAULT_SYNC_FIELDS,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(markdown.includes("## My Notes\n"));
    assert.ok(markdown.includes("<!-- ZOTERO-SYNC:BEGIN -->"));
    assert.ok(markdown.includes("## Zotero Notes"));
    assert.ok(markdown.includes("Long AI summary"));
    assert.ok(markdown.includes("Short human note"));
    assert.ok(
      markdown.indexOf("## My Notes") < markdown.indexOf("## Zotero Notes"),
    );
  });

  it("creates a My Notes section when updating files that do not have one yet", function () {
    const existing = [
      "---",
      "title: Legacy File",
      "---",
      "",
      "Legacy body",
      "",
    ].join("\n");

    const markdown = renderSyncedMarkdown({
      item: sampleItem,
      selectedFields: ["title"],
      existingContent: existing,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.match(markdown, /\n## My Notes\n\n$/);
  });

  it("renders a Bases file for the configured output folder", function () {
    const index = buildBasesFile({
      outputFolder: "Zotero",
    });

    assert.equal(
      index,
      [
        "filters:",
        "  and:",
        '    - \'file.inFolder("Zotero")\'',
        '    - \'file.ext == "md"\'',
        "formulas:",
        '  title_link: \'if(file.name, link(file.name, display_title), "")\'',
        '  url_link: \'if(link, link(link, "link"), "")\'',
        '  pdf_link: \'if(pdf, link(pdf, "pdf"), "")\'',
        '  zotero_link: \'if(zotero_url, link(zotero_url, "zotero"), "")\'',
        "properties:",
        "  formula.title_link:",
        '    displayName: "Title"',
        "  authors_short:",
        '    displayName: "Authors"',
        "  publication:",
        '    displayName: "Publication"',
        "  tags:",
        '    displayName: "Tags"',
        "  formula.url_link:",
        '    displayName: "Url"',
        "  formula.pdf_link:",
        '    displayName: "Pdf"',
        "  formula.zotero_link:",
        '    displayName: "Zotero"',
        "  code:",
        '    displayName: "Code"',
        "  page:",
        '    displayName: "Page"',
        "views:",
        '  - type: table',
        '    name: "Library"',
        "    order:",
        "      - formula.title_link",
        "      - note.authors_short",
        "      - note.publication",
        "      - note.tags",
        "      - formula.url_link",
        "      - formula.pdf_link",
        "      - formula.zotero_link",
        "      - note.code",
        "      - note.page",
        "    sort:",
        "      - property: note.last_synced_at",
        "        direction: DESC",
      ].join("\n"),
    );
  });

  it("places last_synced_at after authors_short in synced note frontmatter", function () {
    const markdown = renderSyncedMarkdown({
      item: sampleItem,
      selectedFields: DEFAULT_SYNC_FIELDS,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(
      markdown.indexOf("authors_short:") < markdown.indexOf("last_synced_at:"),
    );
  });

  it("renders reading and done tags as controlled tag values", function () {
    const readingMarkdown = renderSyncedMarkdown({
      item: { ...sampleItem, tags: ["Reading"] },
      selectedFields: DEFAULT_SYNC_FIELDS,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });
    const doneMarkdown = renderSyncedMarkdown({
      item: { ...sampleItem, tags: ["Done"] },
      selectedFields: DEFAULT_SYNC_FIELDS,
      syncedAt: "2026-04-09T01:20:00.000Z",
    });

    assert.ok(readingMarkdown.includes('  - "Reading"'));
    assert.ok(doneMarkdown.includes('  - "Done"'));
  });
});
