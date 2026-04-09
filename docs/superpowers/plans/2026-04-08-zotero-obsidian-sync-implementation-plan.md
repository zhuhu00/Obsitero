## Goal

Implement the first usable version of the Zotero Obsidian sync plugin described in the approved spec.

The implementation should:

- sync each Zotero parent item to one markdown file in the configured Obsidian output folder
- write selected fields into YAML frontmatter
- preserve a `## My Notes` section on updates
- support manual sync and automatic sync for monitored collections
- generate a Dataview index page
- expose preferences for vault path, output folder, naming strategy, auto-sync, monitored collections, and selected frontmatter fields

## Constraints

- Follow TDD for new sync logic
- Do not ship note-centric output; child notes and attachments stay out of v1 sync output
- Keep manual edits under `## My Notes` intact across repeated syncs
- Reuse the Zotero plugin template structure rather than inventing a new addon layout

## Implementation Steps

1. Replace template examples with plugin-specific scaffolding.
   - Strip example startup registrations and menus from `src/hooks.ts`
   - Define addon defaults and locale strings for sync-specific UI
   - Prepare clean module boundaries for preferences, sync, menus, and notifier behavior

2. Add pure sync-domain tests first.
   - Add tests for filename selection
   - Add tests for frontmatter rendering from selected fields
   - Add tests for markdown creation and update while preserving `## My Notes`
   - Add tests for Dataview index generation

3. Implement pure sync modules to satisfy the tests.
   - Metadata extraction and field mapping
   - Markdown/frontmatter rendering
   - Existing-file parsing and managed-section replacement
   - Dataview index content generation

4. Add preference storage and defaults.
   - Define pref keys and typed helpers
   - Add defaults in `addon/prefs.js`
   - Replace preference pane markup with real controls
   - Implement preference window behavior in `src/modules/preferenceScript.ts`

5. Add Zotero integration points.
   - Register notifier for parent item add/modify events
   - Filter auto-sync to monitored collections
   - Add manual sync actions for item and collection context menus
   - Connect sync services to filesystem writes

6. Add end-to-end verification coverage where practical.
   - Keep existing startup smoke test
   - Add unit-level verification via `npm test` if the scaffold supports it
   - Run build/typecheck and targeted tests after implementation

## Checkpoints

- Checkpoint 1: Pure sync logic tested and passing locally
- Checkpoint 2: Preferences UI and pref persistence wired up
- Checkpoint 3: Manual sync and auto-sync integrated into Zotero hooks
- Checkpoint 4: Build and test verification complete

## Risks To Watch

- Zotero item field access can vary by item type, so field extraction must stay defensive
- Existing-file parsing must not accidentally drop user content when markers are missing
- The template's example UI code may be entangled with startup wiring and needs careful cleanup
- Zotero collection membership checks may be more expensive than expected if done naively on every notify event
