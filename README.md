# JotLine

> **Stream-based Quick-Capture & Card Organizer for Obsidian**

JotLine is an Obsidian community plugin that bridges the gap between **rapid collection (quick capture)** and **structured organization**. 

Inspired by conversational chat apps (LINE, Slack), JotLine allows you to rapidly capture fleeting thoughts in a continuous stream, organize them into threaded cards via drag-and-drop, and seamlessly export clean Markdown to your clipboard or permanent notes.

---

## ✨ Features

- 💬 **Chat-Style Quick Capture**: A persistent bottom input bar designed for instantaneous idea capture without interrupting your workflow.
- 📐 **Resizable Input Area**: Drag the top handle of the input bar vertically to expand or shrink input height (40px–400px). Double-click the handle to reset to default.
- 🧵 **Thread Grouping & Accordion**: Reply to any card to create or append to conversational threads (`<!-- group: YYYYMMDD-HHmmss -->`). Expand or collapse entire thread groups with the accordion chevron toggle (`chevron-down` / `chevron-right`).
- 🖱️ **Reordering & Positioning**: Reorder cards within threads using click action buttons (`arrow-up` / `arrow-down`), or drag-and-drop cards between threads with intuitive handles (`⠿`).
- 🔀 **Drag & Drop Between JotLine and Notes**: Move cards, multi-selected cards, or whole threads (drag the thread header) from JotLine into any note in the editor, and drag selected text from a note into JotLine to turn it into a card. Also works between JotLine views of different files.
  - A normal drop **moves** (the original is removed); hold `Ctrl` (Windows / Linux) or `Option` (macOS) while dropping to **copy** instead.
  - Dropping into the JotLine input bar inserts the text there.
  - Dropping onto the same file (e.g. a JotLine view and an editor showing the same note) is not allowed.
  - Moves can be reverted with undo on each side (JotLine undo / editor undo). Desktop only.
- 🔗 **Internal Link Autocomplete (`[[`)**: Type `[[` in the capture bar or card inline editor to search and autocomplete notes from your vault.
- 🖼️ **Rich Paste Support**:
  - **Images**: Paste or drag images into the input bar—automatically saved to your vault attachments folder and inserted as `![[...]]`.
  - **Tables**: Copy tables from Excel, Google Sheets, or web pages and paste them directly as formatted Markdown tables.
- ✂️ **Card Split & Merge (`⬆️`)**:
  - **Split**: While editing a card, cut it into two at the cursor position (`✂️ Split at cursor`).
  - **Merge**: Merge a card with the one above (`⬆️`) with a clean single newline separation.
- 🎯 **Multi-Select & Batch Operations**:
  - `Shift + Click` for range selection; `Cmd/Ctrl + Click` for individual toggle selection.
  - 2-row selection action bar (shown above the input bar while cards are selected) with semantic icons and hover tooltips:
    - 📁➕ **Group (`folder-plus`)**: Bundle selected cards into a new thread.
    - 📂➖ **Ungroup (`folder-minus`)**: Release cards back to the unclassified timeline.
    - 📋 **Copy (`copy`)**: Export selected cards as pure Markdown.
    - 🗑️ **Delete (`trash`)**: Batch delete selected cards.
  - Right-click context menu support for all bulk actions.
- 🏷️ **Thread Header Management**:
  - Toggle accordion collapse / expand (`chevron-down` / `chevron-right`).
  - Rename thread title in place (double-click title or click ✏️).
  - Copy thread contents as Markdown (`copy`).
  - Dissolve thread back to unclassified cards (`folder-minus`).
  - Delete entire thread and its cards (`trash`).
- ↩️ **Undo / Redo**: Undo or redo any change made in JotLine (adding, editing, deleting, splitting, merging, moving, grouping, and more), as well as changes to the file made outside JotLine (e.g. in the standard editor). Use the `undo-2` / `redo-2` buttons in the JotLine header, keyboard shortcuts, or the commands `JotLine: Undo` / `JotLine: Redo`.
  - The history is kept per view, up to 100 steps, and is cleared when the view is closed or switched to another file.
  - Card selection is cleared after undo / redo.
