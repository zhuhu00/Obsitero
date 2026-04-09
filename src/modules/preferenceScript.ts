import { config } from "../../package.json";
import {
  buildCollectionFullName,
  getAllCollections,
} from "../sync/collections";
import {
  FILE_NAME_STRATEGIES,
  SYNCABLE_FIELDS,
  isSyncField,
  loadCollectionSyncConfigs,
  loadSelectedFields,
  saveCollectionSyncConfigs,
  saveSelectedFields,
} from "../sync/config";
import { getPref, setPref } from "../utils/prefs";

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
    const label = document.createElement("label");
    label.className = "checkbox-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedFields.has(field);
    checkbox.dataset.field = field;

    const text = document.createElement("span");
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
    const row = document.createElement("label");
    row.className = "checkbox-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(configs[collection.id]?.syncEnabled);
    checkbox.dataset.collectionId = String(collection.id);

    const text = document.createElement("span");
    text.textContent = buildCollectionFullName(collection);

    row.append(checkbox, text);
    container.append(row);
  }
}

function bindPrefEvents(window: Window) {
  const { document } = window;

  getInput(document, "vault-path").onchange = (event) => {
    setPref("vaultPath", (event.target as HTMLInputElement).value.trim());
  };

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
    setPref("vaultPath", selectedPath);
  };

  getInput(document, "output-folder").onchange = (event) => {
    setPref("outputFolder", (event.target as HTMLInputElement).value.trim());
  };

  getCheckbox(document, "sync-on-modify").onchange = (event) => {
    setPref("syncOnModify", (event.target as HTMLInputElement).checked);
  };

  getCheckbox(document, "create-index").onchange = (event) => {
    setPref("createDataviewIndex", (event.target as HTMLInputElement).checked);
  };

  getSelect(document, "file-name-strategy").onchange = (event) => {
    setPref(
      "fileNameStrategy",
      (event.target as HTMLSelectElement).value as
        | "title"
        | "citationKey"
        | "itemKey"
        | "authorYearTitle",
    );
  };

  getContainer(document, "fields-container").onchange = () => {
    const selectedFields = Array.from(
      getContainer(document, "fields-container").querySelectorAll(
        "input[type='checkbox'][data-field]:checked",
      ),
    )
      .filter(
        (input): input is HTMLInputElement => input instanceof HTMLInputElement,
      )
      .map((input) => input.dataset.field!)
      .filter(isSyncField);
    saveSelectedFields(selectedFields);
  };

  getContainer(document, "collections-container").onchange = () => {
    const configs = loadCollectionSyncConfigs();

    for (const input of Array.from(
      getContainer(document, "collections-container").querySelectorAll(
        "input[type='checkbox'][data-collection-id]",
      ),
    ).filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement,
    )) {
      const collectionID = Number(input.dataset.collectionId);
      if (collectionID > 0) {
        configs[collectionID] = { syncEnabled: input.checked };
      }
    }

    saveCollectionSyncConfigs(configs);
  };

  const fileNameSelect = getSelect(document, "file-name-strategy");
  fileNameSelect.replaceChildren(
    ...FILE_NAME_STRATEGIES.map((strategy) => {
      const option = document.createElement("option");
      option.value = strategy;
      option.textContent = strategy;
      return option;
    }),
  );
  fileNameSelect.value = getPref("fileNameStrategy") || "title";
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
