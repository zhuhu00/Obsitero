export type SyncField =
  | "title"
  | "authors"
  | "year"
  | "publication"
  | "tags"
  | "pdf"
  | "code"
  | "page"
  | "collections"
  | "citation_key"
  | "zotero_url"
  | "link"
  | "date_added"
  | "date_modified";

export type FileNameStrategy =
  | "title"
  | "citationKey"
  | "itemKey"
  | "authorYearTitle";

export interface SyncItemData {
  itemKey: string;
  title?: string;
  authors?: string[];
  authorsShort?: string[];
  year?: string;
  publication?: string;
  tags?: string[];
  pdf?: string;
  code?: string;
  page?: string;
  collections?: string[];
  citationKey?: string;
  zoteroUri?: string;
  doi?: string;
  url?: string;
  link?: string;
  dateAdded?: string;
  dateModified?: string;
  childNotes?: SyncChildNote[];
}

export interface SyncChildNote {
  title?: string;
  body: string;
}

export interface RenderSyncedMarkdownOptions {
  item: SyncItemData;
  selectedFields: SyncField[];
  existingContent?: string;
  syncedAt?: string;
}

export interface BasesFileOptions {
  outputFolder: string;
}

export const DEFAULT_SYNC_FIELDS: SyncField[] = [
  "authors",
  "publication",
  "tags",
  "link",
  "pdf",
  "zotero_url",
];

export const ALL_SYNC_FIELDS: SyncField[] = [
  "title",
  "authors",
  "year",
  "publication",
  "tags",
  "pdf",
  "code",
  "page",
  "collections",
  "citation_key",
  "zotero_url",
  "link",
  "date_added",
  "date_modified",
];

const MANAGED_START = "<!-- ZOTERO-SYNC:BEGIN -->";
const MANAGED_END = "<!-- ZOTERO-SYNC:END -->";
const LAST_SYNC_FIELD = "last_synced_at";
const DISPLAY_TITLE_FIELD = "display_title";
const AUTHORS_SHORT_FIELD = "authors_short";
const NOTE_CSS_CLASSES = ["zotero-paper"];
const PRIMARY_FIELD_ORDER: SyncField[] = [
  "authors",
  "publication",
  "tags",
  "link",
  "pdf",
  "zotero_url",
];
const SECONDARY_FIELD_ORDER: SyncField[] = [
  "title",
  "year",
  "collections",
  "citation_key",
  "date_added",
  "date_modified",
];
const OBSIDIAN_OWNED_FIELDS = new Set<SyncField>([
  "title",
  "authors",
  "publication",
  "tags",
  "link",
  "zotero_url",
]);

export function resolveMarkdownFilename(
  item: SyncItemData,
  strategy: FileNameStrategy,
): string {
  const baseName = buildBaseFileName(item, strategy);
  return `${baseName}.md`;
}

export function resolveUniqueMarkdownFilename(
  item: SyncItemData,
  strategy: FileNameStrategy,
  usedNames: Set<string>,
): string {
  const candidate = resolveMarkdownFilename(item, strategy);
  if (!usedNames.has(candidate)) {
    usedNames.add(candidate);
    return candidate;
  }

  const disambiguator = sanitizeFileName(
    item.citationKey || item.itemKey || "untitled",
  );
  const uniqueCandidate = `${buildBaseFileName(item, strategy)} - ${disambiguator}.md`;
  usedNames.add(uniqueCandidate);
  return uniqueCandidate;
}

export function renderSyncedMarkdown({
  item,
  selectedFields,
  existingContent,
  syncedAt,
}: RenderSyncedMarkdownOptions): string {
  const frontmatter = renderFrontmatter(
    item,
    selectedFields,
    syncedAt,
    existingContent,
  );
  const userSection = extractMyNotesSection(existingContent);
  const managedBlock = renderManagedNotesBlock(item.childNotes ?? []);

  return [
    frontmatter,
    "",
    userSection,
    ...(managedBlock ? ["", managedBlock] : []),
    "",
  ].join("\n");
}

export function buildBasesFile({
  outputFolder,
}: BasesFileOptions): string {
  return [
    "filters:",
    "  and:",
    `    - 'file.inFolder("${escapeForSingleQuotedBaseString(outputFolder)}")'`,
    '    - \'file.ext == "md"\'',
    "formulas:",
    `  title_link: '${buildLinkFormula("file.name", "display_title", true)}'`,
    `  url_link: '${buildLinkFormula("link", "link")}'`,
    `  pdf_link: '${buildLinkFormula("pdf", "pdf")}'`,
    `  zotero_link: '${buildLinkFormula("zotero_url", "zotero")}'`,
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
  ].join("\n");
}

