import { getAllCollectionItems } from "./collections";
import {
  DEFAULT_FILE_NAME_STRATEGY,
  DEFAULT_OUTPUT_FOLDER,
  loadCollectionSyncConfigs,
  loadSelectedFields,
  loadSyncedCollectionIDs,
} from "./config";
import {
  buildBasesFile,
  renderSyncedMarkdown,
  resolveUniqueMarkdownFilename,
  type FileNameStrategy,
} from "./markdown";
import { buildSyncItemData } from "./item";
import { getPref } from "../utils/prefs";
import { joinPath, readTextIfExists } from "../utils/filesystem";

const DEBUG_LOG_PATH = "/tmp/obsitero-debug.log";
const LEGACY_INDEX_FILE_NAME = "_Index.md";
const BASES_FILE_NAME = "Zotero.base";
const LEGACY_BASES_DIRECTORY = "Bases";
const LEGACY_TEMPLATE_BASES_PARENT_DIRECTORY = "Templates";
const LEGACY_TEMPLATE_BASES_CHILD_DIRECTORY = "Bases";

export async function syncItemsToObsidian(items: Zotero.Item[]) {
  await debugLog("syncItemsToObsidian:start", {
    incomingCount: items.length,
    incomingIDs: items.map((item) => item.id),
  });
  const validItems = dedupeItems(items).filter(
    (item) => !item.deleted && item.isRegularItem(),
  );
  await debugLog("syncItemsToObsidian:valid-items", {
    validCount: validItems.length,
    validIDs: validItems.map((item) => item.id),
  });

  if (!validItems.length) {
    await debugLog("syncItemsToObsidian:no-valid-items");
    return { syncedCount: 0 };
  }

  await Zotero.Items.loadDataTypes(validItems, [
    "primaryData",
    "itemData",
    "creators",
    "tags",
    "collections",
    "childItems",
  ]);
  await debugLog("syncItemsToObsidian:data-loaded", {
    validIDs: validItems.map((item) => item.id),
  });

  const outputDirectory = getOutputDirectory();
  await debugLog("syncItemsToObsidian:output-directory", { outputDirectory });
  if (!outputDirectory) {
    showProgress(
      "Obsidian vault path or output folder is not configured.",
      "warning",
    );
    await debugLog("syncItemsToObsidian:missing-output-directory");
    return { syncedCount: 0 };
  }

  await debugLog("syncItemsToObsidian:ensure-output-directory:start", {
    outputDirectory,
  });
  await Zotero.File.createDirectoryIfMissingAsync(outputDirectory);
  await debugLog("syncItemsToObsidian:ensure-output-directory:done", {
    outputDirectory,
  });

  const selectedFields = loadSelectedFields();
  const fileNameStrategy =
    (getPref("fileNameStrategy") as FileNameStrategy | undefined) ||
    DEFAULT_FILE_NAME_STRATEGY;
  const syncedAt = new Date().toISOString();
  await debugLog("syncItemsToObsidian:list-existing:start", {
    outputDirectory,
  });
  const existingFiles = await listExistingMarkdownFiles(outputDirectory);
  await debugLog("syncItemsToObsidian:list-existing:done", {
    outputDirectory,
    existingCount: existingFiles.names.size,
    existingNames: Array.from(existingFiles.names),
  });
  const usedFileNames = new Set(existingFiles.names);
  usedFileNames.delete(LEGACY_INDEX_FILE_NAME);

  for (const item of validItems) {
    await debugLog("syncItemsToObsidian:building-item-data", {
      itemID: item.id,
      itemKey: item.key,
      title: item.getField("title") || item.getDisplayTitle(),
      childNoteIDs: item.getNotes?.() || [],
    });
    const itemData = await buildSyncItemData(item);
    await debugLog("syncItemsToObsidian:built-item-data", {
      itemID: item.id,
      itemKey: item.key,
      title: itemData.title,
      childNoteCount: itemData.childNotes?.length ?? 0,
    });
    const existingFileName =
      itemData.zoteroUri && existingFiles.byZoteroUrl.has(itemData.zoteroUri)
        ? existingFiles.byZoteroUrl.get(itemData.zoteroUri)
        : undefined;
    const fileName =
      existingFileName ||
      resolveUniqueMarkdownFilename(itemData, fileNameStrategy, usedFileNames);
    const filePath = joinPath(outputDirectory, fileName);
    await debugLog("syncItemsToObsidian:writing-file", {
      itemID: item.id,
      itemKey: item.key,
      filePath,
    });
    const existingContent = await readIfExists(filePath);
    const content = renderSyncedMarkdown({
      item: itemData,
      selectedFields,
      existingContent,
      syncedAt,
    });
    await Zotero.File.putContentsAsync(filePath, content);
  }

  const legacyIndexPath = joinPath(outputDirectory, LEGACY_INDEX_FILE_NAME);
  await removePathIfExists(legacyIndexPath);
  await debugLog("syncItemsToObsidian:removed-legacy-index", {
    legacyIndexPath,
  });

  const legacyRootBasePath = joinPath(getPref("vaultPath"), BASES_FILE_NAME);
  await removePathIfExists(legacyRootBasePath);
  await debugLog("syncItemsToObsidian:removed-legacy-root-base", {
    legacyRootBasePath,
  });

  const legacyBasesPath = joinPath(
    getPref("vaultPath"),
    LEGACY_BASES_DIRECTORY,
    BASES_FILE_NAME,
  );
  await removePathIfExists(legacyBasesPath);
  await debugLog("syncItemsToObsidian:removed-legacy-bases-base", {
    legacyBasesPath,
  });

  const legacyTemplateBasesPath = joinPath(
    getPref("vaultPath"),
    LEGACY_TEMPLATE_BASES_PARENT_DIRECTORY,
    LEGACY_TEMPLATE_BASES_CHILD_DIRECTORY,
    BASES_FILE_NAME,
  );
  await removePathIfExists(legacyTemplateBasesPath);
  await debugLog("syncItemsToObsidian:removed-legacy-template-bases-base", {
    legacyTemplateBasesPath,
  });

  if (getPref("createDataviewIndex")) {
    const basePath = joinPath(outputDirectory, BASES_FILE_NAME);
    const baseContent = buildBasesFile({
      outputFolder: getPref("outputFolder") || DEFAULT_OUTPUT_FOLDER,
    });
    await Zotero.File.putContentsAsync(basePath, baseContent);
    await debugLog("syncItemsToObsidian:wrote-base-file", { basePath });
  }

  showProgress(
    `Synced ${validItems.length} Zotero item(s) to Obsidian.`,
    "success",
  );
  await debugLog("syncItemsToObsidian:done", {
    syncedCount: validItems.length,
  });
  return { syncedCount: validItems.length };
}

