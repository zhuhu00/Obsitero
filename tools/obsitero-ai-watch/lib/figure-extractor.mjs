import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCommand } from "./process.mjs";

const EMPTY_EMBED = "![]()";
const FIGURE_REF_PATTERN =
  /\b(?:fig(?:ure)?\.?|图)\s*([0-9]+[a-z]?)(?:\b|[.)：:])/gi;
const POSITIVE_PIPELINE_KEYWORDS = [
  "pipeline",
  "architecture",
  "overview",
  "framework",
  "method",
  "system overview",
  "model overview",
  "network architecture",
  "overall framework",
];
const NEGATIVE_PIPELINE_KEYWORDS = [
  "qualitative",
  "result",
  "results",
  "histogram",
  "ablation",
  "comparison",
  "benchmark",
  "visualization",
  "examples",
  "distribution",
];
const DEFAULT_RENDER_DPI = 200;

export async function extractPdfFigures({
  pdfPath,
  aiNotesContent = "",
  teaserImagePath,
  pipelineImagePath,
  commandRunner = runCommand,
  renderDpi = DEFAULT_RENDER_DPI,
}) {
  const result = {
    teaser: { created: false },
    pipeline: { created: false },
    errors: [],
  };

  await removeStaleOutputs([teaserImagePath, pipelineImagePath]);

  const bboxResult = await runOptionalCommand(commandRunner, [
    "pdftotext",
    "-bbox-layout",
    pdfPath,
    "-",
  ]);
  if (!bboxResult.ok) {
    result.errors.push(`pdftotext failed: ${bboxResult.error}`);
    return result;
  }

  const pages = parseBboxLayout(bboxResult.stdout);
  const captions = findFigureCaptions(pages);
  const selections = selectFigureCaptions(captions, aiNotesContent);

  await renderSelectedFigure({
    kind: "teaser",
    selection: selections.teaser,
    outputPath: teaserImagePath,
    pdfPath,
    captions,
    commandRunner,
    renderDpi,
    result,
  });
  await renderSelectedFigure({
    kind: "pipeline",
    selection: selections.pipeline,
    outputPath: pipelineImagePath,
    pdfPath,
    captions,
    commandRunner,
    renderDpi,
    result,
  });

  return result;
}

export function parseBboxLayout(content) {
  const pages = [];
  const pagePattern = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
  let pageMatch;
  let pageNumber = 1;

  while ((pageMatch = pagePattern.exec(content)) !== null) {
    const attrs = parseAttributes(pageMatch[1]);
    const lines = parsePageLines(pageMatch[2]);
    pages.push({
      pageNumber,
      width: numberOrDefault(attrs.width, 0),
      height: numberOrDefault(attrs.height, 0),
      lines,
    });
    pageNumber += 1;
  }

  return pages;
}

export function findFigureCaptions(pages) {
  const captions = [];

  for (const page of pages) {
    for (let index = 0; index < page.lines.length; index += 1) {
      const line = page.lines[index];
      const figureNumber = matchCaptionStart(line.text);
      if (!figureNumber) {
        continue;
      }

      const captionLines = collectCaptionLines(page.lines, index);
      captions.push({
        id: `${page.pageNumber}:${figureNumber}`,
        figureNumber,
        pageNumber: page.pageNumber,
        page,
        text: captionLines.map((captionLine) => captionLine.text).join(" "),
        bbox: unionBoxes(captionLines.map((captionLine) => captionLine.bbox)),
      });
    }
  }

  return captions;
}

export function selectFigureCaptions(captions, aiNotesContent = "") {
  const references = extractFigureReferences(aiNotesContent);
  const byNumber = new Map(
    captions.map((caption) => [caption.figureNumber, caption]),
  );
  const teaser =
    byNumber.get("1") ??
    firstReferencedCaption(references.teaser, byNumber) ??
    captions[0];
  const explicitPipeline = firstReferencedCaption(
    references.pipeline,
    byNumber,
  );
  const pipeline =
    explicitPipeline ??
    selectPipelineByCaption(
      teaser
        ? captions.filter((caption) => caption.id !== teaser.id)
        : captions,
    );

  return { teaser, pipeline, references };
}

