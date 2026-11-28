---
id: 20261019-143004-ticket-dnd-between-jotline-and-notes
title: D&D によるカードとノート間の移動機能を追加する
status: done
created: 2026-10-19 14:30:04
updated: 2026-10-21 07:37:16
phase: closing
phase_status: done
branch: item/0004-dnd-between-jotline-and-notes
parent: null
children: []
discussions: []
adrs:
  - 20261020-090000-adr-dnd-editor-integration
---
# D&D によるカードとノート間の移動機能を追加する

## 概要

旧管理番号: Item 0004

JotLine ビューと Markdown ノート（Obsidian の標準エディタ）の間で、ドラッグ＆ドロップによって内容を移動できるようにする。

1. **JotLine → ノート**：JotLine のカード（単体・複数選択・スレッド単位）をエディタへドラッグし、ドロップ位置にマーカーなしの Markdown として挿入する。移動の場合は JotLine 側からカードを削除する（「Markdown としてコピーして貼り付け、元を削除」と同等の操作）。
2. **ノート → JotLine**：エディタで範囲選択した Markdown を JotLine ビューへドラッグし、ドロップ位置にカードとして追加する。移動の場合は元のノートから選択範囲を削除する。

## AC（受け入れ条件）

* [x] JotLine のカード単体・複数選択したカード・スレッド（グループ）を、エディタ（ソースモード／ライブプレビュー）の任意の位置へドラッグ＆ドロップで挿入できる。挿入される内容は既存の Markdown コピーと同じ（マーカーを含まない）。
* [x] エディタで選択した Markdown を、JotLine ビューのタイムライン上（グループ内のカード位置またはグループ末尾）へドロップしてカードにできる。
* [x] 移動（元を削除する）とコピー（元を残す）の区別と操作方法が定められ、そのとおりに動作する。
* [x] 移動で元のデータを削除した場合も、アンドゥで元に戻せる（Item 0003 のアンドゥ機能と連携する）。
* [x] ドロップ元とドロップ先が同じファイルの場合に、データが失われたり重複・破損したりしない（移動を禁止するなどの扱いを定める）。
* [x] 移動の処理は「挿入してから削除」の順で行い、途中で失敗してもデータが失われない。
* [x] JotLine 内での既存のカード並び替え（D&D）と、入力バーへの画像ファイルのドロップは、これまでどおり動作する。
* [x] 既存の操作の挙動、データフォーマット、`npm run build` / `npm test` / lint の成功を維持する。

## DoR（着手合意）

* **任せる範囲**：旧 `ai-dev-standard` 運用下で着手・完了済み
* **未決事項**：なし
* **着手合意**：合意済み（完了・アーカイブ済み）

## 現在地

* **状況**：完了・アーカイブ済み（`ai-dev-standard` から AIco へ移行）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：なし

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

| 種別 | パス |
| :--- | :--- |
| `M` | `README.md` |
| `M` | `docs/architecture/01.Architecture.md` |
| `M` | `docs/architecture/03.UI-UX-Specification.md` |
| `M` | `docs/architecture/04.Non-Functional.md` |
| `M` | `docs/architecture/README.md` |
| `M` | `manifest.json` |
| `A` | `src/dnd.test.ts` |
| `A` | `src/dnd.ts` |
| `M` | `src/i18n/locales/en.ts` |
| `M` | `src/i18n/locales/ja.ts` |
| `M` | `src/main.ts` |
| `M` | `src/parser.test.ts` |
| `M` | `src/parser.ts` |
| `M` | `src/store.test.ts` |
| `M` | `src/store.ts` |
| `M` | `src/ui/App.svelte` |
| `M` | `src/ui/CardView.svelte` |
| `M` | `src/ui/GroupView.svelte` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：JotLine ↔ ノート間および別ファイルの JotLine ビュー間の D&D 移動・コピーを実装し、単体テスト・Obsidian 実機確認・AI レビュー指摘2件（R1/R2）の修正および実機確認まで完了。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：反映済み（`docs/architecture/01.Architecture.md`、`03.UI-UX-Specification.md`、`04.Non-Functional.md`、`docs/architecture/README.md`、`README.md`）。
* **ADR の要否判断**：作成済み（[20261020-090000-adr-dnd-editor-integration](../../../03.adr/20261020-090000-adr-dnd-editor-integration.md)）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0004（元ファイル: `backlog/archive/0004-dnd-between-jotline-and-notes.md`）
* 作業計画（旧 `requirements.md`・`tasks.md`）: [plan.md](plan.md)
* 設計詳細（旧 `design.md`）: [notes/001-design.md](notes/001-design.md)
* 作業ログ・判断履歴（旧 `progress.md`）: [notes/002-progress.md](notes/002-progress.md)
* レビュー記録: [review/index.md](review/index.md)
* 関連 ADR: [20261020-090000-adr-dnd-editor-integration](../../../03.adr/20261020-090000-adr-dnd-editor-integration.md)

### 旧 Item メモ

- 規模が大きいため Spec を作成して進める（new-spec）。
- **Item 0003（アンドゥ／リドゥ）の完了後に着手する**。JotLine 側の削除を戻せない状態で移動を入れると、エディタ側だけ Ctrl+Z で戻した場合などにデータが失われるため。
- 2026-10-14 の技術評価（会話での検討、コードと API 定義の確認のみで実機での試作は未実施）の要点:
  - JotLine → ノート：ドラッグ時に `text/plain` で Markdown を渡せば、エディタ（CodeMirror 6）がドロップ位置へ挿入する。ドロップの受理は公開 API の `workspace.on('editor-drop')` で検知でき、ドロップ先のファイルも分かる。`editor-drop` は Obsidian 1.1.0 以降のため、使う場合は `manifest.json` の `minAppVersion`（現在 1.0.0）を上げる。
  - ノート → JotLine：エディタからのドラッグでは選択範囲の Markdown ソースが `text/plain` で渡される。CodeMirror 6 は自分自身へのドロップ時しか元のテキストを削除しないため、外部へのドロップは常にコピーになる。移動にするには、JotLine 側で元のエディタの選択範囲を削除する必要がある（ドラッグ開始時にエディタと範囲を記録するのが確実）。
  - 既存の並び替え用 D&D と区別するため、JotLine 専用のデータ形式（MIME タイプ）を定める。
  - 同じファイルを両側で開いている場合、JotLine の全体上書き保存とエディタの遅延保存が衝突するおそれがある。
  - 読み取りビューからのドラッグは表示用テキストになり Markdown の書式が失われるため、対象外とする想定。
  - モバイル（タッチ操作）では HTML5 の D&D が動作しないため、デスクトップ限定の機能になる。
- Spec で決めること（候補）：移動とコピーの切り替え方法（例：既定はコピーで修飾キー付きで移動）、ドロップ位置のハイライト、複数カードをドラッグするときの表示、ポップアウトウィンドウへの対応範囲。
