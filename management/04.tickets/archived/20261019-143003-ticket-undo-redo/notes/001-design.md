---
id: 001-design
title: 設計書（旧 Spec 0003 design.md）
created: 2026-10-19 14:30:03
updated: 2026-10-20 01:19:01
---
# 設計書（旧 Spec 0003 design.md）

## 概要

旧 `specs/0003-undo-redo/design.md` の設計内容を AIco チケットノートとして移行保存したもの。

> これは本 Item による変更分の設計であり、全体のマスターは docs/architecture/ にある。
> Item 完了時に、この内容を docs/architecture/ へ反映する。

## 変更の概要

- 操作履歴を **ファイル内容（Markdown テキスト）のスナップショット** として保持する。履歴の1件は「その操作の直前のファイル内容」。
- `JotStore` が「最後に読み書きしたファイル内容」（`currentText`）を持ち、ファイル内容が変わるたびに、変更前の `currentText` を履歴に積む。
  - JotLine の操作：既存の `save()` を、履歴を記録する保存処理に置き換える。
  - 外部変更：`modify` イベントで読み直した内容が `currentText` と異なるとき、変更前の内容を履歴に積む。
- アンドゥ／リドゥは、スナップショットのテキストをファイルへ書き込み、パースし直して表示を更新する。
- 履歴のスタック操作（上限100件、リドゥの破棄）は、Obsidian に依存しない小さなクラス `UndoHistory` に切り出し、単体テストしやすくする。
- 表示を置き換えたこと（アンドゥ／リドゥ／外部変更による読み直し）をストアから UI に通知し、`App.svelte` がカードの選択を解除する。
- 操作の入口は3つ：ビュー内のキー操作（`App.svelte`）、ヘッダーのボタン（`App.svelte`）、コマンド（`main.ts`）。

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `src/history.ts`（新規） | 履歴スタック `UndoHistory` |
| `src/history.test.ts`（新規） | `UndoHistory` の単体テスト |
| `src/store.ts` | `currentText` と履歴の管理、保存処理の置き換え、外部変更の扱い、`undo()` / `redo()`、UI への通知用ストア |
| `src/store.test.ts`（新規） | `JotStore` の各操作とアンドゥ／リドゥ・外部変更の単体テスト（`obsidian` をモック） |
| `src/ui/App.svelte` | ヘッダーのボタン、キー操作の追加、表示置き換え時の選択解除 |
| `src/main.ts` | コマンド「Undo」「Redo」の登録 |
| `src/i18n/locales/en.ts`、`ja.ts` | ボタンのツールチップとコマンド名のキーを追加 |

- 変更しないもの：データフォーマット（`parser.ts`）、`JotLineView.ts`、`CardView.svelte`、`GroupView.svelte`、`InputBar.svelte`。
- 履歴は `JotStore` のインスタンスが持つ。`JotLineView.setFile()` はファイルを開くたびに `JotStore` を作り直し、ビューを閉じると破棄するため、「ビューを閉じたら／別のファイルに切り替えたら履歴を破棄する」は追加の処理なしで満たされる。

## 構成とコンポーネント

### `UndoHistory`（`src/history.ts`）

文字列のスナップショットを持つ2本のスタック（undo / redo）。Obsidian にも Svelte にも依存しない。

- `record(before)`：操作の直前の内容を undo スタックに積み、redo スタックを空にする。100件を超えたら最も古いものを捨てる。
- `undo(current)`：undo スタックから1件取り出して返し、`current`（今の内容）を redo スタックに積む。空なら `null`。
- `redo(current)`：`undo` の逆。
- `canUndo` / `canRedo` / `clear()`。

### `JotStore` の変更（`src/store.ts`）

- **状態の追加**
  - `currentText: string`：最後に読み込んだ、または書き込んだファイル内容。
  - `history: UndoHistory`
  - `historyState: Writable<{ canUndo: boolean; canRedo: boolean }>`：ボタンの有効／無効の表示用。
  - `replacedCount: Writable<number>`：表示を置き換えた回数。アンドゥ／リドゥ／外部変更による読み直しのたびに1増やす。UI はこれを購読して選択を解除する。
  - `isApplying: boolean`：書き込み中に重ねてアンドゥ／リドゥを実行しないためのフラグ。
- **初回読み込み（`init()`）**：ファイルを読んで `currentText` に入れ、パースする。履歴には積まない。
- **JotLine の操作の保存（既存の `save()` を置き換え）**
  1. 現在のドキュメントをシリアライズして `after` とする。
  2. `after === currentText` なら何もしない（履歴にも積まず、書き込みもしない）。
  3. 書き込む（既存どおり `isSaving` を立てて `vault.modify`）。
  4. 書き込みに成功したら、`history.record(currentText)` してから `currentText = after` にする。
  - 既存の各操作メソッド（`addCard` など14個）は、最後に呼んでいる `save()` の中身が変わるだけで、メソッド自体は変更しない。これにより、1回の操作 = 1件の履歴になる。
