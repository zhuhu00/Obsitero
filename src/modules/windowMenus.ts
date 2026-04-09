import { syncCollectionToObsidian, syncItemsToObsidian } from "../sync/service";
import { getString } from "../utils/locale";
import { openPreferencePane } from "./preferencesPane";

export function registerWindowMenus(win: _ZoteroTypes.MainWindow) {
  win.MozXULElement.insertFTLIfNeeded(`${addon.data.config.addonRef}-mainWindow.ftl`);

  const managedElements = addon.data.managedWindowElements.get(win) ?? new Set();

  const collectionMenu = createMenuItem(win, {
    parentId: "zotero-collectionmenu",
    label: getString("menu-sync-collection"),
    onCommand: async () => {
      const collection = Zotero.getActiveZoteroPane()?.getSelectedCollection(false);
      if (collection) {
        await syncCollectionToObsidian(collection);
      }
    },
  });

  const itemMenu = createMenuItem(win, {
    parentId: "zotero-itemmenu",
    label: getString("menu-sync-item"),
    onCommand: async () => {
      const items = Zotero.getActiveZoteroPane()?.getSelectedItems(false) || [];
      await syncItemsToObsidian(items);
    },
  });

  const toolsMenu = createMenuItem(win, {
    parentId: "menu_ToolsPopup",
    label: getString("menu-open-preferences"),
    onCommand: () => {
      openPreferencePane();
    },
  });

  [collectionMenu, itemMenu, toolsMenu].forEach((element) => {
    if (element) {
      managedElements.add(element);
    }
  });

  addon.data.managedWindowElements.set(win, managedElements);
}

export function unregisterWindowMenus(win: Window) {
  const managedElements = addon.data.managedWindowElements.get(win);
  if (!managedElements) {
    return;
  }

  for (const element of managedElements) {
    element.remove();
  }

  addon.data.managedWindowElements.delete(win);
}

function createMenuItem(
  win: Window,
  {
    parentId,
    label,
    onCommand,
  }: {
    parentId: string;
    label: string;
    onCommand: (event: Event) => void | Promise<void>;
  },
) {
  const parentMenu = win.document.getElementById(parentId);
  if (!parentMenu) {
    return null;
  }

  const menuItem = win.document.createXULElement("menuitem");
  menuItem.setAttribute("label", label);
  menuItem.addEventListener("command", (event: Event) => {
    void onCommand(event);
  });
  parentMenu.appendChild(menuItem);
  return menuItem;
}
