# Zotero Obsidian Sync Design

Date: 2026-04-08
Status: Approved for planning

## Goal

Build a Zotero plugin that provides a Notero-style research library workflow for Obsidian.

The plugin should:

- monitor selected Zotero collections
- sync each Zotero parent item into exactly one Obsidian markdown file
- write selected Zotero fields into markdown frontmatter
- preserve a user-owned `My Notes` section in each file
- generate an Obsidian Dataview index page for database-like browsing

The plugin should not treat child notes as separate markdown files in v1.

## Non-Goals

The first version will not include:

- bidirectional sync from Obsidian back to Zotero
- automatic merging of Zotero child notes into `Comment` or `AI Summary`
- PDF annotation extraction
- attachment export beyond metadata such as file path
- custom body templates
- multiple output profiles

## Primary Workflow

1. The user installs the Zotero plugin.
2. The user opens plugin preferences in Zotero.
3. The user configures:
   - Obsidian vault path
   - output folder inside the vault, default `Zotero`
   - monitored Zotero collections
   - auto-sync on item modification
   - which metadata fields should be written to frontmatter
   - preferred file naming strategy
4. The user adds or edits an item in a monitored collection.
5. The plugin creates or updates a single markdown file for the parent item.
6. The user opens the file in Obsidian and writes under `My Notes`.
7. The plugin updates only managed metadata sections on future syncs and does not overwrite `My Notes`.

## Item Model

The plugin is item-centric.

- One Zotero parent item maps to one markdown file.
- Child notes do not map to standalone files in v1.
- Attachments do not map to standalone files in v1.
- The parent item is the sync identity.

### Sync Identity

Each synced file will be identified by the Zotero parent item key and, when available, citation key.

Preferred file naming order:

1. `citationKey`
2. `itemKey`
3. optional future fallback formats such as `authorYearTitle`

The stable internal identity is the Zotero parent item key even if the displayed filename strategy changes later.

## Output Structure

All synced files are written under the configured Obsidian output folder.

For the current user configuration, the intended target is:

`/Users/hu/Desktop/code/kepano-obsidian/Zotero`

Each paper file is markdown and uses this structure:

```md
---
title:
authors:
year:
publication:
tags: []
collections: []
citation_key:
zotero_uri:
doi:
url:
date_added:
date_modified:
---

<!-- ZOTERO-SYNC:BEGIN -->
<!-- managed content -->
<!-- ZOTERO-SYNC:END -->

## My Notes

```

In v1, the managed content block can remain empty or contain only a brief generated marker.

## Frontmatter Fields

The plugin will support a Notero-inspired set of predefined syncable fields. The user chooses which of these are enabled via checkboxes in the Zotero preferences UI.

Initial supported field set:

- `title`
- `authors`
- `year`
- `publication`
- `tags`
- `collections`
- `citation_key`
- `zotero_uri`
- `doi`
- `url`
- `date_added`
- `date_modified`

Default enabled fields:

- `title`
- `authors`
- `year`
- `publication`
- `tags`
- `collections`
- `citation_key`
- `zotero_uri`
- `doi`
- `url`
- `date_added`
- `date_modified`

Field selection is stored in plugin preferences and drives frontmatter generation.

## Managed vs User-Owned Content

The file is split into two ownership domains.

### Plugin-managed

- YAML frontmatter
- content inside `<!-- ZOTERO-SYNC:BEGIN -->` and `<!-- ZOTERO-SYNC:END -->`

### User-owned

- everything under `## My Notes`

The sync engine must never overwrite user-owned content.

## Sync Triggers

### Automatic Sync

Automatic sync should run when:

- an item is added to a monitored collection
- a synced parent item is modified

Automatic sync should apply only to parent items in monitored collections.

### Manual Sync

The plugin should provide:

- collection context menu action: `Sync Items to Obsidian`
- item context menu action: `Sync to Obsidian`

Manual sync should allow recovery and bulk sync of existing items.

## Collection Monitoring

The plugin should mirror Notero's collection-based control model.

Preferences will include a table listing Zotero collections with a sync-enabled toggle for each one.

The plugin only auto-syncs items that belong to one or more enabled collections.

## Dataview Index

The plugin should optionally generate a Dataview-based index file inside the output folder.

Suggested file:

`Zotero/_Index.md`

Suggested initial content:

````md
# Zotero Library

```dataview
TABLE title, authors, year, publication, tags
FROM "Zotero"
SORT date_modified DESC
```
````

This provides the database-style overview requested by the user without requiring an Obsidian plugin of our own in v1.

## Preferences UI

The preferences UI should contain four groups.

### Vault

- Obsidian vault path
- output folder name

### Sync

- sync when items are modified
- monitored collections table

### Page

- file name format
- create Dataview index page

### Fields

- checkbox list for supported frontmatter fields

## Internal Components

The implementation should be split into focused modules.

### Preferences Module

Responsible for:

- typed preference definitions
- reading and writing plugin preferences
- checkbox and menu bindings

### Collection Sync Config Module

Responsible for:

- storing enabled collections
- checking whether an item belongs to a monitored collection

### Metadata Extraction Module

Responsible for:

- reading supported fields from Zotero items
- normalizing output values for frontmatter

### Markdown Rendering Module

Responsible for:

- rendering frontmatter
- rendering the base file structure
- preserving `My Notes`
- maintaining the managed content block

### File Sync Module

Responsible for:

- determining output path
- creating files
- updating files safely
- writing Dataview index page

### Sync Orchestration Module

Responsible for:

- handling automatic and manual sync triggers
- filtering for parent items
- filtering by monitored collections

## Safety Rules

- Never overwrite content outside the managed metadata areas.
- Never create standalone markdown files for child notes in v1.
- Ignore attachments and child notes for file creation in v1.
- Skip trash, deleted, and non-regular items.
- Prefer deterministic filenames and deterministic frontmatter ordering.

## Error Handling

The plugin should provide clear user-facing errors for:

- missing or invalid vault path
- missing output folder or inability to create it
- permission failures when writing files
- invalid filename resolution
- sync invoked on unsupported item types

Errors should not corrupt existing files.

## Testing Scope

The first implementation should include tests for:

- frontmatter generation for selected fields
- file naming strategy
- preservation of `My Notes`
- update behavior for existing files
- filtering of parent items vs child notes
- collection monitoring logic

## Open Questions Deferred

These are intentionally deferred until after v1 works:

- merge strategy for Zotero child notes into `Comment`
- merge strategy for AI-generated notes into `AI Summary`
- support for additional fields beyond the initial set
- richer Dataview index customization
- bidirectional sync

## Recommendation

Implement v1 as a Zotero-only plugin built in `/Users/hu/Desktop/temp/zotero-plugin-template`.

This keeps the critical path short:

- Zotero is the source of truth
- Obsidian only needs to watch files
- Dataview provides the database-style overview
- the plugin architecture stays aligned with the user's Notero mental model