export function rewriteKeyFiguresSection(
  aiNotesContent,
  { teaserMarkdownEmbed, pipelineMarkdownEmbed, teaserExists, pipelineExists },
) {
  const normalized = normalizeNewlines(aiNotesContent).trim();
  const section = findHeadingSection(normalized, "关键图表", 2);
  const teaserDescription = extractFigureDescription(
    section?.content,
    "Teaser",
  );
  const pipelineDescription = extractFigureDescription(
    section?.content,
    "Pipeline",
  );
  const keyFiguresSection = buildKeyFiguresSection({
    teaserEmbed: teaserExists ? teaserMarkdownEmbed : EMPTY_EMBED,
    pipelineEmbed: pipelineExists ? pipelineMarkdownEmbed : EMPTY_EMBED,
    teaserDescription,
    pipelineDescription,
  });

  if (section) {
    return replaceRange(
      normalized,
      section.start,
      section.end,
      keyFiguresSection,
    );
  }

  const coreSection = findHeadingSection(normalized, "核心贡献", 2);
  if (coreSection) {
    return replaceRange(
      normalized,
      coreSection.end,
      coreSection.end,
      keyFiguresSection,
    );
  }

  const backgroundSection = findHeadingSection(normalized, "问题背景", 2);
  if (backgroundSection) {
    return replaceRange(
      normalized,
      backgroundSection.start,
      backgroundSection.start,
      keyFiguresSection,
    );
  }

  const aiNotesHeading = findHeadingSection(normalized, "AI Notes", 1);
  if (aiNotesHeading) {
    return replaceRange(
      normalized,
      aiNotesHeading.headingEnd,
      aiNotesHeading.headingEnd,
      keyFiguresSection,
    );
  }

  return `${normalized}\n\n${keyFiguresSection}`;
}

