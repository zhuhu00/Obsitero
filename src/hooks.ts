import { registerPreferencePane } from "./modules/preferencesPane";
import { registerPrefsScripts } from "./modules/preferenceScript";
import {
  registerWindowMenus,
  unregisterWindowMenus,
} from "./modules/windowMenus";
import {
  handleAutoSyncForNotifier,
  syncEnabledCollectionsOnStartup,
} from "./sync/service";
import { readTextIfExists as readTextFileIfExists } from "./utils/filesystem";
import { initLocale } from "./utils/locale";

const HOOKS_LOG_PATH = "/tmp/obsitero-hooks.log";

async function onStartup() {
  try {
    await hooksLog("onStartup:entered");
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);
    await hooksLog("onStartup:promises-resolved");

    initLocale();
    await hooksLog("onStartup:locale-initialized");
    await registerPreferencePane();
    await hooksLog("onStartup:preference-pane-registered");
    registerNotifier();
    await hooksLog("onStartup:notifier-registered");

    for (const win of Zotero.getMainWindows()) {
      await onMainWindowLoad(win);
    }
    await hooksLog("onStartup:windows-loaded", {
      windowCount: Zotero.getMainWindows().length,
    });

    await syncEnabledCollectionsOnStartup();
    await hooksLog("onStartup:startup-sync-finished");

    addon.data.initialized = true;
    await hooksLog("onStartup:initialized");
  } catch (error) {
    await hooksLog("onStartup:error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow) {
  registerWindowMenus(win);
  await hooksLog("onMainWindowLoad", { title: win.document.title });
}

async function onMainWindowUnload(win: Window) {
  unregisterWindowMenus(win);
}

function onShutdown(): void {
  if (addon.data.notifierID) {
    Zotero.Notifier.unregisterObserver(addon.data.notifierID);
  }

  for (const win of addon.data.managedWindowElements.keys()) {
    unregisterWindowMenus(win);
  }

  addon.data.alive = false;
  // @ts-expect-error Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  _extraData: { [key: string]: any },
) {
  await handleAutoSyncForNotifier(event, type, ids);
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  if (type === "load") {
    await registerPrefsScripts(data.window);
  }
}

function registerNotifier() {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: Array<string | number>,
      extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) {
        if (addon.data.notifierID) {
          Zotero.Notifier.unregisterObserver(addon.data.notifierID);
        }
        return;
      }

      await onNotify(event, type, ids, extraData);
    },
  };

  addon.data.notifierID = Zotero.Notifier.registerObserver(callback, [
    "item",
    "collection-item",
    "item-tag",
  ]);
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};

async function hooksLog(message: string, details?: Record<string, unknown>) {
  try {
    const existing = (await readTextFileIfExists(HOOKS_LOG_PATH)) || "";
    const line = `${new Date().toISOString()} ${message}${
      details ? ` ${JSON.stringify(details)}` : ""
    }\n`;
    await Zotero.File.putContentsAsync(HOOKS_LOG_PATH, `${existing}${line}`);
  } catch {
    // Best effort only.
  }
}
