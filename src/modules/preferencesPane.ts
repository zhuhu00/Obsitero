import { getString } from "../utils/locale";

export async function registerPreferencePane() {
  addon.data.preferencePaneID = await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

export function openPreferencePane() {
  if (!addon.data.preferencePaneID) {
    return;
  }

  return Zotero.Utilities.Internal.openPreferences(addon.data.preferencePaneID);
}