async function renderSelectedFigure({
  kind,
  selection,
  outputPath,
  pdfPath,
  captions,
  commandRunner,
  renderDpi,
  result,
}) {
  if (!selection || !outputPath) {
    return;
  }

  try {
    await renderAndCropFigure({
      pdfPath,
      caption: selection,
      previousCaption: findPreviousCaption(selection, captions),
      outputPath,
      commandRunner,
      renderDpi,
    });
    result[kind] = {
      created: await pathExists(outputPath),
      figureNumber: selection.figureNumber,
      pageNumber: selection.pageNumber,
    };
  } catch (error) {
    result.errors.push(
      `${kind} extraction failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function renderAndCropFigure({
  pdfPath,
  caption,
  previousCaption,
  outputPath,
  commandRunner,
  renderDpi,
}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "obsitero-fig-"));
  try {
    const outputPrefix = path.join(tempDir, `page-${caption.pageNumber}`);
    const renderedPagePath = `${outputPrefix}.jpg`;
    await requireSuccessfulCommand(commandRunner, [
      "pdftoppm",
      "-f",
      String(caption.pageNumber),
      "-l",
      String(caption.pageNumber),
      "-r",
      String(renderDpi),
      "-jpeg",
      "-singlefile",
      pdfPath,
      outputPrefix,
    ]);

    const crop = buildFigureCrop({
      caption,
      previousCaption,
      renderDpi,
    });
    await requireSuccessfulCommand(commandRunner, [
      "magick",
      renderedPagePath,
      "-crop",
      `${crop.width}x${crop.height}+${crop.x}+${crop.y}`,
      "+repage",
      "-quality",
      "92",
      outputPath,
    ]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function buildFigureCrop({ caption, previousCaption, renderDpi }) {
  const pageWidth = caption.page.width || caption.bbox.xMax;
  const pageHeight = caption.page.height || caption.bbox.yMax;
  const margin = 12;
  const yMin = Math.max(
    0,
    previousCaption && previousCaption.bbox.yMax < caption.bbox.yMin
      ? previousCaption.bbox.yMax + margin
      : 0,
  );
  const yMax = Math.min(pageHeight, caption.bbox.yMax + margin);
  const scale = renderDpi / 72;

  return {
    x: 0,
    y: Math.max(0, Math.floor(yMin * scale)),
    width: Math.max(1, Math.ceil(pageWidth * scale)),
    height: Math.max(1, Math.ceil((yMax - yMin) * scale)),
  };
}

function parsePageLines(pageContent) {
  const lines = [];
  const linePattern = /<line\b[^>]*>([\s\S]*?)<\/line>/gi;
  let lineMatch;

  while ((lineMatch = linePattern.exec(pageContent)) !== null) {
    const words = parseWords(lineMatch[1]);
    if (words.length === 0) {
      continue;
    }
    lines.push({
      text: words
        .map((word) => word.text)
        .join(" ")
        .replace(/\s+/g, " "),
      bbox: unionBoxes(words.map((word) => word.bbox)),
      words,
    });
  }

  if (lines.length === 0) {
    const words = parseWords(pageContent);
    if (words.length > 0) {
      lines.push({
        text: words
          .map((word) => word.text)
          .join(" ")
          .replace(/\s+/g, " "),
        bbox: unionBoxes(words.map((word) => word.bbox)),
        words,
      });
    }
  }

  return lines;
}

function parseWords(content) {
  const words = [];
  const wordPattern = /<word\b([^>]*)>([\s\S]*?)<\/word>/gi;
  let wordMatch;

  while ((wordMatch = wordPattern.exec(content)) !== null) {
    const attrs = parseAttributes(wordMatch[1]);
    const text = decodeHtml(wordMatch[2]).trim();
    if (!text) {
      continue;
    }
    words.push({
      text,
      bbox: {
        xMin: numberOrDefault(attrs.xMin, 0),
        yMin: numberOrDefault(attrs.yMin, 0),
        xMax: numberOrDefault(attrs.xMax, 0),
        yMax: numberOrDefault(attrs.yMax, 0),
      },
    });
  }

  return words;
}

function parseAttributes(value) {
  const attrs = {};
  const attrPattern = /([A-Za-z][\w:-]*)="([^"]*)"/g;
  let attrMatch;
  while ((attrMatch = attrPattern.exec(value)) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }
  return attrs;
}

function collectCaptionLines(lines, startIndex) {
  const captionLines = [lines[startIndex]];
  const maxLines = Math.min(lines.length, startIndex + 6);

  for (let index = startIndex + 1; index < maxLines; index += 1) {
    const previous = captionLines[captionLines.length - 1];
    const next = lines[index];
    if (matchCaptionStart(next.text) || isLikelyNonCaptionStart(next.text)) {
      break;
    }
    const gap = next.bbox.yMin - previous.bbox.yMax;
    const previousHeight = previous.bbox.yMax - previous.bbox.yMin;
    if (gap < -1 || gap > Math.max(18, previousHeight * 1.8)) {
      break;
    }
    captionLines.push(next);
  }

  return captionLines;
}

function matchCaptionStart(text) {
  const match = text
    .trim()
    .match(/^(?:fig(?:ure)?\.?|图)\s*([0-9]+[a-z]?)(?:\s*[:.)：-]|\b)/i);
  return match ? normalizeFigureNumber(match[1]) : undefined;
}

function isLikelyNonCaptionStart(text) {
  const trimmed = text.trim();
  return (
    /^(?:abstract|introduction|related work|method|experiments?|references|appendix)\b/i.test(
      trimmed,
    ) ||
    /^(?:table|tab\.)\s+[0-9]+/i.test(trimmed) ||
    /^\d+(?:\.\d+)*\s+[A-Z]/.test(trimmed)
  );
}

function selectPipelineByCaption(captions) {
  const scored = captions
    .map((caption) => ({
      caption,
      score: scorePipelineCaption(caption),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (
        Number(left.caption.figureNumber) - Number(right.caption.figureNumber)
      );
    });

  return scored[0]?.caption;
}

function scorePipelineCaption(caption) {
  const text = caption.text.toLowerCase();
  let score = 0;

  for (const keyword of POSITIVE_PIPELINE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += keyword.includes(" ") ? 4 : 3;
    }
  }
  for (const keyword of NEGATIVE_PIPELINE_KEYWORDS) {
    if (text.includes(keyword)) {
      score -= 5;
    }
  }
  const figureNumber = Number.parseInt(caption.figureNumber, 10);
  if (Number.isFinite(figureNumber) && figureNumber <= 3) {
    score += 1;
  }

  return score;
}

function extractFigureReferences(markdown) {
  const teaserSection = extractNamedSubsection(markdown, "Teaser");
  const pipelineSection = extractNamedSubsection(markdown, "Pipeline");

  return {
    teaser: findFigureReferences(teaserSection),
    pipeline: findFigureReferences(pipelineSection),
    all: findFigureReferences(markdown),
  };
}

function firstReferencedCaption(references, byNumber) {
  for (const reference of references) {
    if (byNumber.has(reference)) {
      return byNumber.get(reference);
    }
  }
  return undefined;
}

function findFigureReferences(text = "") {
  const references = [];
  let match;
  FIGURE_REF_PATTERN.lastIndex = 0;
  while ((match = FIGURE_REF_PATTERN.exec(text)) !== null) {
    const figureNumber = normalizeFigureNumber(match[1]);
    if (!references.includes(figureNumber)) {
      references.push(figureNumber);
    }
  }
  return references;
}

function extractFigureDescription(sectionContent = "", title) {
  const subsection = extractNamedSubsection(sectionContent, title);
  if (!subsection) {
    return "**说明**: 未提及";
  }

  const withoutEmbeds = subsection
    .split("\n")
    .filter((line) => !/^\s*!\[[^\]]*]\([^)]*\)\s*$/.test(line))
    .join("\n")
    .trim();
  const descriptionIndex = withoutEmbeds.search(/^\*\*说明\*\*/m);
  if (descriptionIndex >= 0) {
    return withoutEmbeds.slice(descriptionIndex).trim() || "**说明**: 未提及";
  }

  return "**说明**: 未提及";
}

function extractNamedSubsection(markdown = "", title) {
  const lines = normalizeNewlines(markdown).split("\n");
  let startLine = -1;
  let level = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match && match[2].toLowerCase() === title.toLowerCase()) {
      startLine = index + 1;
      level = match[1].length;
      break;
    }
  }

  if (startLine < 0) {
    return "";
  }

  let endLine = lines.length;
  for (let index = startLine; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/);
    if (match && match[1].length <= level) {
      endLine = index;
      break;
    }
  }

  return lines.slice(startLine, endLine).join("\n").trim();
}

function buildKeyFiguresSection({
  teaserEmbed,
  pipelineEmbed,
  teaserDescription,
  pipelineDescription,
}) {
  return `## 关键图表

### Teaser

${teaserEmbed}

${teaserDescription}

### Pipeline

${pipelineEmbed}

${pipelineDescription}`;
}

function findHeadingSection(markdown, title, level) {
  const headingPattern = new RegExp(
    `^${"#".repeat(level)}\\s+${escapeRegExp(title)}\\s*$`,
    "m",
  );
  const match = headingPattern.exec(markdown);
  if (!match) {
    return undefined;
  }

  const start = match.index;
  const headingEnd = start + match[0].length;
  const contentStart =
    markdown[headingEnd] === "\n" ? headingEnd + 1 : headingEnd;
  const rest = markdown.slice(contentStart);
  const nextHeadingPattern = new RegExp(`^#{1,${level}}\\s+`, "m");
  const nextHeading = nextHeadingPattern.exec(rest);
  const end = nextHeading ? contentStart + nextHeading.index : markdown.length;

  return {
    start,
    end,
    headingEnd,
    content: markdown.slice(contentStart, end).trim(),
  };
}

function replaceRange(value, start, end, replacement) {
  const before = value.slice(0, start).trimEnd();
  const after = value.slice(end).trimStart();
  if (!before) {
    return after ? `${replacement}\n\n${after}` : replacement;
  }
  return after
    ? `${before}\n\n${replacement}\n\n${after}`
    : `${before}\n\n${replacement}`;
}

function findPreviousCaption(caption, captions) {
  return captions
    .filter(
      (candidate) =>
        candidate.pageNumber === caption.pageNumber &&
        candidate.bbox.yMax < caption.bbox.yMin,
    )
    .sort((left, right) => right.bbox.yMax - left.bbox.yMax)[0];
}

function unionBoxes(boxes) {
  return boxes.reduce(
    (result, box) => ({
      xMin: Math.min(result.xMin, box.xMin),
      yMin: Math.min(result.yMin, box.yMin),
      xMax: Math.max(result.xMax, box.xMax),
      yMax: Math.max(result.yMax, box.yMax),
    }),
    {
      xMin: Number.POSITIVE_INFINITY,
      yMin: Number.POSITIVE_INFINITY,
      xMax: Number.NEGATIVE_INFINITY,
      yMax: Number.NEGATIVE_INFINITY,
    },
  );
}

async function runOptionalCommand(commandRunner, commandConfig) {
  try {
    const result = await commandRunner(commandConfig, {}, {});
    if (result.code === 0) {
      return { ok: true, stdout: result.stdout };
    }
    return { ok: false, error: result.stderr || result.stdout || result.code };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function requireSuccessfulCommand(commandRunner, commandConfig) {
  const result = await commandRunner(commandConfig, {}, {});
  if (result.code !== 0) {
    throw new Error(
      result.stderr || result.stdout || `exit code ${result.code}`,
    );
  }
  return result;
}

async function removeStaleOutputs(outputPaths) {
  await Promise.all(
    outputPaths
      .filter(Boolean)
      .map((outputPath) => fs.rm(outputPath, { force: true })),
  );
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10)),
    );
}

function numberOrDefault(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeFigureNumber(value) {
  return value.toLowerCase().replace(/[^0-9a-z]/g, "");
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