export async function syncCollectionToObsidian(collection: Zotero.Collection) {
  return syncItemsToObsidian(getAllCollectionItems(collection));
}

export async function syncEnabledCollectionsOnStartup() {
  await debugLog("syncEnabledCollectionsOnStartup:start", {
    vaultPath: getPref("vaultPath"),
    outputFolder: getPref("outputFolder"),
    collectionSyncConfigs: loadCollectionSyncConfigs(),
  });
  const monitoredCollectionIDs = Object.entries(loadCollectionSyncConfigs())
    .filter(([, config]) => config.syncEnabled)
    .map(([collectionID]) => Number(collectionID))
    .filter((collectionID) => collectionID > 0);
  await debugLog("syncEnabledCollectionsOnStartup:collection-ids", {
    monitoredCollectionIDs,
  });

  if (!monitoredCollectionIDs.length) {
    await debugLog("syncEnabledCollectionsOnStartup:no-monitored-collections");
    return { syncedCollectionCount: 0 };
  }

  const collections = monitoredCollectionIDs
    .map((collectionID) => Zotero.Collections.get(collectionID))
    .filter(Boolean);
  await debugLog("syncEnabledCollectionsOnStartup:collections-loaded", {
    collectionNames: collections.map((collection) => collection.name),
  });
  for (const collection of collections) {
    await debugLog("syncEnabledCollectionsOnStartup:syncing-collection", {
      collectionID: collection.id,
      collectionName: collection.name,
    });
    await syncCollectionToObsidian(collection);
  }

  await debugLog("syncEnabledCollectionsOnStartup:done", {
    syncedCollectionCount: collections.length,
  });
  return { syncedCollectionCount: collections.length };
}

export async function syncItemsByIDs(itemIDs: Array<number | string>) {
  const items = await Zotero.Items.getAsync(itemIDs.map(Number));
  return syncItemsToObsidian(items);
}

