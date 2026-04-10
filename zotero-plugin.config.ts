import { defineConfig } from "zotero-plugin-scaffold";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    hooks: {
      async "build:fluent"(ctx) {
        const localeRoots = ["en-US", "zh-CN"];
        await Promise.all(
          localeRoots.map(async (locale) => {
            const localeDir = join(ctx.dist, "addon", "locale", locale);
            const aliases: Array<[string, string]> = [
              [`${pkg.config.addonRef}-preferences.ftl`, "preferences.ftl"],
            ];
            await Promise.all(
              aliases.map(async ([sourceName, targetName]) => {
                await copyFile(
                  join(localeDir, sourceName),
                  join(localeDir, targetName),
                );
              }),
            );
          }),
        );
      },
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  server: {
    devtools: false,
    prefs: {
      [`${pkg.config.prefsPrefix}.vaultPath`]:
        "/Users/hu/Desktop/code/kepano-obsidian",
      [`${pkg.config.prefsPrefix}.outputFolder`]: "Zotero",
      [`${pkg.config.prefsPrefix}.syncOnModify`]: false,
      [`${pkg.config.prefsPrefix}.createDataviewIndex`]: true,
      [`${pkg.config.prefsPrefix}.fileNameStrategy`]: "title",
      [`${pkg.config.prefsPrefix}.collectionSyncConfigs`]: JSON.stringify({}),
      [`${pkg.config.prefsPrefix}.selectedFields`]: JSON.stringify([
        "authors",
        "publication",
        "tags",
        "zotero_url",
        "link",
      ]),
    },
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
