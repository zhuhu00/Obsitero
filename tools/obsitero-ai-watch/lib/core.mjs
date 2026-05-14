/* global URL */

const AI_BLOCK_START = "<!-- OBSITERO-AI-START -->";
const AI_BLOCK_END = "<!-- OBSITERO-AI-END -->";
const ZOTERO_BLOCK_START = "<!-- ZOTERO-SYNC:BEGIN -->";

export function parsePaperNote(markdown) {
  const normalized = normalizeNewlines(markdown);
  const frontmatter = extractFrontmatter(normalized);
  const localFileValue = extractScalarField(frontmatter, "local_file");

  return {
    markdown: normalized,
    frontmatter,
    localFilePath: decodeFileUrl(localFileValue),
    hasMyNotes: /^# My Notes$/m.test(normalized),
    hasAiNotes: /^# AI Notes$/m.test(normalized),
    hasZoteroNotes: /^# Zotero Notes$/m.test(normalized),
  };
}

export function normalizeAiNotesContent(rawOutput) {
  const normalized = normalizeNewlines(rawOutput).trim();
  const withoutFence = normalized
    .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
    .replace(/\n```$/, "")
    .trim();
  const withoutMarkers = withoutFence
    .replace(new RegExp(`^${escapeRegExp(AI_BLOCK_START)}\\n?`, "m"), "")
    .replace(new RegExp(`\\n?${escapeRegExp(AI_BLOCK_END)}$`, "m"), "")
    .trim();
  const aiHeadingMatches = [...withoutMarkers.matchAll(/^# AI Notes$/gm)];

  if (aiHeadingMatches.length === 0) {
    return withoutMarkers;
  }

  const firstHeadingIndex = aiHeadingMatches[0].index ?? 0;
  const secondHeadingIndex = aiHeadingMatches[1]?.index;
  const sliced =
    secondHeadingIndex == null
      ? withoutMarkers.slice(firstHeadingIndex)
      : withoutMarkers.slice(firstHeadingIndex, secondHeadingIndex);

  return sliced.trim();
}

export function upsertAiNotes(markdown, aiNotesContent) {
  const normalized = normalizeNewlines(markdown);
  const aiBlock = buildManagedAiBlock(aiNotesContent);
  const existingBlockPattern = new RegExp(
    `${escapeRegExp(AI_BLOCK_START)}[\\s\\S]*?${escapeRegExp(AI_BLOCK_END)}\\n?`,
    "m",
  );

  if (existingBlockPattern.test(normalized)) {
    return normalized.replace(existingBlockPattern, `${aiBlock}\n`);
  }

  const zoteroBlockIndex = normalized.indexOf(ZOTERO_BLOCK_START);
  if (zoteroBlockIndex >= 0) {
    const beforeZotero = normalized.slice(0, zoteroBlockIndex).trimEnd();
    const zoteroAndAfter = normalized.slice(zoteroBlockIndex).trimStart();
    return `${beforeZotero}\n\n${aiBlock}\n\n${zoteroAndAfter}\n`;
  }

  return `${normalized.trimEnd()}\n\n${aiBlock}\n`;
}

export function shouldProcessPaper({
  parsedNote,
  stateEntry,
  mode = "run-once",
}) {
  if (!parsedNote.localFilePath) {
    return false;
  }

  if (mode === "watch") {
    return !parsedNote.hasAiNotes && !stateEntry;
  }

  return !parsedNote.hasAiNotes;
}

function buildManagedAiBlock(aiNotesContent) {
  const trimmed = normalizeAiNotesContent(aiNotesContent);
  return `${AI_BLOCK_START}\n${trimmed}\n${AI_BLOCK_END}`;
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  return match?.[1] ?? "";
}

function extractScalarField(frontmatter, fieldName) {
  const match = frontmatter.match(
    new RegExp(`^${escapeRegExp(fieldName)}:[ \\t]*(.*)$`, "m"),
  );
  if (!match) {
    return "";
  }

  const rawValue = match[1].trim();
  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    try {
      return JSON.parse(rawValue);
    } catch {
      return rawValue.slice(1, -1);
    }
  }

  return rawValue;
}

function decodeFileUrl(value) {
  if (!value) {
    return undefined;
  }

  if (!value.startsWith("file://")) {
    return value;
  }

  try {
    return decodeURIComponent(new URL(value).pathname);
  } catch {
    return value.slice("file://".length);
  }
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