- 📋 **Clean Markdown Export**: Copy cards, threads, or entire boards without internal HTML comment markers.
- 🌐 **Hybrid Design**:
  - Global scratchpad mode (`_jotline.md`, configurable in settings).
  - Open **any** Markdown note as a JotLine stream via `Open current note as JotLine`.
- 🌍 **Multi-language Support (i18n)**: Automatically detects Obsidian and system language settings (English and Japanese) with unified, concise, and action-oriented tooltips and UI text.
- 🤖 **AI-Agent Ready**: Automatically generates `_jotline.readme.md` in your vault so generative AI and LLM agents know how to read, create, and organize JotLine cards safely.

---

## 💾 Data Format (Fail-safe Persistence)

JotLine stores everything in pure, standard Markdown using non-destructive HTML comments:

```markdown
<!-- group -->
<!-- card -->
First quick thought (unclassified)

<!-- card -->
Second quick thought with markdown:
- Bullet item 1
- Bullet item 2

<!-- group: 20261013-010000 -->
<!-- card -->
Topic header / parent thought
### Header 3 is supported
---

<!-- card -->
Follow-up thought in this thread
```

- **Failsafe**: If markers are accidentally deleted in normal editing mode, JotLine treats the text as a merged card without data loss or parsing errors.

---

## 🚀 Installation & Usage

### 📌 Installation

