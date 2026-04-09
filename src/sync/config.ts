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

export function loadSelectedFields(): SyncField[] {
  const raw = Zotero.Prefs.get(
    `${addon.data.config.prefsPrefix}.selectedFields`,
    true,
  );

  if (typeof raw !== "string" || !raw.trim()) {
    return [...DEFAULT_SYNC_FIELDS];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_SYNC_FIELDS];
    }
    const selected = parsed
      .map(normalizeField)
      .filter((field): field is SyncField => Boolean(field));
    return selected.length ? selected : [...DEFAULT_SYNC_FIELDS];
  } catch {
    return [...DEFAULT_SYNC_FIELDS];
  }
}

export function saveSelectedFields(fields: SyncField[]) {
  return Zotero.Prefs.set(
    `${addon.data.config.prefsPrefix}.selectedFields`,
    JSON.stringify(fields),
    true,
  );
}

export function loadCollectionSyncConfigs(): CollectionSyncConfigs {
  const raw = Zotero.Prefs.get(
    `${addon.data.config.prefsPrefix}.collectionSyncConfigs`,
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
    `${addon.data.config.prefsPrefix}.collectionSyncConfigs`,
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

function normalizeField(value: unknown): SyncField | undefined {
  if (value === "zotero_uri") {
    return "zotero_url";
  }
  if (value === "status") {
    return "tags";
  }
  if (value === "doi" || value === "url") {
    return "link";
  }
  return isSyncField(value) ? value : undefined;
}