export async function handleAutoSyncForNotifier(
  event: string,
  type: string,
  ids: Array<string | number>,
) {
  if (!getPref("syncOnModify")) {
    return;
  }

  const monitoredCollectionIDs = loadSyncedCollectionIDs();
  if (!monitoredCollectionIDs.size) {
    return;
  }

  if (type === "collection-item" && event === "add") {
    const itemIDs = ids
      .map((compoundID) => String(compoundID).split("-").map(Number))
      .filter(
        (parts): parts is [number, number] =>
          parts.length === 2 && monitoredCollectionIDs.has(parts[0]),
      )
      .map((parts) => parts[1]);
    if (itemIDs.length) {
      await syncItemsByIDs(itemIDs);
    }
    return;
  }

  if (type === "item" && event === "modify") {
    const items = Zotero.Items.get(ids.map(Number)).filter(
      (item) =>
        item.isRegularItem() &&
        item
          .getCollections()
          .some((collectionID) => monitoredCollectionIDs.has(collectionID)),
    );
    if (items.length) {
      await syncItemsToObsidian(items);
    }
    return;
  }

  if (type === "item-tag" && (event === "modify" || event === "remove")) {
    const itemIDs = ids.map((compoundID) =>
      Number(String(compoundID).split("-")[0]),
    );
    const items = Zotero.Items.get(itemIDs).filter(
      (item) =>
        item.isRegularItem() &&
        item
          .getCollections()
          .some((collectionID) => monitoredCollectionIDs.has(collectionID)),
    );
    if (items.length) {
      await syncItemsToObsidian(items);
    }
  }
}

function dedupeItems(items: Zotero.Item[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function getOutputDirectory() {
  const vaultPath = getPref("vaultPath")?.trim();
  if (!vaultPath) {
    return "";
  }

  const outputFolder = getPref("outputFolder")?.trim();
  if (!outputFolder) {
    return "";
  }

  return joinPath(vaultPath, outputFolder);
}

async function readIfExists(path: string) {
  return readTextIfExists(path);
}

async function removePathIfExists(path: string) {
  try {
    await Zotero.File.removeIfExists(path);
  } catch {
    // Legacy cleanup should never block the current sync flow.
  }
}

async function listExistingMarkdownFiles(directory: string) {
  const names = new Set<string>();
  const byZoteroUrl = new Map<string, string>();
  await debugLog("listExistingMarkdownFiles:iterate:start", { directory });
  await Zotero.File.iterateDirectory(directory, (entry) => {
    if (!entry.isDir && entry.name.endsWith(".md")) {
      names.add(entry.name);
    }
  });
  await debugLog("listExistingMarkdownFiles:iterate:done", {
    directory,
    names: Array.from(names),
  });
  for (const name of names) {
    const path = joinPath(directory, name);
    await debugLog("listExistingMarkdownFiles:read:start", { path });
    const content = await readIfExists(path);
    await debugLog("listExistingMarkdownFiles:read:done", {
      path,
      hasContent: Boolean(content),
    });
    const zoteroUrl = extractZoteroUrl(content);
    if (zoteroUrl) {
      byZoteroUrl.set(zoteroUrl, name);
    }
  }
  return { names, byZoteroUrl };
}

function extractZoteroUrl(content?: string) {
  if (!content) {
    return undefined;
  }
  const match = content.match(/^zotero_(?:url|uri):\s*(.+)$/m);
  if (!match) {
    return undefined;
  }
  const rawValue = match[1].trim();
  if (!rawValue) {
    return undefined;
  }
  if (rawValue.startsWith('"')) {
    try {
      return JSON.parse(rawValue) as string;
    } catch {
      return undefined;
    }
  }
  return rawValue;
}

async function debugLog(message: string, details?: Record<string, unknown>) {
  try {
    const existing = (await readIfExists(DEBUG_LOG_PATH)) || "";
    const line = `${new Date().toISOString()} ${message}${
      details ? ` ${JSON.stringify(details)}` : ""
    }\n`;
    await Zotero.File.putContentsAsync(DEBUG_LOG_PATH, `${existing}${line}`);
  } catch {
    // Best effort only.
  }
}

function showProgress(
  text: string,
  type: "success" | "warning" | "default" = "default",
) {
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text,
      type,
      progress: 100,
    })
    .show();
}
