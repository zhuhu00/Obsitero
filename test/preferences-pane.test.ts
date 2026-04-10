import { assert } from "chai";
import { config } from "../package.json";
import { savePreferences } from "../src/modules/preferenceScript";
import { DEFAULT_SYNC_FIELDS } from "../src/sync/markdown";

describe("preferences pane", function () {
  it("persists the current UI values when save is triggered", function () {
    const prefKey = (key: string) => `${config.prefsPrefix}.${key}`;
    const originalPrefs = {
      vaultPath: Zotero.Prefs.get(prefKey("vaultPath"), true),
      outputFolder: Zotero.Prefs.get(prefKey("outputFolder"), true),
      syncOnModify: Zotero.Prefs.get(prefKey("syncOnModify"), true),
      createDataviewIndex: Zotero.Prefs.get(
        prefKey("createDataviewIndex"),
        true,
      ),
      fileNameStrategy: Zotero.Prefs.get(prefKey("fileNameStrategy"), true),
      selectedFields: Zotero.Prefs.get(prefKey("selectedFields"), true),
      collectionSyncConfigs: Zotero.Prefs.get(
        prefKey("collectionSyncConfigs"),
        true,
      ),
    };

    try {
      const document = Zotero.getMainWindows()[0].document.implementation.createHTMLDocument(
        "Obsitero Preferences",
      );

      for (const [suffix, tagName, type] of [
        ["vault-path", "input", "text"],
        ["output-folder", "input", "text"],
        ["sync-on-modify", "input", "checkbox"],
        ["create-index", "input", "checkbox"],
        ["file-name-strategy", "select", ""],
        ["fields-container", "div", ""],
        ["collections-container", "div", ""],
      ] as const) {
        const element = document.createElement(tagName);
        element.id = `zotero-prefpane-${config.addonRef}-${suffix}`;
        if (type && element instanceof HTMLInputElement) {
          element.type = type;
        }
        document.body.append(element);
      }

      const vaultPath = document.getElementById(
        `zotero-prefpane-${config.addonRef}-vault-path`,
      ) as HTMLInputElement;
      const outputFolder = document.getElementById(
        `zotero-prefpane-${config.addonRef}-output-folder`,
      ) as HTMLInputElement;
      const syncOnModify = document.getElementById(
        `zotero-prefpane-${config.addonRef}-sync-on-modify`,
      ) as HTMLInputElement;
      const createIndex = document.getElementById(
        `zotero-prefpane-${config.addonRef}-create-index`,
      ) as HTMLInputElement;
      const fileNameStrategy = document.getElementById(
        `zotero-prefpane-${config.addonRef}-file-name-strategy`,
      ) as HTMLSelectElement;
      const fieldsContainer = document.getElementById(
        `zotero-prefpane-${config.addonRef}-fields-container`,
      ) as HTMLDivElement;

      for (const strategy of ["title", "citationKey"]) {
        const option = document.createElement("option");
        option.value = strategy;
        option.textContent = strategy;
        fileNameStrategy.append(option);
      }

      for (const [field, checked] of [
        ["authors", true],
        ["year", true],
        ["publication", false],
      ] as const) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.field = field;
        checkbox.checked = checked;
        fieldsContainer.append(checkbox);
      }

      vaultPath.value = "/tmp/obsitero-save-test";
      outputFolder.value = "Zotero-saved";
      syncOnModify.checked = true;
      createIndex.checked = false;
      fileNameStrategy.value = "citationKey";

      savePreferences(document);

      assert.equal(
        Zotero.Prefs.get(prefKey("vaultPath"), true),
        "/tmp/obsitero-save-test",
      );
      assert.equal(
        Zotero.Prefs.get(prefKey("outputFolder"), true),
        "Zotero-saved",
      );
      assert.equal(Zotero.Prefs.get(prefKey("syncOnModify"), true), true);
      assert.equal(Zotero.Prefs.get(prefKey("createDataviewIndex"), true), false);
      assert.equal(
        Zotero.Prefs.get(prefKey("fileNameStrategy"), true),
        "citationKey",
      );
      assert.equal(
        Zotero.Prefs.get(prefKey("selectedFields"), true),
        '["authors","year"]',
      );
      assert.equal(
        Zotero.Prefs.get(prefKey("collectionSyncConfigs"), true),
        "{}",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.stack || error.message
          : JSON.stringify(error);
      assert.fail(`preferences pane test failed: ${message}`);
    } finally {
      Zotero.Prefs.set(prefKey("vaultPath"), originalPrefs.vaultPath, true);
      Zotero.Prefs.set(prefKey("outputFolder"), originalPrefs.outputFolder, true);
      Zotero.Prefs.set(prefKey("syncOnModify"), originalPrefs.syncOnModify, true);
      Zotero.Prefs.set(
        prefKey("createDataviewIndex"),
        originalPrefs.createDataviewIndex,
        true,
      );
      Zotero.Prefs.set(
        prefKey("fileNameStrategy"),
        originalPrefs.fileNameStrategy,
        true,
      );
      Zotero.Prefs.set(
        prefKey("selectedFields"),
        originalPrefs.selectedFields,
        true,
      );
      Zotero.Prefs.set(
        prefKey("collectionSyncConfigs"),
        originalPrefs.collectionSyncConfigs,
        true,
      );
    }
  });

  it("falls back to the default fields when no frontmatter field is selected", function () {
    const prefKey = (key: string) => `${config.prefsPrefix}.${key}`;
    const originalSelectedFields = Zotero.Prefs.get(prefKey("selectedFields"), true);

    try {
      const document = Zotero.getMainWindows()[0].document.implementation.createHTMLDocument(
        "Obsitero Preferences",
      );

      for (const [suffix, tagName, type] of [
        ["vault-path", "input", "text"],
        ["output-folder", "input", "text"],
        ["sync-on-modify", "input", "checkbox"],
        ["create-index", "input", "checkbox"],
        ["file-name-strategy", "select", ""],
        ["fields-container", "div", ""],
        ["collections-container", "div", ""],
      ] as const) {
        const element = document.createElement(tagName);
        element.id = `zotero-prefpane-${config.addonRef}-${suffix}`;
        if (type && element instanceof HTMLInputElement) {
          element.type = type;
        }
        document.body.append(element);
      }

      const fileNameStrategy = document.getElementById(
        `zotero-prefpane-${config.addonRef}-file-name-strategy`,
      ) as HTMLSelectElement;
      const fieldsContainer = document.getElementById(
        `zotero-prefpane-${config.addonRef}-fields-container`,
      ) as HTMLDivElement;

      for (const strategy of ["title", "citationKey"]) {
        const option = document.createElement("option");
        option.value = strategy;
        option.textContent = strategy;
        fileNameStrategy.append(option);
      }

      for (const field of ["authors", "year", "publication"] as const) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.field = field;
        checkbox.checked = false;
        fieldsContainer.append(checkbox);
      }

      savePreferences(document);

      assert.equal(
        Zotero.Prefs.get(prefKey("selectedFields"), true),
        JSON.stringify(DEFAULT_SYNC_FIELDS),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.stack || error.message
          : JSON.stringify(error);
      assert.fail(`preferences pane default field fallback test failed: ${message}`);
    } finally {
      Zotero.Prefs.set(prefKey("selectedFields"), originalSelectedFields, true);
    }
  });
});
