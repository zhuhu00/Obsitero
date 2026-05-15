# Obsitero AI Watch

`obsitero-ai-watch` is a standalone local companion tool for Obsitero.

It watches your synced Obsidian paper notes, reads each paper's `local_file`,
asks Codex to analyze the local PDF, writes Teaser and Pipeline figure crops
with local PDF tools, and writes a managed `# AI Notes` block back into the
same markdown file by invoking a configurable local AI command.

## Directory Layout

- `bin/obsitero-ai-watch.mjs`
- `bin/obsitero-ai-run-once.mjs`
- `bin/obsitero-ai-codex.mjs`
- `lib/core.mjs`
- `lib/process.mjs`
- `lib/runtime.mjs`
- `config.example.json`

## Prerequisites

AI Watch runs locally and expects these commands on your `PATH`:

- Node.js/npm
- Codex CLI (`codex`)
- Poppler `pdftotext`
- Poppler `pdftoppm`
- ImageMagick `magick`

On macOS, install Poppler and ImageMagick with Homebrew:

```bash
brew install poppler imagemagick
```

Verify the runtime commands:

```bash
which codex
which pdftotext
which pdftoppm
which magick
```

`pdftotext` and `pdftoppm` are provided by Poppler. If Poppler or
ImageMagick is missing, AI text generation may still run, but Teaser/Pipeline
figure extraction and image crops fail or remain empty.

## Configuration

Copy `config.example.json` to `config.json` and fill in your real paths.

Required fields:

- `vaultDir`
- `watchDir`
- `stateFile`
- `workRoot`
- `aiCommand`

The watcher stores one state entry per note in `stateFile`, so it does not
re-run AI generation for the same note unless the note or PDF changed.

Generated figure assets are written under:

- `<vaultDir>/assets/obsitero/<paper-slug>/images/teaser.jpg`
- `<vaultDir>/assets/obsitero/<paper-slug>/images/pipeline.jpg`

Codex identifies and explains likely Teaser/Pipeline figures in text. The
watcher owns image extraction with local `pdftotext`, `pdftoppm`, and
ImageMagick `magick` commands, then rewrites `# AI Notes` / `## 关键图表` embeds
only for image files that were actually created.

## Commands

Run one scan:

```bash
npm run ai:run-once
```

Run watch mode:

```bash
npm run ai:watch
```

## Default AI Backend

The default example config uses:

- a local codex adapter via `node .../obsitero-ai-codex.mjs`

If you want a different backend later, replace `aiCommand` with any local
command that prints a valid `# AI Notes` block to stdout.
