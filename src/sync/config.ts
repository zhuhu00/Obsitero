import { config } from "../../package.json";
import {
  ALL_SYNC_FIELDS,
  DEFAULT_SYNC_FIELDS,
  type FileNameStrategy,
  type SyncField,
} from "./markdown";

export type CollectionSyncConfig = {
  syncEnabled: boolean;
};

export type CollectionSyncConfigs = Record<number, CollectionSyncConfig>;

export const SYNCABLE_FIELDS = [...ALL_SYNC_FIELDS];

export const FILE_NAME_STRATEGIES: FileNameStrategy[] = [
  "title",
  "citationKey",
  "itemKey",
  "authorYearTitle",
];

export const DEFAULT_OUTPUT_FOLDER = "Zotero";

export const DEFAULT_FILE_NAME_STRATEGY: FileNameStrategy = "title";
const LEGACY_DEFAULT_SYNC_FIELDS = [
  "authors",
  "publication",
  "tags",
  "link",
  "pdf",
  "zotero_url",
];

export function loadSelectedFields(): SyncField[] {
  const raw = Zotero.Prefs.get(`${config.prefsPrefix}.selectedFields`, true);

  if (typeof raw !== "string" || !raw.trim()) {
    return [...DEFAULT_SYNC_FIELDS];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_SYNC_FIELDS];
    }
    const selected = parsed
      .map((value) => normalizeField(value, parsed))
      .filter((field): field is SyncField => Boolean(field));
    if (!selected.length) {
      return [...DEFAULT_SYNC_FIELDS];
    }
    if (isLegacyDefaultFieldSelection(selected)) {
      return [...DEFAULT_SYNC_FIELDS];
    }
    return selected;
  } catch {
    return [...DEFAULT_SYNC_FIELDS];
  }
}

export function saveSelectedFields(fields: SyncField[]) {
  const persistedFields = fields.length ? fields : DEFAULT_SYNC_FIELDS;
  return Zotero.Prefs.set(
    `${config.prefsPrefix}.selectedFields`,
    JSON.stringify(persistedFields),
    true,
  );
}

export function loadCollectionSyncConfigs(): CollectionSyncConfigs {
  const raw = Zotero.Prefs.get(
    `${config.prefsPrefix}.collectionSyncConfigs`,
    true,
  );

  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.entries(parsed).reduce<CollectionSyncConfigs>(
      (configs, [collectionID, value]) => {
        const numericID = Number(collectionID);
        if (
          Number.isInteger(numericID) &&
          numericID > 0 &&
          value &&
          typeof value === "object" &&
          "syncEnabled" in value
        ) {
          configs[numericID] = {
            syncEnabled: Boolean(
              (value as CollectionSyncConfig | { syncEnabled?: unknown })
                .syncEnabled,
            ),
          };
        }
        return configs;
      },
      {},
    );
  } catch {
    return {};
  }
}

export function saveCollectionSyncConfigs(configs: CollectionSyncConfigs) {
  return Zotero.Prefs.set(
    `${config.prefsPrefix}.collectionSyncConfigs`,
    JSON.stringify(configs),
    true,
  );
}

export function loadSyncedCollectionIDs() {
  return new Set(
    Object.entries(loadCollectionSyncConfigs())
      .filter(([, config]) => config.syncEnabled)
      .map(([id]) => Number(id)),
  );
}

export function isSyncField(value: unknown): value is SyncField {
  return (
    typeof value === "string" && SYNCABLE_FIELDS.includes(value as SyncField)
  );
}

function normalizeField(
  value: unknown,
  allValues: unknown[],
): SyncField | undefined {
  if (isLegacySelection(allValues)) {
    if (value === "status") {
      return "tags";
    }
    if (value === "zotero_uri" || value === "zotero_url") {
      return undefined;
    }
    if (value === "doi" || value === "url" || value === "link") {
      return "pdf";
    }
    if (value === "pdf") {
      return "local_file";
    }
  }
  if (value === "status") {
    return "tags";
  }
  if (value === "doi" || value === "url" || value === "link") {
    return "pdf";
  }
  return isSyncField(value) ? value : undefined;
}

function isLegacyDefaultFieldSelection(fields: SyncField[]) {
  if (fields.length !== LEGACY_DEFAULT_SYNC_FIELDS.length) {
    return false;
  }

  return LEGACY_DEFAULT_SYNC_FIELDS.every(
    (field, index) => fields[index] === field,
  );
}

function isLegacySelection(values: unknown[]) {
  return values.some((value) =>
    ["link", "zotero_url", "zotero_uri"].includes(String(value)),
  );
}