function renderFrontmatter(
  item: SyncItemData,
  selectedFields: SyncField[],
  syncedAt?: string,
  existingContent?: string,
) {
  const lines = ["---"];
  lines.push(...renderHelperArrayField("cssclasses", NOTE_CSS_CLASSES));
  const existingDisplayTitle = extractExistingScalarField(
    existingContent,
    DISPLAY_TITLE_FIELD,
  );
  lines.push(
    `${DISPLAY_TITLE_FIELD}: ${escapeYaml(
      existingDisplayTitle.found
        ? existingDisplayTitle.value
        : (item.title ?? ""),
    )}`,
  );
  lines.push(...renderOrderedFields(item, selectedFields, existingContent));
  lines.push(...renderField("code", item, existingContent));
  lines.push(...renderField("page", item, existingContent));
  lines.push(
    ...renderHelperArrayField(AUTHORS_SHORT_FIELD, item.authorsShort ?? []),
  );
  if (syncedAt) {
    lines.push(`${LAST_SYNC_FIELD}: ${escapeYaml(syncedAt)}`);
  }

  lines.push("---");
  return lines.join("\n");
}

function buildLinkFormula(field: string, label: string, labelIsExpression = false) {
  const renderedLabel = labelIsExpression ? label : `"${label}"`;
  return `if(${field}, link(${field}, ${renderedLabel}), "")`;
}

