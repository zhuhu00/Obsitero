# Obsitero

[![zotero target version](https://img.shields.io/badge/Zotero-9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![GitHub Repo stars](https://img.shields.io/github/stars/zhuhu00/Obsitero?style=flat-square)](https://github.com/zhuhu00/Obsitero)

Obsitero is a Zotero plugin for a Notero-style Obsidian workflow.

It syncs each Zotero parent item into one Obsidian markdown file, keeps your local reading notes intact, and generates a `Zotero.base` file inside your configured Zotero folder so your papers can be browsed with Obsidian's native Bases views.

## Features

- One Zotero parent item syncs to one Obsidian markdown file
- Uses Zotero item `Notes` child notes and appends them into the same markdown file
- Preserves `# My Notes` during resync
- Generates `Zotero.base` inside your configured Obsidian output folder
- Supports collection-based auto-sync and manual sync from Zotero context menus
- Uses title-based filenames with safe sanitization for cross-platform compatibility

## How It Works

Obsitero is a one-way sync tool:

- Zotero creates and updates the paper file
- Obsidian is where you continue writing and organizing your reading notes

Each synced paper looks roughly like this:

```md
---
display_title: "OccAny: Generalized Unconstrained Urban 3D Occupancy"
created: 2026-04-09
authors:
  - "Author A"
  - "Author B"
publication: "CVPR 2026"
tags:
  - "Unread"
pdf: "https://arxiv.org/abs/..."
local_file: "file:///Users/hu/Zotero/storage/XXXX/paper.pdf"
code:
page:
---

# My Notes

<!-- your local notes -->

<!-- ZOTERO-SYNC:BEGIN -->

# Zotero Notes

<!-- child notes from Zotero -->
<!-- ZOTERO-SYNC:END -->
```

## Install

Download the latest `.xpi` from GitHub Releases, or build it locally.

Local build output is:

- [`dist/obsitero.xpi`](./dist/obsitero.xpi)

Install it in Zotero:

1. Open `Tools -> Plugins`
2. Click the gear menu
3. Choose `Install Plugin From File...`
4. Select `obsitero.xpi`

## Configuration

Obsitero adds a preference pane in Zotero where you can configure:

- Obsidian vault path
- Output folder inside the vault
- Whether monitored collections auto-sync on item changes
- Filename strategy
- Whether `Zotero.base` should be generated
- Which collections are monitored
- Which fields are initialized into frontmatter

## Ownership Rules

Obsitero is intentionally not a bidirectional metadata sync tool.

### Initialized from Zotero

These fields are created from Zotero when the markdown file is first generated:

- `display_title`
- `authors`
- `publication`
- `tags`
- `pdf`
- `local_file`

### Obsidian-owned after creation

Once the file exists, Obsitero preserves your local values for:

- `display_title`
- `authors`
- `publication`
- `tags`
- `pdf`
- `code`
- `page`
- everything under `# My Notes`

Important:
Write your own reading notes only under `# My Notes`.
Obsitero preserves that section on resync, but it does not guarantee that arbitrary manual content outside `# My Notes` will be kept unchanged.

This means you can refine metadata in Obsidian without having later syncs overwrite it.

### Plugin-managed

These are maintained by Obsitero itself:

- `cssclasses`
- `created` (set once, then preserved on resync)
- `local_file`
- the managed `# Zotero Notes` block

## Auto-Sync Behavior

When `Sync when monitored items change` is enabled, Obsitero currently auto-syncs when:

- a monitored regular item is modified
- a monitored item's tags change
- an item is added to a monitored collection
- Zotero starts and monitored collections are synced on startup

Current auto-sync does not yet fully cover:

- PDF annotations
- attachment changes
- all child note mutation events as first-class triggers
- deletion cleanup when items are removed from a collection or deleted from Zotero

## Current Limitations

- Sync is one-way: Zotero -> Obsidian
- PDF annotations are not yet synced directly
- The library view depends on Obsidian Bases support
- Styling shown in screenshots/workflows may depend on your Obsidian theme and snippets

## AI Watch

Obsitero also includes a separate local companion tool for PDF-based AI notes:

- `tools/obsitero-ai-watch/`

It is intentionally not part of the Zotero XPI. The plugin still handles
`Zotero -> Markdown`, while the watcher handles:

- detecting synced paper notes in your Obsidian `Zotero/` folder
- reading each note's `local_file`
- invoking a configurable local AI command that asks Codex to analyze the local PDF
- writing a managed `# AI Notes` block back into the same paper note
- extracting Teaser and Pipeline figure crops with captions into
  `assets/obsitero/<paper-slug>/images/` and embedding them under
  `# AI Notes` / `## 关键图表`

The default command entrypoints are:

```bash
npm run ai:run-once
npm run ai:watch
```

Configuration lives in:

- `tools/obsitero-ai-watch/config.json`

Start from:

- [`tools/obsitero-ai-watch/config.example.json`](./tools/obsitero-ai-watch/config.example.json)
- [`tools/obsitero-ai-watch/README.md`](./tools/obsitero-ai-watch/README.md)

## Recommended Obsidian Setup

Obsitero works best when combined with:

- Obsidian Bases for native library browsing
- an Obsidian theme you like for database-style browsing
- optional CSS snippets for paper-property styling

Generated sync output is organized like this:

- `Zotero/Zotero.base`
- `Zotero/<paper title>.md`

Obsitero does not generate a root dashboard note for you. If you want a vault-level entry page, create it yourself and embed the generated base:

```md
![[Zotero/Zotero.base]]
```

This keeps the plugin focused on sync output only, while letting you style and organize your own entry pages however you want.

## Development

```bash
npm install
npm run lint:check
npm test
npm run build
```

For local development with hot reload:

```bash
npm start
```

Build output is produced in:

- `.scaffold/build/`
- `dist/obsitero.xpi`

## Release

The repository includes a GitHub Actions release workflow.

- Push `main`
- Create and push a tag like `v0.1.0`
- GitHub Actions builds and publishes the release artifact

The release workflow is defined in:

- [release.yml](./.github/workflows/release.yml)

## Template Notes

Obsitero is built on top of the following tooling and template infrastructure:

- [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
- [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold)
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
- [zotero-types](https://github.com/windingwind/zotero-types)

That template origin is intentionally retained because it still explains:

- the Zotero bootstrap plugin structure
- scaffold-driven build and release behavior
- the plugin packaging model for Zotero 9

This repository is no longer a generic template repo. It is the Obsitero plugin implementation.

## License

Obsitero is released under:

- `AGPL-3.0-or-later`

See [LICENSE](./LICENSE).
