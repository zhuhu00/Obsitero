import { assert } from "chai";
import { config } from "../package.json";
import { pathExists, readTextIfExists } from "../src/utils/filesystem";

const VAULT_PATH = "/tmp/obsitero-test-vault";
const OUTPUT_FOLDER = "Zotero-dev-test";
const OUTPUT_DIRECTORY = `${VAULT_PATH}/${OUTPUT_FOLDER}`;
const BASE_PATH = `${OUTPUT_DIRECTORY}/Zotero.base`;
const LEGACY_ROOT_BASE_PATH = `${VAULT_PATH}/Zotero.base`;
const LEGACY_BASES_PATH = `${VAULT_PATH}/Bases/Zotero.base`;
const LEGACY_TEMPLATE_BASES_PATH = `${VAULT_PATH}/Templates/Bases/Zotero.base`;
const LEGACY_SPACED_LIBRARY_NOTE_PATH = `${VAULT_PATH}/Zotero 论文集.md`;
const LIBRARY_NOTE_PATH = `${VAULT_PATH}/Zotero论文集.md`;
const LEGACY_INDEX_PATH = `${OUTPUT_DIRECTORY}/_Index.md`;
const TEST_LOG_PATH = "/tmp/obsidian-sync-test.log";

describe("obsidian sync", function () {
  it("syncs generated Zotero items into the Obsidian folder", async function () {
    this.timeout(60000);
    try {
      await logTestStep("start");
      const { collection, items } = await createFixtureCollection();
      const itemIDs = items.map((item) => item.id);
      await logTestStep("fixture-created", {
        collectionID: collection.id,
        itemIDs,
      });
      Zotero.Items.unload(itemIDs);
      await logTestStep("fixture-items-unloaded");

      Zotero.Prefs.set(`${config.prefsPrefix}.vaultPath`, VAULT_PATH, true);
      Zotero.Prefs.set(
        `${config.prefsPrefix}.outputFolder`,
        OUTPUT_FOLDER,
        true,
      );
      Zotero.Prefs.set(`${config.prefsPrefix}.syncOnModify`, false, true);
      Zotero.Prefs.set(`${config.prefsPrefix}.createDataviewIndex`, true, true);
      Zotero.Prefs.set(`${config.prefsPrefix}.fileNameStrategy`, "title", true);
      Zotero.Prefs.set(
        `${config.prefsPrefix}.selectedFields`,
        '["authors","publication","tags","zotero_url","link"]',
        true,
      );
      Zotero.Prefs.set(
        `${config.prefsPrefix}.collectionSyncConfigs`,
        JSON.stringify({ [collection.id]: { syncEnabled: true } }),
        true,
      );
      await logTestStep("prefs-set");

      await Zotero.File.createDirectoryIfMissingAsync(VAULT_PATH);
      await Zotero.File.removeIfExists(BASE_PATH);
      await Zotero.File.removeIfExists(LEGACY_ROOT_BASE_PATH);
      await Zotero.File.removeIfExists(LEGACY_BASES_PATH);
      await Zotero.File.removeIfExists(LEGACY_TEMPLATE_BASES_PATH);
      await Zotero.File.removeIfExists(LEGACY_SPACED_LIBRARY_NOTE_PATH);
      await Zotero.File.removeIfExists(LIBRARY_NOTE_PATH);
      await removeMarkdownFilesInDirectory(OUTPUT_DIRECTORY);
      await Zotero.File.putContentsAsync(LEGACY_INDEX_PATH, "legacy");
      await Zotero.File.putContentsAsync(LEGACY_ROOT_BASE_PATH, "legacy-root-base");
      await Zotero.File.createDirectoryIfMissingAsync(`${VAULT_PATH}/Templates`);
      await Zotero.File.createDirectoryIfMissingAsync(`${VAULT_PATH}/Templates/Bases`);
      await Zotero.File.putContentsAsync(
        LEGACY_TEMPLATE_BASES_PATH,
        "legacy-template-base",
      );
      await Zotero.File.putContentsAsync(
        LEGACY_SPACED_LIBRARY_NOTE_PATH,
        "![[Zotero.base]]\n",
      );
      await Zotero.File.putContentsAsync(
        LIBRARY_NOTE_PATH,
        "![[Zotero/Zotero.base]]\n",
      );
      await logTestStep("output-cleared");

      // @ts-expect-error plugin instance is attached dynamically
      const plugin = Zotero[config.addonInstance];
      assert.isOk(plugin, "plugin instance missing");
      assert.isFunction(plugin.api.syncCollectionByID, "sync api missing");
      await logTestStep("plugin-found");

      await plugin.api.syncItemsByIDs(itemIDs);
      await logTestStep("sync-finished");

      assert.isTrue(await pathExists(BASE_PATH), "base file missing");
      assert.isFalse(
        await pathExists(LEGACY_ROOT_BASE_PATH),
        "legacy root base remained",
      );
      assert.isFalse(
        await pathExists(LEGACY_BASES_PATH),
        "legacy bases folder base remained",
      );
      assert.isFalse(
        await pathExists(LEGACY_TEMPLATE_BASES_PATH),
        "legacy template bases base remained",
      );
      assert.isTrue(
        await pathExists(LEGACY_SPACED_LIBRARY_NOTE_PATH),
        "manual spaced library note should be preserved",
      );
      assert.equal(
        await readTextIfExists(LEGACY_SPACED_LIBRARY_NOTE_PATH),
        "![[Zotero.base]]\n",
      );
      assert.isTrue(
        await pathExists(LIBRARY_NOTE_PATH),
        "manual library note should be preserved",
      );
      assert.equal(
        await readTextIfExists(LIBRARY_NOTE_PATH),
        "![[Zotero/Zotero.base]]\n",
      );
      assert.isFalse(await pathExists(LEGACY_INDEX_PATH), "legacy index remained");
      const baseContents = await Zotero.File.getContentsAsync(BASE_PATH);
      assert.isString(baseContents);
      assert.include(baseContents as string, "filters:");
      assert.include(baseContents as string, `- 'file.inFolder(\"${OUTPUT_FOLDER}\")'`);
      assert.include(baseContents as string, '- \'file.ext == "md"\'');
      assert.include(baseContents as string, "properties:");
      assert.include(baseContents as string, "formula.title_link:");
      assert.include(baseContents as string, 'displayName: "Title"');
      assert.include(baseContents as string, "authors_short:");
      assert.include(baseContents as string, 'displayName: "Authors"');
      assert.include(baseContents as string, "views:");
      assert.include(baseContents as string, '- type: table');
      assert.include(baseContents as string, 'name: "Library"');
      assert.include(
        baseContents as string,
        'title_link: \'if(file.name, link(file.name, display_title), "")\'',
      );
      assert.include(baseContents as string, "- formula.title_link");
      assert.include(baseContents as string, "- note.authors_short");
      assert.include(baseContents as string, "- note.publication");
      assert.include(baseContents as string, "- note.tags");
      assert.include(baseContents as string, "formulas:");
      assert.include(baseContents as string, 'url_link: \'if(link, link(link, "link"), "")\'');
      assert.include(baseContents as string, 'zotero_link: \'if(zotero_url, link(zotero_url, "zotero"), "")\'');
      assert.include(baseContents as string, "- formula.url_link");
      assert.include(baseContents as string, "- formula.zotero_link");

      const allMarkdown = await listMarkdownFiles(OUTPUT_DIRECTORY);
      const syncedPages = allMarkdown.filter(
        (path) => !path.endsWith("/_Index.md") && !path.endsWith("/Zotero.base"),
      );
      assert.lengthOf(syncedPages, items.length);
      assert.includeMembers(syncedPages, [
        `${OUTPUT_DIRECTORY}/Test Paper Alpha.md`,
        `${OUTPUT_DIRECTORY}/Test Paper Beta.md`,
      ]);

      const pageContents = await Promise.all(
        syncedPages.map((path) => Zotero.File.getContentsAsync(path)),
      );
      assert.isTrue(
        pageContents.every((content) => typeof content === "string"),
      );
      assert.isTrue(
        pageContents.every((content) =>
          (content as string).includes("## My Notes"),
        ),
      );
      assert.isTrue(
        pageContents.every(
          (content) =>
            (content as string).includes("cssclasses:") &&
            (content as string).includes('  - "zotero-paper"'),
        ),
      );
      assert.isTrue(
        pageContents.every((content) => !/^title:/m.test(content as string)),
      );
      assert.isTrue(
        pageContents.every((content) =>
          (content as string).includes("last_synced_at:"),
        ),
      );
      assert.isTrue(
        pageContents.every((content) =>
          (content as string).includes("authors_short:"),
        ),
      );
      assert.isTrue(
        pageContents.every((content) =>
          (content as string).includes("display_title:"),
        ),
      );
      assert.isTrue(
        pageContents.every(
          (content) =>
            (content as string).indexOf("authors_short:") <
            (content as string).indexOf("last_synced_at:"),
        ),
      );
      assert.isTrue(
        pageContents.every(
          (content) =>
            (content as string).includes("code:") &&
            (content as string).includes("page:"),
        ),
      );
      assert.isTrue(
        pageContents.every(
          (content) =>
            !(content as string).includes('  - "vision"') &&
            !(content as string).includes('  - "robotics"') &&
            !(content as string).includes('  - "/unread"') &&
            !(content as string).includes('  - "/reading"') &&
            !(content as string).includes('status: "Unread"') &&
            !(content as string).includes('status: "Reading"'),
        ),
      );
      assert.isTrue(
        pageContents.some((content) =>
          (content as string).includes('  - "Unread"'),
        ),
      );
      assert.isTrue(
        pageContents.some((content) =>
          (content as string).includes('  - "Reading"'),
        ),
      );
      const alphaContent = pageContents.find((content) =>
        (content as string).includes('display_title: "Test Paper Alpha"'),
      ) as string | undefined;
      assert.isString(alphaContent);
      assert.include(alphaContent as string, "## My Notes");
      assert.include(alphaContent as string, "## Zotero Notes");
      assert.include(alphaContent as string, "Alpha AI summary");
      assert.include(alphaContent as string, "Alpha comment");
      assert.isTrue(
        (alphaContent as string).indexOf("## My Notes") <
          (alphaContent as string).indexOf("## Zotero Notes"),
      );
      await logTestStep("assertions-finished");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.stack || error.message
          : JSON.stringify(error);
      assert.fail(`obsidian sync integration failed: ${message}`);
    }
  });

  it("does not sync when the output folder preference is blank", async function () {
    this.timeout(60000);
    try {
      const { items } = await createFixtureCollection();
      const itemIDs = items.map((item) => item.id);

      Zotero.Prefs.set(`${config.prefsPrefix}.vaultPath`, VAULT_PATH, true);
      Zotero.Prefs.set(`${config.prefsPrefix}.outputFolder`, "", true);
      Zotero.Prefs.set(`${config.prefsPrefix}.syncOnModify`, false, true);
      Zotero.Prefs.set(`${config.prefsPrefix}.createDataviewIndex`, true, true);

      await removeMarkdownFilesInDirectory(OUTPUT_DIRECTORY);
      await Zotero.File.removeIfExists(BASE_PATH);

      // @ts-expect-error plugin instance is attached dynamically
      const plugin = Zotero[config.addonInstance];
      assert.isOk(plugin, "plugin instance missing");

      const result = await plugin.api.syncItemsByIDs(itemIDs);

      assert.deepInclude(result, { syncedCount: 0 });
      assert.isFalse(await pathExists(BASE_PATH), "base file should not exist");
      assert.isFalse(
        await pathExists(`${VAULT_PATH}/Test Paper Alpha.md`),
        "paper markdown should not be written to vault root",
      );
      assert.isFalse(
        await pathExists(`${VAULT_PATH}/Test Paper Beta.md`),
        "paper markdown should not be written to vault root",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.stack || error.message
          : JSON.stringify(error);
      assert.fail(`blank output folder integration failed: ${message}`);
    }
  });
});

async function listMarkdownFiles(directory: string) {
  const markdownPaths: string[] = [];
  if (!(await pathExists(directory))) {
    return markdownPaths;
  }
  await Zotero.File.iterateDirectory(directory, (entry) => {
    if (!entry.isDir && entry.name.endsWith(".md")) {
      markdownPaths.push(entry.path);
    }
  });
  return markdownPaths;
}

async function removeMarkdownFilesInDirectory(directory: string) {
  if (!(await pathExists(directory))) {
    return;
  }
  const markdownFiles = await listMarkdownFiles(directory);
  for (const path of markdownFiles) {
    await Zotero.File.removeIfExists(path);
  }
}

async function createFixtureCollection() {
  await logTestStep("createFixtureCollection:start");
  const collection = new Zotero.Collection({
    name: `Obsidian Sync Test ${Date.now()}`,
    libraryID: Zotero.Libraries.userLibraryID,
  });
  await collection.saveTx();
  await logTestStep("createFixtureCollection:collection-saved", {
    collectionID: collection.id,
  });

  const itemA = new Zotero.Item("journalArticle");
  itemA.libraryID = Zotero.Libraries.userLibraryID;
  itemA.setField("title", "Test Paper Alpha");
  itemA.setField("date", "2025");
  itemA.setField("publicationTitle", "TestConf");
  itemA.setField("DOI", "10.1000/alpha");
  itemA.setField("url", "https://example.com/alpha");
  itemA.setField("extra", "Citation Key: alpha2025");
  itemA.setCreators([
    {
      creatorType: "author",
      firstName: "Ada",
      lastName: "Lovelace",
    },
  ]);
  itemA.addTag("vision");
  itemA.addTag("/unread");
  itemA.addToCollection(collection.id);
  await itemA.saveTx();
  await logTestStep("createFixtureCollection:item-a-saved", {
    itemID: itemA.id,
  });

  const aiNote = new Zotero.Item("note");
  aiNote.libraryID = Zotero.Libraries.userLibraryID;
  aiNote.parentID = itemA.id;
  aiNote.setNote("<p>Alpha AI summary</p>");
  await aiNote.saveTx();

  const commentNote = new Zotero.Item("note");
  commentNote.libraryID = Zotero.Libraries.userLibraryID;
  commentNote.parentID = itemA.id;
  commentNote.setNote("<p>Alpha comment</p>");
  await commentNote.saveTx();

  const itemB = new Zotero.Item("conferencePaper");
  itemB.libraryID = Zotero.Libraries.userLibraryID;
  itemB.setField("title", "Test Paper Beta");
  itemB.setField("date", "2024");
  itemB.setField("proceedingsTitle", "ICLR");
  itemB.setField("url", "https://example.com/beta");
  itemB.setField("extra", "Citation Key: beta2024");
  itemB.setCreators([
    {
      creatorType: "author",
      firstName: "Grace",
      lastName: "Hopper",
    },
  ]);
  itemB.addTag("robotics");
  itemB.addTag("/reading");
  itemB.addToCollection(collection.id);
  await itemB.saveTx();
  await logTestStep("createFixtureCollection:item-b-saved", {
    itemID: itemB.id,
  });

  return { collection, items: [itemA, itemB] };
}

async function logTestStep(step: string, data?: Record<string, unknown>) {
  const existing = (await readIfExists(TEST_LOG_PATH)) || "";
  const line = `${new Date().toISOString()} ${step}${
    data ? ` ${JSON.stringify(data)}` : ""
  }\n`;
  await Zotero.File.putContentsAsync(TEST_LOG_PATH, `${existing}${line}`);
}

async function readIfExists(path: string) {
  return readTextIfExists(path);
}
