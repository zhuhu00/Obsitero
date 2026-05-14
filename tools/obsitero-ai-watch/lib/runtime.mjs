/* global clearTimeout, console, process, setTimeout */

import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeAiNotesContent,
  parsePaperNote,
  shouldProcessPaper,
  upsertAiNotes,
} from "./core.mjs";
import {
  extractPdfFigures,
  rewriteKeyFiguresSection,
} from "./figure-extractor.mjs";
import { runCommand } from "./process.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const DEFAULT_CONFIG_PATH = path.join(
  REPO_ROOT,
  "tools/obsitero-ai-watch/config.json",
);

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const resolvedConfigPath = path.resolve(configPath);
  const configDir = path.dirname(resolvedConfigPath);
  const config = JSON.parse(await fs.readFile(resolvedConfigPath, "utf8"));

  const resolved = {
    repoRoot: REPO_ROOT,
    configPath: resolvedConfigPath,
    configDir,
    watchDir: resolveConfigPath(config.watchDir, configDir),
    vaultDir: resolveConfigPath(config.vaultDir, configDir),
    stateFile: resolveConfigPath(config.stateFile ?? "./state.json", configDir),
    workRoot: resolveConfigPath(
      config.workRoot ?? "/tmp/obsitero-ai-watch",
      configDir,
    ),
    scanOnStartup: config.scanOnStartup !== false,
    fileStableMs: Number(config.fileStableMs ?? 2500),
    unsetProxyEnv: config.unsetProxyEnv !== false,
    aiCommand: config.aiCommand,
    codexModel: config.codexModel || "",
  };

  validateConfig(resolved);
  return resolved;
}

export async function runOnce(config, options = {}) {
  const state = await loadState(config.stateFile);
  const notePaths =
    options.notePaths?.length > 0
      ? options.notePaths.map((notePath) => path.resolve(notePath))
      : await listMarkdownFiles(config.watchDir);

  const results = [];
  for (const notePath of notePaths) {
    results.push(
      await processNote(notePath, config, state, { mode: "run-once" }),
    );
  }
  await saveState(config.stateFile, state);
  return results;
}

export async function startWatcher(config) {
  const state = await loadState(config.stateFile);
  const timers = new Map();
  const inFlight = new Set();

  const schedule = (notePath) => {
    if (!notePath.endsWith(".md")) {
      return;
    }
    const existingTimer = timers.get(notePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      timers.delete(notePath);
      if (inFlight.has(notePath)) {
        return;
      }
      inFlight.add(notePath);
      try {
        await processNote(notePath, config, state, { mode: "watch" });
        await saveState(config.stateFile, state);
      } catch (error) {
        console.error(`[obsitero-ai-watch] failed: ${notePath}`);
        console.error(error instanceof Error ? error.stack : String(error));
      } finally {
        inFlight.delete(notePath);
      }
    }, config.fileStableMs);

    timers.set(notePath, timer);
  };

  if (config.scanOnStartup) {
    const existingNotePaths = await listMarkdownFiles(config.watchDir);
    const primed = primeSeenNotes(existingNotePaths, state);
    await saveState(config.stateFile, state);
    console.log(`[obsitero-ai-watch] startup prime: ${JSON.stringify(primed)}`);
  }

  console.log(`[obsitero-ai-watch] watching ${config.watchDir}`);
  const watcher = watch(config.watchDir, (eventType, filename) => {
    if (!filename) {
      return;
    }
    const notePath = path.join(config.watchDir, filename.toString());
    if (eventType === "rename" || eventType === "change") {
      schedule(notePath);
    }
  });

  const close = async () => {
    watcher.close();
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    await saveState(config.stateFile, state);
  };

  process.on("SIGINT", async () => {
    await close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await close();
    process.exit(0);
  });

  return watcher;
}

