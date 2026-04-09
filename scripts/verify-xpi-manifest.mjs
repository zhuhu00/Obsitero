import { execFileSync } from "node:child_process";

const [xpiPath] = process.argv.slice(2);

if (!xpiPath) {
  console.error("Usage: node scripts/verify-xpi-manifest.mjs <path-to-xpi>");
  process.exit(1);
}

let manifestRaw = "";
try {
  manifestRaw = execFileSync("unzip", ["-p", xpiPath, "manifest.json"], {
    encoding: "utf8",
  });
} catch (error) {
  console.error(`Failed to read manifest.json from ${xpiPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (error) {
  console.error(`Invalid manifest.json in ${xpiPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const updateURL = manifest?.applications?.zotero?.update_url;
if (typeof updateURL !== "string" || updateURL.length === 0) {
  console.error(`Missing Zotero update_url in ${xpiPath}`);
  process.exit(1);
}

if (updateURL.includes("__")) {
  console.error(`Unresolved placeholder in update_url: ${updateURL}`);
  process.exit(1);
}

console.log(`Verified XPI manifest update_url: ${updateURL}`);