function escapeForSingleQuotedBaseString(value: string) {
  return value.replace(/'/g, "''");
}

function renderOrderedFields(
  item: SyncItemData,
  selectedFields: SyncField[],
  existingContent?: string,
) {
  const rendered: string[] = [];
  const selected = new Set(selectedFields);
  const orderedFields = [...PRIMARY_FIELD_ORDER, ...SECONDARY_FIELD_ORDER];

  for (const field of orderedFields) {
    if (field === "code" || field === "page") {
      continue;
    }
    if (!selected.has(field)) {
      continue;
    }
    rendered.push(...renderField(field, item, existingContent));
    selected.delete(field);
  }

  for (const field of selected) {
    rendered.push(...renderField(field, item, existingContent));
  }

  return rendered;
}

function renderHelperArrayField(fieldName: string, value: string[]) {
  if (value.length === 0) {
    return [`${fieldName}: []`];
  }
  return [`${fieldName}:`, ...value.map((entry) => `  - ${escapeYaml(entry)}`)];
}

function renderField(
  field: SyncField,
  item: SyncItemData,
  existingContent?: string,
): string[] {
  const value = getFieldValue(field, item, existingContent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${field}: []`];
    }
    return [`${field}:`, ...value.map((entry) => `  - ${escapeYaml(entry)}`)];
  }

  if (!value) {
    return [`${field}:`];
  }

  return [`${field}: ${escapeYaml(value)}`];
}

function getFieldValue(
  field: SyncField,
  item: SyncItemData,
  existingContent?: string,
): string | string[] {
  if (OBSIDIAN_OWNED_FIELDS.has(field)) {
    const existingValue = getExistingFieldValue(existingContent, field);
    if (existingValue.found) {
      return existingValue.value;
    }
  }

  switch (field) {
    case "title":
      return item.title ?? "";
    case "authors":
      return item.authors ?? [];
    case "year":
      return item.year ?? "";
    case "publication":
      return item.publication ?? "";
    case "tags":
      return (
        item.tags ?? extractExistingArrayField(existingContent, "tags").value
      );
    case "pdf":
      return item.pdf ?? "";
    case "code":
      return extractExistingScalarField(existingContent, "code").value;
    case "page":
      return extractExistingScalarField(existingContent, "page").value;
    case "collections":
      return item.collections ?? [];
    case "citation_key":
      return item.citationKey ?? "";
    case "zotero_url":
      return item.zoteroUri ?? "";
    case "link":
      return item.link ?? "";
    case "date_added":
      return item.dateAdded ?? "";
    case "date_modified":
      return item.dateModified ?? "";
  }
}

function getExistingFieldValue(
  existingContent: string | undefined,
  field: SyncField,
): ExistingFieldValue<string | string[]> {
  switch (field) {
    case "authors":
    case "tags":
    case "collections":
      return extractExistingArrayField(existingContent, field);
    case "title":
      return extractExistingScalarField(existingContent, "title");
    case "publication":
      return extractExistingScalarField(existingContent, "publication");
    case "link":
      return extractExistingScalarField(existingContent, "link");
    case "zotero_url":
      return extractExistingScalarField(existingContent, "zotero_url");
    default:
      return { found: false, value: "" };
  }
}

interface ExistingFieldValue<T> {
  found: boolean;
  value: T;
}

function extractExistingScalarField(
  existingContent: string | undefined,
  fieldName: string,
): ExistingFieldValue<string> {
  const frontmatter = extractFrontmatter(existingContent);
  if (!frontmatter) {
    return { found: false, value: "" };
  }

  const match = frontmatter.match(new RegExp(`^${fieldName}:\\s*(.*)$`, "m"));
  if (!match) {
    return { found: false, value: "" };
  }

  const rawValue = match[1].trim();
  if (!rawValue) {
    return { found: true, value: "" };
  }

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    try {
      return { found: true, value: JSON.parse(rawValue) };
    } catch {
      return { found: true, value: rawValue.slice(1, -1) };
    }
  }

  return { found: true, value: rawValue };
}

function extractExistingArrayField(
  existingContent: string | undefined,
  fieldName: string,
): ExistingFieldValue<string[]> {
  const frontmatter = extractFrontmatter(existingContent);
  if (!frontmatter) {
    return { found: false, value: [] };
  }

  const lines = frontmatter.split("\n");
  const startIndex = lines.findIndex((line) =>
    line.startsWith(`${fieldName}:`),
  );
  if (startIndex === -1) {
    return { found: false, value: [] };
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("  - ")) {
      break;
    }
    const rawValue = line.slice(4).trim();
    if (!rawValue) {
      continue;
    }
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      try {
        values.push(JSON.parse(rawValue));
        continue;
      } catch {
        values.push(rawValue.slice(1, -1));
        continue;
      }
    }
    values.push(rawValue);
  }

  return { found: true, value: values };
}

function extractFrontmatter(existingContent?: string) {
  if (!existingContent) {
    return "";
  }

  const normalized = existingContent.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  return match?.[1] ?? "";
}

function extractMyNotesSection(existingContent?: string): string {
  if (!existingContent) {
    return "## My Notes\n";
  }

  const normalized = existingContent.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const headingIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === "## my notes",
  );

  if (headingIndex === -1) {
    return "## My Notes\n";
  }

  const managedIndex = lines.findIndex(
    (line, index) => index > headingIndex && line.trim() === MANAGED_START,
  );
  const endIndex = managedIndex === -1 ? lines.length : managedIndex;
  return `${lines.slice(headingIndex, endIndex).join("\n").trimEnd()}\n`;
}

function renderManagedNotesBlock(notes: SyncChildNote[]) {
  if (!notes.length) {
    return "";
  }

  const lines = [MANAGED_START, "## Zotero Notes", ""];
  notes.forEach((note, index) => {
    const title = note.title?.trim();
    const body = note.body.trim();
    if (title && normalizeWhitespace(title) !== normalizeWhitespace(body)) {
      lines.push(`### ${title}`, "");
    }
    lines.push(body);
    if (index < notes.length - 1) {
      lines.push("");
    }
    lines.push("");
  });
  lines.push(MANAGED_END);
  return lines.join("\n");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function selectBaseFileName(
  item: SyncItemData,
  strategy: FileNameStrategy,
): string | undefined {
  switch (strategy) {
    case "title":
      return item.title || item.citationKey || item.itemKey;
    case "citationKey":
      return item.citationKey || item.itemKey;
    case "itemKey":
      return item.itemKey;
    case "authorYearTitle": {
      const firstAuthor = item.authors?.[0]?.split(/\s+/).at(-1);
      const parts = [firstAuthor, item.year, item.title].filter(Boolean);
      return parts.length > 0 ? parts.join(" ") : item.itemKey;
    }
  }
}

function buildBaseFileName(
  item: SyncItemData,
  strategy: FileNameStrategy,
): string {
  return sanitizeFileName(
    selectBaseFileName(item, strategy) ??
      item.citationKey ??
      item.itemKey ??
      "untitled",
  );
}

function sanitizeFileName(value: string): string {
  const sanitized = stripControlCharacters(value)
    .replace(/:/g, "_")
    .replace(/[<>"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "untitled";
}

function stripControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("");
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}
