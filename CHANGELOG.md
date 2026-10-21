# Changelog

All notable changes to JotLine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each release section (`## [X.Y.Z] - YYYY-MM-DD`) is used as the release notes on GitLab Releases.

## [1.0.0] - 2026-10-22

First release.

### Added

- Chat-style quick capture: a persistent input bar at the bottom of the view adds each memo as a card (`Enter` to send, `Shift + Enter` for a new line). The input area can be resized by dragging its top handle.
- Threads: reply to a card to start or extend a thread, group selected cards into a thread, ungroup or dissolve threads, rename and delete threads, and collapse / expand them.
- Card operations: inline editing, split at the cursor, merge with the card above, move up / down, and reordering by drag and drop.
- Multi-select (`Shift + Click`, `Cmd/Ctrl + Click`) with a selection action bar and a context menu for grouping, ungrouping, copying, and deleting.
- Clean Markdown export: copy a card, a thread, the selected cards, or the whole file without the internal HTML comment markers.
- Undo / redo for every change made in JotLine and for changes made to the file outside JotLine, via the header buttons, keyboard shortcuts (`Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`, `Ctrl + Y`), and the commands `JotLine: Undo` / `JotLine: Redo`.
- Drag and drop between JotLine and notes, and between JotLine views of different files: move cards, multi-selected cards, or whole threads into a note, and turn text selected in a note into a card. Hold `Ctrl` (Windows / Linux) or `Option` (macOS) while dropping to copy instead of moving (desktop only).
- Internal link autocomplete (`[[`) in the input bar and the card editor.
- Rich paste in the input bar: images are saved as vault attachments, and tables from spreadsheets or web pages are converted to Markdown tables.
- Global scratchpad (`_jotline.md` by default, configurable) and the command `Open current note as JotLine` to open any Markdown note as a JotLine stream.
- English and Japanese UI.
- `_jotline.readme.md` is generated in the vault to describe the data format for AI agents.
- Data is stored in plain Markdown with non-destructive HTML comment markers (`<!-- group -->`, `<!-- card -->`).