export async function processNote(notePath, config, state, options = {}) {
  const mode = options.mode ?? "run-once";
  const resolvedNotePath = path.resolve(notePath);
  const noteExists = await fileExists(resolvedNotePath);
  if (!noteExists) {
    return { notePath: resolvedNotePath, status: "missing" };
  }

  const rawMarkdown = await fs.readFile(resolvedNotePath, "utf8");
  const parsedNote = parsePaperNote(rawMarkdown);

  if (
    !parsedNote.localFilePath ||
    !(await fileExists(parsedNote.localFilePath))
  ) {
    return { notePath: resolvedNotePath, status: "no-local-pdf" };
  }

  const pdfStat = await fs.stat(parsedNote.localFilePath);
  const stateEntry = state.notes[resolvedNotePath];
  if (
    !shouldProcessPaper({
      parsedNote,
      stateEntry,
      mode,
    })
  ) {
    return { notePath: resolvedNotePath, status: "skipped" };
  }

  const job = await createJob(resolvedNotePath, parsedNote, config);
  await fs.mkdir(job.jobDir, { recursive: true });
  await fs.mkdir(job.figureAssetDir, { recursive: true });
  await fs.copyFile(parsedNote.localFilePath, job.codexPdfPath);

  await fs.writeFile(job.jobFile, JSON.stringify(job.descriptor, null, 2));
  const aiResult = await runCommand(config.aiCommand, job.variables, {
    cwd: config.repoRoot,
    unsetProxyEnv: false,
  });
  await fs.writeFile(job.aiLogFile, `${aiResult.stderr}\n${aiResult.stdout}`);
  if (aiResult.code !== 0) {
    throw new Error(
      `AI command failed for ${resolvedNotePath}\n${aiResult.stderr || aiResult.stdout}`,
    );
  }

  const aiNotesContent = normalizeAiNotesContent(aiResult.stdout);
  if (!aiNotesContent.startsWith("# AI Notes")) {
    throw new Error(
      `AI command did not return a valid # AI Notes block for ${resolvedNotePath}`,
    );
  }

  const figureExtractor = options.figureExtractor ?? extractPdfFigures;
  try {
    await figureExtractor({
      pdfPath: job.codexPdfPath,
      aiNotesContent,
      teaserImagePath: job.descriptor.teaser_image_path,
      pipelineImagePath: job.descriptor.pipeline_image_path,
    });
  } catch {
    // Figure extraction is best-effort; note generation should still finish.
  }

  const finalizedAiNotesContent = rewriteKeyFiguresSection(aiNotesContent, {
    teaserMarkdownEmbed: job.descriptor.teaser_markdown_embed,
    pipelineMarkdownEmbed: job.descriptor.pipeline_markdown_embed,
    teaserExists: await fileExists(job.descriptor.teaser_image_path),
    pipelineExists: await fileExists(job.descriptor.pipeline_image_path),
  });
  const updatedMarkdown = upsertAiNotes(rawMarkdown, finalizedAiNotesContent);
  await fs.writeFile(resolvedNotePath, updatedMarkdown, "utf8");
  const finalNoteStat = await fs.stat(resolvedNotePath);

  state.notes[resolvedNotePath] = {
    firstSeenAt: stateEntry?.firstSeenAt ?? new Date().toISOString(),
    markdownMtimeMs: finalNoteStat.mtimeMs,
    pdfMtimeMs: pdfStat.mtimeMs,
    lastProcessedAt: new Date().toISOString(),
  };

  return {
    notePath: resolvedNotePath,
    status: "processed",
    pdfPath: parsedNote.localFilePath,
    jobDir: job.jobDir,
  };
}

export function primeSeenNotes(
  notePaths,
  state,
  timestamp = new Date().toISOString(),
) {
  let primed = 0;

  for (const notePath of notePaths) {
    const resolvedNotePath = path.resolve(notePath);
    if (state.notes[resolvedNotePath]) {
      continue;
    }

    state.notes[resolvedNotePath] = {
      firstSeenAt: timestamp,
    };
    primed += 1;
  }

  return { primed };
}

export async function createJob(notePath, parsedNote, config) {
  const slug = slugify(path.basename(notePath, ".md"));
  const jobDir = path.join(config.workRoot, slug);
  const codexPdfPath = path.join(jobDir, "paper.pdf");
  const noteDir = path.dirname(notePath);
  const figureAssetDir = path.join(
    config.vaultDir,
    "assets",
    "obsitero",
    slug,
    "images",
  );
  const figureAssetMarkdownDir = toMarkdownPath(
    path.relative(noteDir, figureAssetDir),
  );
  const teaserImagePath = path.join(figureAssetDir, "teaser.jpg");
  const pipelineImagePath = path.join(figureAssetDir, "pipeline.jpg");
  const noteTemplatePath = path.join(
    config.repoRoot,
    "skills/obsitero-paper-note-writer/templates/note-template.md",
  );
  const codexOutputFile = path.join(jobDir, "codex-output.md");
  const descriptor = {
    repo_root: config.repoRoot,
    note_path: notePath,
    note_dir: noteDir,
    pdf_path: parsedNote.localFilePath,
    codex_pdf_path: codexPdfPath,
    note_template_path: noteTemplatePath,
    codex_output_file: codexOutputFile,
    figure_asset_dir: figureAssetDir,
    figure_asset_markdown_dir: figureAssetMarkdownDir,
    teaser_image_path: teaserImagePath,
    pipeline_image_path: pipelineImagePath,
    teaser_markdown_embed: buildMarkdownEmbed(noteDir, teaserImagePath),
    pipeline_markdown_embed: buildMarkdownEmbed(noteDir, pipelineImagePath),
  };
  const jobFile = path.join(jobDir, "job.json");

  return {
    jobDir,
    jobFile,
    codexPdfPath,
    figureAssetDir,
    aiLogFile: path.join(jobDir, "ai-command.log"),
    descriptor,
    variables: {
      ...descriptor,
      job_dir: jobDir,
      job_file: jobFile,
      repo_root: config.repoRoot,
      config_dir: config.configDir,
      watch_dir: config.watchDir,
      vault_dir: config.vaultDir,
      note_filename: path.basename(notePath),
      paper_slug: slug,
      codex_pdf_path: codexPdfPath,
      codex_model: config.codexModel,
    },
  };
}

async function loadState(stateFile) {
  if (!(await fileExists(stateFile))) {
    return { notes: {} };
  }

  try {
    return JSON.parse(await fs.readFile(stateFile, "utf8"));
  } catch {
    return { notes: {} };
  }
}

async function saveState(stateFile, state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

async function listMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function validateConfig(config) {
  const requiredFields = [
    "watchDir",
    "vaultDir",
    "stateFile",
    "workRoot",
    "aiCommand",
  ];
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing config field: ${field}`);
    }
  }
}

function resolveConfigPath(value, configDir) {
  if (!value) {
    return value;
  }

  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(configDir, value);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "paper";
}

function buildMarkdownEmbed(noteDir, imagePath) {
  return `![](${toMarkdownPath(path.relative(noteDir, imagePath))})`;
}

function toMarkdownPath(targetPath) {
  return targetPath.split(path.sep).join("/");
}
