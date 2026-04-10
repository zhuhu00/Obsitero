import { config } from "../../package.json";
import {
  buildCollectionFullName,
  getAllCollections,
} from "../sync/collections";
import {
  type CollectionSyncConfigs,
  FILE_NAME_STRATEGIES,
  SYNCABLE_FIELDS,
  isSyncField,
  loadCollectionSyncConfigs,
  loadSelectedFields,
  saveCollectionSyncConfigs,
  saveSelectedFields,
} from "../sync/config";
import { getPref, setPref } from "../utils/prefs";
import { getString } from "../utils/locale";

export async function registerPrefsScripts(window: Window) {
  addon.data.prefs = { window };

  renderStaticValues(window.document);
  renderFieldCheckboxes(window.document);
  renderCollectionCheckboxes(window.document);
  bindPrefEvents(window);
}

function renderStaticValues(document: Document) {
  getInput(document, "vault-path").value = getPref("vaultPath") || "";
  getInput(document, "output-folder").value =
    getPref("outputFolder") || "Zotero";
  getCheckbox(document, "sync-on-modify").checked = Boolean(
    getPref("syncOnModify"),
  );
  getCheckbox(document, "create-index").checked = Boolean(
    getPref("createDataviewIndex"),
  );
  getSelect(document, "file-name-strategy").value =
    getPref("fileNameStrategy") || "title";
}

function renderFieldCheckboxes(document: Document) {
  const selectedFields = new Set(loadSelectedFields());
  const container = getContainer(document, "fields-container");
  container.replaceChildren();

  for (const field of SYNCABLE_FIELDS) {
    const label = createHTMLElement(document, "label");
    label.className = "checkbox-row";

    const checkbox = createHTMLElement(document, "input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedFields.has(field);
    checkbox.dataset.field = field;

    const text = createHTMLElement(document, "span");
    text.textContent = field;

    label.append(checkbox, text);
    container.append(label);
  }
}

function renderCollectionCheckboxes(document: Document) {
  const configs = loadCollectionSyncConfigs();
  const container = getContainer(document, "collections-container");
  container.replaceChildren();

  for (const collection of getAllCollections()) {
    const row = createHTMLElement(document, "label");
    row.className = "checkbox-row";

    const checkbox = createHTMLElement(document, "input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(configs[collection.id]?.syncEnabled);
    checkbox.dataset.collectionId = String(collection.id);

    const text = createHTMLElement(document, "span");
    text.textContent = buildCollectionFullName(collection);

    row.append(checkbox, text);
    container.append(row);
  }
}

function bindPrefEvents(window: Window) {
  const { document } = window;

  getButton(document, "vault-browse").onclick = async () => {
    const selectedPath = await new ztoolkit.FilePicker(
      "Select Obsidian Vault",
      "folder",
    ).open();

    if (!selectedPath) {
      return;
    }

    const input = getInput(document, "vault-path");
    input.value = selectedPath;
  };

  getButton(document, "save").onclick = () => {
    savePreferences(document);
    showSaveSuccess();
  };

  const fileNameSelect = getSelect(document, "file-name-strategy");
  fileNameSelect.replaceChildren(
    ...FILE_NAME_STRATEGIES.map((strategy) => {
      const option = createHTMLElement(document, "option");
      option.value = strategy;
      option.textContent = strategy;
      return option;
    }),
  );
  fileNameSelect.value = getPref("fileNameStrategy") || "title";
}

export function savePreferences(document: Document) {
  setPref("vaultPath", getInput(document, "vault-path").value.trim());
  setPref("outputFolder", getInput(document, "output-folder").value.trim());
  setPref("syncOnModify", getCheckbox(document, "sync-on-modify").checked);
  setPref("createDataviewIndex", getCheckbox(document, "create-index").checked);
  setPref(
    "fileNameStrategy",
    getSelect(document, "file-name-strategy").value as
      | "title"
      | "citationKey"
      | "itemKey"
      | "authorYearTitle",
  );
  saveSelectedFields(readSelectedFields(document));
  saveCollectionSyncConfigs(readCollectionSyncConfigs(document));
}

function readSelectedFields(document: Document) {
  return (
    Array.from(
      getContainer(document, "fields-container").querySelectorAll(
        "input[type='checkbox'][data-field]:checked",
      ),
    ) as HTMLInputElement[]
  )
    .map((input) => input.getAttribute("data-field") || "")
    .filter(isSyncField);
}

function readCollectionSyncConfigs(document: Document): CollectionSyncConfigs {
  const configs: CollectionSyncConfigs = {};

  for (const input of Array.from(
    getContainer(document, "collections-container").querySelectorAll(
      "input[type='checkbox'][data-collection-id]",
    ),
  ) as HTMLInputElement[]) {
    const collectionID = Number(input.getAttribute("data-collection-id"));
    if (collectionID > 0) {
      configs[collectionID] = { syncEnabled: Boolean(input.checked) };
    }
  }

  return configs;
}

function showSaveSuccess() {
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text: getString("pref-save-success"),
      type: "success",
      progress: 100,
    })
    .show();
}

function getElement(document: Document, suffix: string) {
  return document.getElementById(
    `zotero-prefpane-${config.addonRef}-${suffix}`,
  );
}

function getInput(document: Document, suffix: string) {
  return getElement(document, suffix) as HTMLInputElement;
}

function getCheckbox(document: Document, suffix: string) {
  return getElement(document, suffix) as HTMLInputElement;
}

function getSelect(document: Document, suffix: string) {
  return getElement(document, suffix) as HTMLSelectElement;
}

function getButton(document: Document, suffix: string) {
  return getElement(document, suffix) as HTMLButtonElement;
}

function getContainer(document: Document, suffix: string) {
  return getElement(document, suffix) as HTMLDivElement;
}

function createHTMLElement<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tagName: K,
) {
  return document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tagName,
  ) as HTMLElementTagNameMap[K];
}