JotLine requires Obsidian **1.1.0** or later. You need two files, `main.js` and `manifest.json`. Get them in one of the following ways, then place them in your vault (see [Where to Place the Files](#where-to-place-the-files)).

#### Option A: Download from Releases (recommended)

Download `main.js` and `manifest.json` from the latest release on the **[Releases page](https://gitlab.sasaki819.mydns.jp/open/jotline/-/releases)** (listed under the release's assets).

You can also download the files of a specific version directly (replace `vX.Y.Z` with the version, e.g. `v1.0.0`):

```text
https://gitlab.sasaki819.mydns.jp/open/jotline/-/releases/vX.Y.Z/downloads/main.js
https://gitlab.sasaki819.mydns.jp/open/jotline/-/releases/vX.Y.Z/downloads/manifest.json
```

The changes in each version are listed in [CHANGELOG.md](CHANGELOG.md).

#### Option B: Build from source

The plugin bundle `main.js` is a build artifact and is **not** included in this repository. To build it yourself, use Node.js / npm (Windows / Mac / Linux compatible).

```bash
# Install dependencies
npm install

# Production build (generates main.js in the repository root)
npm run build
```

After the build, you need the following **two files** from the root of this repository:
- `main.js` (plugin executable, generated by the build)
- `manifest.json` (plugin manifest)

#### Where to Place the Files
Create a folder named `jotline` inside your Obsidian vault's plugins folder and copy (or symlink) the files there:

```text
Your Vault/
  └─ .obsidian/
      └─ plugins/
          └─ jotline/           ← Create this folder
              ├─ main.js        ← Copy here
              └─ manifest.json  ← Copy here
```

> [!TIP]
> - The `.obsidian` folder is hidden by default. On macOS, press `Cmd + Shift + .` in Finder; on Windows, check "Hidden items" under the "View" tab in File Explorer.
> - CSS styles are bundled inside `main.js`, so a separate `styles.css` is not required.

#### Enabling in Obsidian
1. Open Obsidian (or reload if it is already open).
2. Go to **Settings** (gear icon) → **Community plugins**.
3. Click the **Reload plugins (🔄)** icon next to "Installed plugins".
4. Locate **JotLine** in the list and toggle the switch to **enable** it.
5. On initial launch, `_jotline.md` (scratchpad note) and `_jotline.readme.md` (specification document) will be automatically created in the root of your vault.
6. Click the ribbon icon (💬) on the left sidebar, or open the Command Palette (`Ctrl/Cmd + P`) and run `JotLine: Open JotLine scratchpad` to start!

---

## ⌨️ Commands & Shortcuts

| Action | How to access |
| :--- | :--- |
| **Open Scratchpad** | Ribbon icon (💬) or command palette: `JotLine: Open JotLine scratchpad` (opens in the right sidebar) |
| **Open Note as JotLine** | Note `...` menu / file explorer context menu, or command: `JotLine: Open current note as JotLine` |
| **Switch Back to Markdown** | Click `📝 Markdown` in the JotLine header |
| **Send Memo** | `Enter` in input bar |
| **New Line in Input** | `Shift + Enter` in input bar |
| **Autocomplete Internal Link** | Type `[[` in input bar or edit box, use `↑`/`↓` and `Enter` / `Tab` |
| **Multi-Select Cards** | `Shift + Click` (range) or `Cmd/Ctrl + Click` (toggle) |
| **Inline Edit Card** | Double-click card or click ✏️ |
| **Save Inline Edit** | `Cmd/Ctrl + Enter` |
| **Split Card** | In edit mode, place cursor and click `✂️ Split at cursor` |
| **Merge with Above Card** | Click `⬆️` |
| **Move Card Up / Down** | Click `arrow-up` / `arrow-down` button on card |
| **Resize Input Bar** | Drag handle above input bar (double-click to reset) |
| **Collapse / Expand Thread** | Click `chevron-down` / `chevron-right` on thread header |
| **Move Cards / Thread into a Note** | Drag cards (or a thread header) from JotLine and drop into another note's editor; hold `Ctrl` / `Option` to copy |
| **Turn Note Text into a Card** | Select text in a note and drag it onto a JotLine view of another file; hold `Ctrl` / `Option` to copy |
| **Undo** | `Cmd/Ctrl + Z` in the JotLine view, the `undo-2` button in the header, or command: `JotLine: Undo` (no default hotkey) |
| **Redo** | `Cmd/Ctrl + Shift + Z` or `Ctrl + Y` in the JotLine view, the `redo-2` button in the header, or command: `JotLine: Redo` (no default hotkey) |

> In the card editor, reply box, thread-name editor, and a non-empty input bar, `Cmd/Ctrl + Z` performs the text field's own undo instead. In an empty input bar, it undoes the last JotLine change (e.g. right after sending a memo).

> Command names and button labels above are the English ones; they are shown in Japanese when Obsidian's language is set to Japanese.

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for development (watch mode)
npm run dev

# Production build
npm run build

# Type check (lint)
npx tsc --noEmit
```

GitLab CI runs check-docs, the tests, the type check, and the production build for merge requests, the `main` branch, and tags (see `.gitlab-ci.yml`). The built `main.js` and `manifest.json` are kept as job artifacts of the `build` job for 30 days.

### 🚢 Releasing

Releases are created by GitLab CI when a version tag (`vX.Y.Z`) is pushed. The files are uploaded to the project's Generic Package Registry (package `jotline`) and attached to the release, and the release notes are taken from `CHANGELOG.md`.

1. Update `version` in both `manifest.json` and `package.json` to the new version (`X.Y.Z`).
2. Add a section for the version to `CHANGELOG.md` with the release date: `## [X.Y.Z] - YYYY-MM-DD`. This section becomes the release notes.
3. Check locally that the versions and the changelog are consistent:
   ```bash
   node scripts/release.mjs check vX.Y.Z
   ```
4. Commit the changes and merge them into `main`.
5. Tag the commit on `main` and push the tag:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

The release pipeline fails (and no release is created) if the tag does not match the `version` in `manifest.json` / `package.json`, or if `CHANGELOG.md` has no section for the version. Tags that are not in the `vX.Y.Z` form only run the checks and the build.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
