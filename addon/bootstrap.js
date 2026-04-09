/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;
var BOOTSTRAP_LOG_PATH = "/tmp/obsitero-bootstrap.log";

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  try {
    await writeBootstrapLog("startup:entered");
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "__addonRef__", rootURI + "content/"],
    ]);
    await writeBootstrapLog("startup:chrome-registered");

    const ctx = { rootURI };
    ctx._globalThis = ctx;

    Services.scriptloader.loadSubScript(
      `${rootURI}/content/scripts/__addonRef__.js`,
      ctx,
    );
    await writeBootstrapLog("startup:subscript-loaded");
    await Zotero.__addonInstance__.hooks.onStartup();
    await writeBootstrapLog("startup:hooks-finished");
  } catch (error) {
    await writeBootstrapLog(
      "startup:error " + (error && error.stack ? error.stack : error),
    );
    throw error;
  }
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  await Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {}

async function writeBootstrapLog(message) {
  try {
    let existing = "";
    if (await OS.File.exists(BOOTSTRAP_LOG_PATH)) {
      existing = await OS.File.read(BOOTSTRAP_LOG_PATH, { encoding: "utf-8" });
    }
    const line = `${new Date().toISOString()} ${message}\n`;
    await OS.File.writeAtomic(BOOTSTRAP_LOG_PATH, existing + line, {
      encoding: "utf-8",
      tmpPath: `${BOOTSTRAP_LOG_PATH}.tmp`,
    });
  } catch (e) {
    dump(`bootstrap-log-failed: ${e}\n`);
  }
}