- **外部変更（`modify` イベント）**
  1. 既存どおり、自己保存中（`isSaving`）は無視する。
  2. ファイルを読み、`newText === currentText` なら無視する（自己保存のイベントが遅れて届いた場合も、ここで無視される）。
  3. 異なれば `history.record(currentText)`（redo も破棄される）→ `currentText = newText` → パースして表示を更新 → `replacedCount` を1増やす。
- **アンドゥ／リドゥ（`undo()` / `redo()`）**
  1. `isApplying` 中、または履歴がなければ `false` を返す。
  2. `history.undo(currentText)`（または `redo`）でスナップショットを得る。
  3. スナップショットを書き込む（`isSaving` を立てて `vault.modify`）。
  4. 成功したら `currentText` を更新し、パースして表示を更新し、`replacedCount` を1増やす。
  5. 書き込みに失敗したら、手順2で動かしたスタックを元に戻す（エラー処理を参照）。
- 履歴が変わるたびに `historyState` を更新する。

### `App.svelte` の変更

- **ヘッダーのボタン**：既存の「📋 全件コピー」「📝 エディタ」の左に、アイコンのみのボタンを2つ置く（Lucide の `undo-2` / `redo-2` を既存の `use:icon` で描画）。`$historyState` に応じて `disabled` にする。
- **キー操作**：既存の `handleKeyDown`（Esc で選択解除）に次を追加する。IME 変換中（`isComposing`）は無視する。
  - アンドゥ：`(Ctrl または Cmd) + Z`（Shift なし）
  - リドゥ：`(Ctrl または Cmd) + Shift + Z`、または `Ctrl + Y`
  - 次の場合は処理しない（入力欄の標準動作に任せる）：
    - フォーカスが `.jotline-edit-container`（カード編集欄）、`.jotline-rename-box`（スレッド名編集欄）、`.jotline-reply-container`（返信欄）の中にある。
    - フォーカスがメイン入力欄（`.jotline-chat-input`）にあり、入力欄が空でない。
  - 処理した場合は `preventDefault()` と `stopPropagation()` を呼び、Obsidian 側のホットキー処理に渡さない。
- **選択の解除**：`store.replacedCount` を購読し、値が変わったら `clearSelection()` を呼ぶ（初回の値では呼ばない）。

### コマンド（`main.ts`）

- `jotline-undo` / `jotline-redo` を `addCommand` で登録する。既定のホットキー（`hotkeys`）は設定しない。
- `checkCallback` で、アクティブなビューが `JotLineView` で、かつ `canUndo`（`canRedo`）のときだけ実行可能にする。
- コマンド名は既存のコマンドと同じく i18n 辞書から取る。英語では「JotLine: Undo」「JotLine: Redo」、日本語では「JotLine: 元に戻す」「JotLine: やり直す」と表示される（「JotLine:」の部分は Obsidian が自動で付ける）。

## インタフェース

```ts
// src/history.ts
export const UNDO_HISTORY_LIMIT = 100;

export class UndoHistory {
	constructor(limit?: number);
	get canUndo(): boolean;
	get canRedo(): boolean;
	record(before: string): void;
	undo(current: string): string | null;
	redo(current: string): string | null;
	clear(): void;
}
```

```ts
// src/store.ts（追加分）
export class JotStore {
	historyState: Writable<{ canUndo: boolean; canRedo: boolean }>;
	replacedCount: Writable<number>;
	undo(): Promise<boolean>;
	redo(): Promise<boolean>;
	// 既存の save() は private な保存処理に置き換える（呼び出し側の各操作メソッドは変更なし）
}
```

i18n 辞書（`en` / `ja`）に追加するキー：

| キー | en | ja |
|---|---|---|
| `UNDO_TOOLTIP` | `Undo (Ctrl/Cmd+Z)` | `元に戻す (Ctrl/Cmd+Z)` |
| `REDO_TOOLTIP` | `Redo (Ctrl/Cmd+Shift+Z)` | `やり直す (Ctrl/Cmd+Shift+Z)` |
| `CMD_UNDO` | `Undo` | `元に戻す` |
| `CMD_REDO` | `Redo` | `やり直す` |

## データモデル

