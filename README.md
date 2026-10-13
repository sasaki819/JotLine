# JotLine

> **Stream-based Quick-Capture & Card Organizer for Obsidian**

JotLine is an Obsidian community plugin that bridges the gap between **rapid collection (quick capture)** and **structured organization**. 

Inspired by conversational chat apps (LINE, Slack), JotLine allows you to rapidly capture fleeting thoughts in a continuous stream, organize them into threaded cards via drag-and-drop, and seamlessly export clean Markdown to your clipboard or permanent notes.

---

## ✨ Features

- 💬 **Chat-Style Quick Capture**: A persistent bottom input bar designed for instantaneous idea capture without interrupting your workflow.
- 🧵 **Thread Grouping**: Reply to any card to create or append to conversational threads (`<!-- group: YYYYMMDD-HHmmss -->`).
- 🖱️ **Drag & Drop Reordering**: Reorder cards or move them between threads with intuitive drag-and-drop.
- 🔗 **Internal Link Autocomplete (`[[`)**: Type `[[` in the capture bar or card inline editor to search and autocomplete notes from your vault.
- 🖼️ **Rich Paste Support**:
  - **Images**: Paste or drag images into the input bar—automatically saved to your vault attachments folder and inserted as `![[...]]`.
  - **Tables**: Copy tables from Excel, Google Sheets, or web pages and paste them directly as formatted Markdown tables.
- ✂️ **Lossless Card Split & Merge (`⬆️`)**:
  - **Split**: Cut cards into two at the cursor position (`✂️ Split`).
  - **Merge**: Merge a card with the one above (`⬆️`) as a lossless inverse of split (no unwanted whitespace or blank lines).
- 🎯 **Multi-Select & Batch Operations**:
  - `Shift + Click` for range selection; `Cmd/Ctrl + Click` for individual toggle selection.
  - Floating 2-row selection action bar with semantic icons and hover tooltips:
    - 📁➕ **Group (`folder-plus`)**: Bundle selected cards into a new thread.
    - 📂➖ **Ungroup (`folder-minus`)**: Release cards back to the unclassified timeline.
    - 📋 **Copy (`copy`)**: Export selected cards as pure Markdown.
    - 🗑️ **Delete (`trash`)**: Batch delete selected cards.
  - Right-click context menu support for all bulk actions.
- 🏷️ **Inline Thread Renaming**: Double-click any thread title or click the ✏️ icon to rename it in place.
- 📋 **Clean Markdown Export**: Copy cards, threads, or entire boards without internal HTML comment markers.
- 🌐 **Hybrid Design**:
  - Global scratchpad mode (`_jotline.md`, configurable in settings).
  - Open **any** active Markdown note as a JotLine stream via `Open as JotLine`.
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

## 🚀 インストール・利用方法 (Installation)

### 📌 最も簡単な導入方法（ビルド不要・ファイルを置くだけ）

Node.jsやnpmを使ったビルドは**不要**です。生成済みの **`main.js`** と **`manifest.json`** の2つのファイルをObsidianの保管庫に配置するだけで、すぐに利用できます。

#### 1. 必要なファイル
本リポジトリ直下にある以下の **2つのファイル** を使用します：
- `main.js`（プラグインのプログラム本体）
- `manifest.json`（プラグインの定義ファイル）

#### 2. ファイルの配置先
お使いのObsidian保管庫（Vault）内のプラグインフォルダに、`jotline` という名前のフォルダを作成して配置します。

```text
あなたの保管庫 (Vault)/
  └─ .obsidian/
      └─ plugins/
          └─ jotline/           ← このフォルダを作成
              ├─ main.js        ← コピーして配置
              └─ manifest.json  ← コピーして配置
```

> [!TIP]
> - `.obsidian` フォルダは隠しフォルダです。Macの場合は `Cmd + Shift + .`、Windowsの場合はエクスプローラーの「表示」タブで「隠しファイル」にチェックを入れると表示されます。
> - CSSスタイルは `main.js` 内に統合されているため、`styles.css` は不要です。

#### 3. Obsidianでの有効化
1. Obsidianを開きます（起動中の場合は再起動またはリロード）。
2. 左下の歯車アイコン（設定）を開き、**「コミュニティプラグイン」** を選択します。
3. 「インストール済みプラグイン」の横にある **更新アイコン（🔄）** をクリックします。
4. 一覧に **「JotLine」** が表示されるので、右側のスイッチをオンにして **有効化** します。
5. 初回有効化時、Vault直下に自動的に `_jotline.md`（メモ用ファイル）と `_jotline.readme.md`（仕様説明書）が自動生成されます。
6. 左側のリボンアイコン（💬）をクリックするか、コマンドパレット（`Ctrl/Cmd + P`）から `JotLine: Open JotLine scratchpad` を実行すると起動します！

---

### 🛠️ ソースコードからビルドして導入する場合 (Build from Source)

ソースコードを変更・開発したい場合の手順です（Windows / Mac / Linux 対応）：

```bash
# 依存パッケージのインストール
npm install

# 本番用ビルド（main.js を生成）
npm run build

# テスト実行
npm test
```
ビルド後に生成された `main.js` と `manifest.json` を上記と同じ手順で配置（またはシンボリックリンク）してください。

---

## ⌨️ Commands & Shortcuts

| Action | How to access |
| :--- | :--- |
| **Open Scratchpad** | Ribbon icon (💬) or command palette: `JotLine: Open JotLine scratchpad` |
| **Open Note as JotLine** | Note `...` menu or command: `JotLine: Open current note as JotLine` |
| **Switch Back to Markdown** | View header or command: `Open as Markdown` |
| **Send Memo** | `Enter` in input bar |
| **New Line in Input** | `Shift + Enter` in input bar |
| **Autocomplete Internal Link** | Type `[[` in input bar or edit box, use `↑`/`↓` and `Enter` |
| **Multi-Select Cards** | `Shift + Click` (range) or `Cmd/Ctrl + Click` (toggle) |
| **Inline Edit Card** | Double-click card or click ✏️ |
| **Save Inline Edit** | `Cmd/Ctrl + Enter` |
| **Split Card** | Place cursor and click `✂️ Split` |
| **Merge with Above Card** | Click `⬆️` |

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
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
