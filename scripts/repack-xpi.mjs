import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const [sourceDir, outputPath] = process.argv.slice(2);

if (!sourceDir || !outputPath) {
  console.error(
    "Usage: node scripts/repack-xpi.mjs <addon-directory> <output-xpi-path>",
  );
  process.exit(1);
}

const sourceDirPath = path.resolve(sourceDir);
const outputFilePath = path.resolve(outputPath);

if (!existsSync(sourceDirPath)) {
  console.error(`Addon directory does not exist: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(path.dirname(outputFilePath), { recursive: true });
rmSync(outputFilePath, { force: true });

execFileSync("zip", ["-qr", outputFilePath, "."], {
  cwd: sourceDirPath,
  stdio: "inherit",
});

console.log(`Repacked XPI to ${outputFilePath}`);
