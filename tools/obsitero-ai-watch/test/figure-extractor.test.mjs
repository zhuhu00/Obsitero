import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  extractPdfFigures,
  findFigureCaptions,
  parseBboxLayout,
  rewriteKeyFiguresSection,
  selectFigureCaptions,
} from "../lib/figure-extractor.mjs";

const BBOX_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<html>
<body>
<doc>
  <page width="600" height="800">
    <line>
      <word xMin="48" yMin="88" xMax="70" yMax="100">Some</word>
      <word xMin="74" yMin="88" xMax="100" yMax="100">body</word>
    </line>
    <line>
      <word xMin="48" yMin="320" xMax="75" yMax="333">Figure</word>
      <word xMin="80" yMin="320" xMax="90" yMax="333">1:</word>
      <word xMin="94" yMin="320" xMax="135" yMax="333">Overview</word>
      <word xMin="140" yMin="320" xMax="152" yMax="333">of</word>
      <word xMin="156" yMin="320" xMax="210" yMax="333">DemoNet.</word>
    </line>
    <line>
      <word xMin="48" yMin="620" xMax="75" yMax="633">Figure</word>
      <word xMin="80" yMin="620" xMax="90" yMax="633">2:</word>
      <word xMin="94" yMin="620" xMax="150" yMax="633">Quantitative</word>
      <word xMin="154" yMin="620" xMax="190" yMax="633">results</word>
      <word xMin="194" yMin="620" xMax="220" yMax="633">and</word>
      <word xMin="224" yMin="620" xMax="270" yMax="633">ablation.</word>
    </line>
  </page>
  <page width="600" height="800">
    <line>
      <word xMin="48" yMin="410" xMax="65" yMax="423">Fig.</word>
      <word xMin="70" yMin="410" xMax="80" yMax="423">3.</word>
      <word xMin="84" yMin="410" xMax="130" yMax="423">Pipeline</word>
      <word xMin="134" yMin="410" xMax="190" yMax="423">architecture</word>
      <word xMin="194" yMin="410" xMax="210" yMax="423">of</word>
      <word xMin="214" yMin="410" xMax="260" yMax="423">the</word>
    </line>
    <line>
      <word xMin="48" yMin="426" xMax="110" yMax="439">proposed</word>
      <word xMin="114" yMin="426" xMax="170" yMax="439">framework.</word>
    </line>
    <line>
      <word xMin="48" yMin="660" xMax="75" yMax="673">Figure</word>
      <word xMin="80" yMin="660" xMax="90" yMax="673">4:</word>
      <word xMin="94" yMin="660" xMax="145" yMax="673">Qualitative</word>
      <word xMin="150" yMin="660" xMax="220" yMax="673">comparison.</word>
    </line>
  </page>
</doc>
</body>
</html>`;

test("parseBboxLayout and findFigureCaptions parse wrapped figure captions", () => {
  const pages = parseBboxLayout(BBOX_FIXTURE);
  const captions = findFigureCaptions(pages);

  assert.equal(pages.length, 2);
  assert.equal(captions.length, 4);
  assert.equal(captions[0].figureNumber, "1");
  assert.equal(captions[2].figureNumber, "3");
  assert.match(captions[2].text, /proposed framework/);
  assert.deepEqual(
    captions.map((caption) => caption.pageNumber),
    [1, 1, 2, 2],
  );
});

test("selectFigureCaptions prefers Figure 1 for teaser and explicit Pipeline figure references", () => {
  const captions = findFigureCaptions(parseBboxLayout(BBOX_FIXTURE));
  const selected = selectFigureCaptions(
    captions,
    `# AI Notes

## 关键图表

### Teaser

![]()

**说明**: Fig. 1 is the overview figure.

### Pipeline

![]()

**说明**: The method pipeline is shown in Fig. 3.
`,
  );

  assert.equal(selected.teaser.figureNumber, "1");
  assert.equal(selected.pipeline.figureNumber, "3");
});

test("selectFigureCaptions falls back to pipeline keywords and avoids result figures", () => {
  const captions = findFigureCaptions(parseBboxLayout(BBOX_FIXTURE));
  const selected = selectFigureCaptions(captions, "# AI Notes\n");

  assert.equal(selected.teaser.figureNumber, "1");
  assert.equal(selected.pipeline.figureNumber, "3");
});

test("selectFigureCaptions does not reuse teaser for pipeline fallback", () => {
  const captions = findFigureCaptions(
    parseBboxLayout(`<?xml version="1.0" encoding="UTF-8"?>
<html>
<body>
<doc>
  <page width="600" height="800">
    <line>
      <word xMin="48" yMin="320" xMax="75" yMax="333">Figure</word>
      <word xMin="80" yMin="320" xMax="90" yMax="333">1:</word>
      <word xMin="94" yMin="320" xMax="145" yMax="333">Overview</word>
      <word xMin="150" yMin="320" xMax="200" yMax="333">framework</word>
      <word xMin="204" yMin="320" xMax="216" yMax="333">of</word>
      <word xMin="220" yMin="320" xMax="270" yMax="333">DemoNet.</word>
    </line>
    <line>
      <word xMin="48" yMin="620" xMax="75" yMax="633">Figure</word>
      <word xMin="80" yMin="620" xMax="90" yMax="633">2:</word>
      <word xMin="94" yMin="620" xMax="150" yMax="633">Quantitative</word>
      <word xMin="154" yMin="620" xMax="190" yMax="633">results</word>
      <word xMin="194" yMin="620" xMax="220" yMax="633">and</word>
      <word xMin="224" yMin="620" xMax="270" yMax="633">ablation.</word>
    </line>
  </page>
