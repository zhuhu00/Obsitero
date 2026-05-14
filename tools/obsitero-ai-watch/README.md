# Obsitero AI Watch

`obsitero-ai-watch` is a standalone local companion tool for Obsitero.

It watches your synced Obsidian paper notes, reads each paper's `local_file`,
asks Codex to analyze the local PDF, and writes a managed `# AI Notes` block
back into the same markdown file by invoking a configurable local AI command.
The Codex-direct workflow also attempts to extract Teaser and Pipeline figure
crops, including captions, into `assets/obsitero/<paper-slug>/images/` and
embeds created images under `# AI Notes` / `## 关键图表`.

## Directory Layout

- `bin/obsitero-ai-watch.mjs`
- `bin/obsitero-ai-run-once.mjs`
- `bin/obsitero-ai-codex.mjs`
- `lib/core.mjs`
- `lib/process.mjs`
- `lib/runtime.mjs`
- `config.example.json`

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