- ファイルのデータフォーマットは変更しない。
- 履歴はメモリ上のみ（`string[]` が2本）。1件はファイル全体のテキストで、最大100件 + redo 側。スクラッチパッドの規模（数十KB程度）なら、最大でも数MB程度に収まる。
- 履歴の1件を「ファイルのテキスト」にした理由：
  - 外部変更の前の状態を、パース・シリアライズで形を変えずにそのまま戻せる（マーカーのない通常のノートを JotLine で操作した場合も、操作前の元のテキストに正確に戻る）。
  - 戻すときは既存のパーサーで読み直すだけで済み、カードやグループの ID を履歴の前後で引き継ぐ必要がない（選択はアンドゥ／リドゥ時に解除するため、ID を保つ必要もない）。

## エラー処理

- **操作の保存に失敗した場合**：既存どおり Notice「JotLine: Failed to save file」を出す。履歴には積まず、`currentText` も更新しない（ファイルは操作前の内容のまま）。
- **アンドゥ／リドゥの書き込みに失敗した場合**：Notice を出し、取り出したスナップショットを元のスタックに戻して、`currentText` と表示も変えない（失敗前と同じ状態に戻す）。
- **連打・重ねての実行**：`isApplying` 中のアンドゥ／リドゥは無視する。
- **外部変更の読み込みに失敗した場合**：既存どおり Notice「JotLine: Failed to read file」を出す。履歴と `currentText` は変えない。

## テスト方針

- **`src/history.test.ts`**（AC2、AC4）
  - record → undo → redo の往復、undo / redo が空のときの `null`、新しい record での redo の破棄、上限を超えたときに古いものから捨てること（上限は小さい値で生成して確認し、既定値が100であることも確認する）。
- **`src/store.test.ts`**（AC1〜AC3）
  - `vi.mock("obsidian")` で `Notice` などをスタブにし、`vault.read` / `vault.modify` / `vault.on` / `vault.offref` を持つ偽の `App` と、偽の `TFile` で `JotStore` を動かす。偽の vault はファイル内容を文字列で保持する。
  - スコープに挙げた各操作について、「操作 → `undo()`」でファイル内容が操作前の文字列と一致し、「`redo()`」で操作後の文字列と一致することを確認する（AC1、AC2）。
  - マーカーのない通常のノートの内容から始めても、アンドゥで元のテキストに正確に戻ることを確認する。
  - 外部変更（偽の vault の内容を書き換えて `modify` イベントを発火）→ `undo()` で外部変更前の内容、`redo()` で外部変更後の内容に戻ること、外部変更でリドゥ履歴が破棄されることを確認する（AC3）。
  - 内容が変わらない操作（例：先頭カードの上移動）では履歴が増えないことを確認する。
  - `replacedCount` がアンドゥ／リドゥ／外部変更で増え、通常の操作では増えないことを確認する。
  - `isSaving` の300ms の解除待ちは、Vitest のフェイクタイマーで扱う。
- **Obsidian 上の手動確認**（AC5〜AC11）：キー操作、ボタン、コマンド、標準エディタへの反映、履歴の破棄、選択の解除。手順は tasks に書く。
- 既存のテスト（parser、tableConverter、i18n）は変更しない。

## 検討した代替案

| 案 | 内容 | 採用しなかった理由 |
|---|---|---|
| 操作ごとの逆操作（コマンドパターン） | 操作ごとに「元に戻す処理」を実装する | 14個の操作すべてに逆操作が必要で、実装とテストの量が大きく、漏れや不整合が起きやすい。外部変更も表せない |
| `JotDocument` オブジェクトのスナップショット | パース後のデータ（ID 付き）を複製して積む | カード ID を保てる利点はあるが、選択はアンドゥ時に解除する方針のため不要。外部変更の前の「元のテキスト」を正確に表せない（パース・シリアライズで形が変わる） |
| 差分（diff）だけを保存する | テキストの差分を積んでメモリを節約する | 実装が複雑になる割に、想定するファイル規模と上限100件ではメモリの問題がない |
| キー操作を Obsidian のホットキーとして登録（既定 Mod+Z） | コマンドに既定ホットキーを設定する | Obsidian のエディタの Mod+Z と競合し、ホットキー設定画面にも競合として表示される。プラグインのガイドラインでも既定ホットキーの設定は推奨されていない。ビュー内のキー処理と、既定ホットキーなしのコマンドの組み合わせにした |

### 実装時に確認すること

- ビュー内で処理した Ctrl/Cmd+Z が、Obsidian 本体のホットキー処理（エディタのアンドゥなど）に渡らないこと。`stopPropagation()` で足りない場合は、`keydown` をキャプチャ段階で受けるなどの対応を検討し、progress.md に記録する。
- Lucide アイコン `undo-2` / `redo-2` が、対象の Obsidian で表示されること（表示されない場合は `undo` / `redo` を使う）。
