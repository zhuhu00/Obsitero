import { config } from "../package.json";
import hooks from "./hooks";
import {
  syncCollectionToObsidian,
  syncEnabledCollectionsOnStartup,
  syncItemsByIDs,
  syncItemsToObsidian,
} from "./sync/service";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    // Env type, see build.js
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
    };
    preferencePaneID?: string;
    notifierID?: string;
    managedWindowElements: Map<Window, Set<Element>>;
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
      managedWindowElements: new Map(),
    };
    this.hooks = hooks;
    this.api = {
      syncCollectionByID: async (collectionID: number) => {
        const collection = Zotero.Collections.get(collectionID);
        if (!collection) {
          throw new Error(`Collection ${collectionID} not found`);
        }
        return syncCollectionToObsidian(collection);
      },
      syncItemsByIDs,
      syncSelectedCollection: async () => {
        const collection =
          Zotero.getActiveZoteroPane()?.getSelectedCollection(false);
        if (!collection) {
          throw new Error("No collection selected");
        }
        return syncCollectionToObsidian(collection);
      },
      syncSelectedItems: async () => {
        const items =
          Zotero.getActiveZoteroPane()?.getSelectedItems(false) || [];
        return syncItemsToObsidian(items);
      },
      syncEnabledCollectionsOnStartup,
    };
  }
}

export default Addon;