</doc>
</body>
</html>`),
  );

  const fallbackSelected = selectFigureCaptions(captions, "# AI Notes\n");
  const explicitSelected = selectFigureCaptions(
    captions,
    `# AI Notes

## 关键图表

### Pipeline

![]()

**说明**: The pipeline is explicitly identified as Fig. 1.
`,
  );

  assert.equal(fallbackSelected.teaser.figureNumber, "1");
  assert.equal(fallbackSelected.pipeline, undefined);
  assert.equal(explicitSelected.teaser.figureNumber, "1");
  assert.equal(explicitSelected.pipeline.figureNumber, "1");
});

test("extractPdfFigures orchestrates local PDF tools and writes selected outputs", async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "obsitero-fig-test-"),
  );
  const pdfPath = path.join(tempDir, "paper.pdf");
  const teaserImagePath = path.join(tempDir, "images", "teaser.jpg");
  const pipelineImagePath = path.join(tempDir, "images", "pipeline.jpg");
  const commands = [];
  await fs.writeFile(pdfPath, "fake pdf");

  const result = await extractPdfFigures({
    pdfPath,
    teaserImagePath,
    pipelineImagePath,
    aiNotesContent: `# AI Notes

## 关键图表

### Pipeline

**说明**: Fig. 3 shows the pipeline.
`,
    commandRunner: async (commandConfig) => {
      commands.push(commandConfig);
      if (commandConfig[0] === "pdftotext") {
        return { code: 0, stdout: BBOX_FIXTURE, stderr: "" };
      }
      if (commandConfig[0] === "pdftoppm") {
        await fs.writeFile(`${commandConfig.at(-1)}.jpg`, "rendered page");
        return { code: 0, stdout: "", stderr: "" };
      }
      if (commandConfig[0] === "magick") {
        await fs.mkdir(path.dirname(commandConfig.at(-1)), {
          recursive: true,
        });
        await fs.writeFile(commandConfig.at(-1), "cropped image");
        return { code: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected command: ${commandConfig[0]}`);
    },
  });

  assert.equal(result.teaser.created, true);
  assert.equal(result.teaser.figureNumber, "1");
  assert.equal(result.pipeline.created, true);
  assert.equal(result.pipeline.figureNumber, "3");
  assert.equal(await fs.readFile(teaserImagePath, "utf8"), "cropped image");
  assert.equal(await fs.readFile(pipelineImagePath, "utf8"), "cropped image");
  assert.equal(
    commands.filter((command) => command[0] === "pdftotext").length,
    1,
  );
  assert.equal(
    commands.filter((command) => command[0] === "pdftoppm").length,
    2,
  );
  assert.equal(commands.filter((command) => command[0] === "magick").length, 2);
});

test("rewriteKeyFiguresSection replaces embeds and preserves descriptions", () => {
  const rewritten = rewriteKeyFiguresSection(
    `# AI Notes

## 核心贡献

1. Contribution.

## 关键图表

### Teaser

![]()

**说明**: Fig. 1 shows the task overview.

### Pipeline

![]()

**说明**: Fig. 3 explains the architecture.

## 问题背景

Background.
`,
    {
      teaserMarkdownEmbed: "![](../assets/obsitero/demo/images/teaser.jpg)",
      pipelineMarkdownEmbed: "![](../assets/obsitero/demo/images/pipeline.jpg)",
      teaserExists: true,
      pipelineExists: false,
    },
  );

  assert.match(
    rewritten,
    /### Teaser\n\n!\[]\(..\/assets\/obsitero\/demo\/images\/teaser\.jpg\)\n\n\*\*说明\*\*: Fig\. 1 shows the task overview\./,
  );
  assert.match(
    rewritten,
    /### Pipeline\n\n!\[]\(\)\n\n\*\*说明\*\*: Fig\. 3 explains the architecture\./,
  );
  assert.ok(
    rewritten.indexOf("## 关键图表") < rewritten.indexOf("## 问题背景"),
  );
});

test("rewriteKeyFiguresSection inserts a missing section after core contributions", () => {
  const rewritten = rewriteKeyFiguresSection(
    `# AI Notes

## 核心贡献

1. Contribution.

## 问题背景

Background.
`,
    {
      teaserMarkdownEmbed: "![](teaser.jpg)",
      pipelineMarkdownEmbed: "![](pipeline.jpg)",
      teaserExists: true,
      pipelineExists: true,
    },
  );

  assert.ok(
    rewritten.indexOf("## 核心贡献") < rewritten.indexOf("## 关键图表"),
  );
  assert.ok(
    rewritten.indexOf("## 关键图表") < rewritten.indexOf("## 问题背景"),
  );
  assert.match(rewritten, /### Teaser\n\n!\[]\(teaser\.jpg\)/);
  assert.match(rewritten, /### Pipeline\n\n!\[]\(pipeline\.jpg\)/);
});
