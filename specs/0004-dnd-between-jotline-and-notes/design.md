# design: 0004 D&D によるカードとノート間の移動機能を追加する

> これは本 Item による変更分の設計であり、全体のマスターは docs/architecture/ にある。
> Item 完了時に、この内容を docs/architecture/ へ反映する。

## 変更の概要

- **ドラッグ中の情報（ドラッグセッション）を1か所で持つ**：新しいモジュール `src/dnd.ts` に、「今ドラッグされているものが何か」（JotLine のカード群／スレッド／エディタの選択テキスト、元のファイル、元の削除に必要な情報）を保持する。全ビューが同じ JavaScript 環境で動くため、モジュール内の1つの変数で共有できる。
  - JotLine のカード・スレッド：`CardView` / `GroupView` の `dragstart` で開始し、`dragend` で終了する。
  - エディタの選択テキスト：プラグインが `document` の `dragstart` を監視し、ドラッグがエディタ（`MarkdownView`）の中で始まったときに、エディタ・選択範囲・テキストを記録する。
- **どこにも依存しないテキストも渡す**：JotLine からのドラッグでは、`text/plain` に「既存の Markdown コピーと同じテキスト」を入れる。エディタやメイン入力欄は、これを標準の動作で挿入する。
- **ドロップ先ごとの処理**
  - エディタ：Obsidian の公開 API `workspace.on("editor-drop")` で受ける。挿入そのものはエディタ（CodeMirror 6）の標準動作に任せ、移動の場合は挿入を確かめてから JotLine 側のカードを削除する。同じファイルならドロップを止める。
  - JotLine ビュー（`GroupView`）：ドラッグセッションを見て、別ファイルからならカード・スレッドを追加し、移動の場合は元を削除する。同じビューの中なら、既存の並び替えのまま。
  - メイン入力欄：コードを追加しない（`text/plain` を、テキスト入力欄の標準動作で挿入する。元は削除しない）。
- **JotLine 側の追加・削除は、すべて `JotStore` のメソッドを通す**。これにより、Item 0003 の保存処理を通って、1回の追加・削除がそれぞれ1件のアンドゥ履歴になる（ADR 0001）。
- 移動は「ドロップ先へ追加 → 成功を確かめる → 元を削除」の順で行う。

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `src/dnd.ts`（新規） | ドラッグセッションの型と保持、修飾キーの判定、ドラッグで渡すテキストの組み立て、データ形式（MIME タイプ）の定数 |
| `src/dnd.test.ts`（新規） | `dnd.ts` の単体テスト |
| `src/parser.ts` | ドキュメント操作の純粋関数を追加（指定位置へのカード挿入、指定グループの直後へのスレッド挿入、カードの一括削除） |
| `src/parser.test.ts` | 追加した純粋関数のテスト |
| `src/store.ts` | `insertCards()`、`insertThreadAfter()`、`removeCards()`、`removeGroup()` を追加。内部の `save()` が成功・失敗を返すようにする |
| `src/store.test.ts` | 追加したメソッドのテスト（アンドゥ、失敗時の扱いを含む） |
| `src/ui/CardView.svelte` | ドラッグ開始時に、ドラッグセッションの開始と `text/plain` の設定を追加。複数選択中は選択中の全カードを対象にする |
| `src/ui/GroupView.svelte` | スレッドヘッダーをドラッグ可能にする。ドロップ時に、ドラッグセッションに応じた処理（別ファイルからの追加・移動、同じファイルの禁止、同じビュー内の既存の並び替え）を追加 |
| `src/ui/App.svelte` | ドラッグ対象のカード ID 一覧（複数選択の考慮）を `CardView` に渡す。存在しなくなったカードを選択から外す |
| `src/main.ts` | `editor-drop` の処理と、エディタからのドラッグ開始の監視（`document` の `dragstart` / `dragend`）を登録 |
| `src/i18n/locales/en.ts`、`ja.ts` | 通知文のキーを追加 |
| `manifest.json` | `minAppVersion` を `1.0.0` から `1.1.0` に上げる（`editor-drop` が 1.1.0 以降の API のため） |

- 変更しないもの：データフォーマット、`InputBar.svelte`（メイン入力欄へのドロップは標準動作のまま。画像ファイルのドロップ処理も変更しない）、`JotLineView.ts`、`LinkSuggest.svelte`。

## 構成とコンポーネント

### ドラッグセッション（`src/dnd.ts`）

```ts
type DragSource =
	| { kind: "cards"; store: JotStore; filePath: string; cardIds: string[]; text: string; contents: string[] }
	| { kind: "thread"; store: JotStore; filePath: string; groupId: string; name: string; text: string; contents: string[] }
	| { kind: "editor"; editor: Editor; filePath: string; from: EditorPosition; to: EditorPosition; text: string };
```

- `text`：ドロップ先がエディタ・メイン入力欄の場合に挿入されるテキスト。JotLine 側は `exportToPureMarkdown()` の結果（既存の Markdown コピーと同じ）、エディタ側は選択範囲のテキスト。
- `contents`：別の JotLine ビューへ追加するときの、カードごとの本文。
- `startDrag(source)` / `endDrag()` / `getDragSource()` で操作する。
- `isCopyDrop(event)`：ドロップ時の修飾キーで、コピーかどうかを判定する（macOS は `altKey`（Option）、それ以外は `ctrlKey`）。OS の判定は引数で受け取り、テストしやすくする（呼び出し側は Obsidian の `Platform.isMacOS` を渡す）。
- データ形式の定数 `JOTLINE_DRAG_MIME = "application/x-jotline-drag"`：JotLine からのドラッグであることを示す目印。中身はセッション側に持ち、ここには入れない（`dragover` の時点では中身を読めないため、種類の判定にだけ使う）。

### JotLine からのドラッグ開始（`CardView` / `GroupView`）

- **カード**（`CardView` の `dragstart`）
  - 対象のカード ID 一覧を `App` から受け取る関数で求める：ドラッグしたカードが選択中で、選択が2枚以上なら、選択中の全カード（ドキュメント上の並び順）。それ以外はドラッグしたカード1枚。
  - `dataTransfer` に次を設定する：既存の並び替え用の `application/json`（変更なし）、`JOTLINE_DRAG_MIME`、`text/plain`（`text`）。`effectAllowed` は `copyMove`。
  - `startDrag({ kind: "cards", ... })`。`dragend` で `endDrag()`。
- **スレッド**（`GroupView` のスレッドヘッダー）
  - ヘッダーを `draggable` にする（スレッド名の編集中は無効）。
  - `JOTLINE_DRAG_MIME` と `text/plain`（スレッドのカード本文。既存のスレッドコピーと同じ）を設定し、`startDrag({ kind: "thread", ... })`。並び替え用の `application/json` は設定しない。

### エディタからのドラッグ開始（`main.ts`）

- `registerDomEvent(document, "dragstart", ..., { capture: true })` で監視する。
- ドラッグの起点を含む `MarkdownView` を探し（`workspace.getLeavesOfType("markdown")` の各ビューの `containerEl` で判定）、エディタのモードがソース／ライブプレビューで、選択範囲が空でなければ、`editor.getCursor("from")` / `getCursor("to")` / `getRange()` で範囲とテキストを記録し、`startDrag({ kind: "editor", ... })`。
- 読み取りビューからのドラッグ、空の選択（リンクやファイルのドラッグなど）は記録しない。
- `document` の `dragend` で `endDrag()`。

### エディタへのドロップ（`main.ts`、`workspace.on("editor-drop")`）

1. セッションが JotLine 由来（`cards` / `thread`）でなければ何もしない（エディタ同士のドラッグなど、既存の動作のまま）。
2. ドロップ先のファイル（`info.file`）がセッションの `filePath` と同じなら、`evt.preventDefault()` で挿入を止め、同じファイルにはドロップできない旨を通知する。
3. それ以外は、挿入はエディタの標準動作（`text/plain` の挿入）に任せる。
4. 移動（`isCopyDrop` が false）なら、セッションの内容を退避してから、次のタイミング（`setTimeout(0)`、エディタの挿入処理が終わった後）で：
   - ドロップ先のエディタの内容に、挿入されたはずのテキスト（`text`）が含まれていることを確かめる。
   - 含まれていれば、元の JotLine ビューから削除する（`cards`：`store.removeCards(cardIds)`、`thread`：`store.removeGroup(groupId)`）。
   - 含まれていない、または削除に失敗した場合は、元を削除しない（または削除できなかった）旨を通知する。

### JotLine ビューへのドロップ（`GroupView` の `drop`）

ドロップ位置は既存どおり、カードの上ならそのカードの位置（`index`）、グループの余白ならグループの末尾。

| セッション | 条件 | 処理 |
|---|---|---|
| `cards` / `thread` | 元のストアがこのビューのストア | 既存の並び替え（`application/json` の1枚）。`thread` は何もしない |
| `cards` / `thread` | 元のファイルがこのビューのファイルと同じ（別ビュー） | 何もせず、同じファイルにはドロップできない旨を通知 |
| `cards` | 別ファイル | `insertCards(group.id, index, contents)` → 成功かつ移動なら、元の `store.removeCards(cardIds)` |
| `thread` | 別ファイル | `insertThreadAfter(group.id, name, contents)` → 成功かつ移動なら、元の `store.removeGroup(groupId)` |
| `editor` | 元のファイルがこのビューのファイルと同じ | 何もせず、同じファイルにはドロップできない旨を通知 |
| `editor` | 別ファイル、かつドロップされた `text/plain` がセッションの `text` と一致 | `insertCards(group.id, index, [text])` → 成功かつ移動なら、元のエディタから削除（下記） |
| なし（他アプリからのテキストなど） | — | 何もしない（スコープ外） |

- エディタからの削除：`editor.getRange(from, to)` がまだ `text` と一致することを確かめてから、`editor.replaceRange("", from, to)` で削除する。エディタの編集として行うので、エディタのアンドゥで戻せる。一致しない場合（ドラッグ中に内容が変わったなど）は削除せず、削除できなかった旨を通知する。
- 元の JotLine ビューの削除に失敗した場合も、同じく通知する。

### `JotStore` の追加メソッド（`src/store.ts`）

- `insertCards(groupId, index, contents): Promise<boolean>`：指定グループの指定位置に、本文ごとにカードを追加して保存する。
- `insertThreadAfter(afterGroupId, name, contents): Promise<boolean>`：指定グループの直後に、指定名のスレッドを追加して保存する。
- `removeCards(cardIds): Promise<boolean>`：指定カードを削除して保存する（カードが0枚になったスレッドは削除。既存の `deleteMultipleCards` と同じ規則だが、通知を出さず、結果を返す）。
- `removeGroup(groupId): Promise<boolean>`：指定グループをカードごと削除して保存する（既存の `deleteGroup` と同じ処理で、結果を返す）。
- いずれも、対象が見つからず内容が変わらない場合は `false` を返す。保存は内部の `save()` を通すため、1回の呼び出しが1件のアンドゥ履歴になる。
- 内部の `save()` は、保存した（`true`）／書き込みに失敗した（`false`）／内容が変わらず何もしなかった（`"unchanged"`）を返すように変更する。既存の操作メソッドは戻り値を使わないため、動作は変わらない。

### 選択の扱い（`App.svelte`）

- `CardView` に、ドラッグ対象のカード ID 一覧を求める関数（`getDragCardIds(cardId)`）を渡す。
- `$doc` が変わったら、存在しなくなったカード ID を選択から外す。移動で元のビューからカードが削除されたときに、古い選択と選択バーが残らないようにするため。

## インタフェース

```ts
// src/dnd.ts
export const JOTLINE_DRAG_MIME = "application/x-jotline-drag";
export type DragSource = /* 上記 */;
export function startDrag(source: DragSource): void;
export function endDrag(): void;
export function getDragSource(): DragSource | null;
export function isCopyDrop(event: { ctrlKey: boolean; altKey: boolean }, isMacOS: boolean): boolean;

// src/parser.ts（追加）
export function insertCardsInDoc(doc: JotDocument, groupId: string, index: number, contents: string[]): boolean;
export function insertGroupAfterInDoc(doc: JotDocument, afterGroupId: string, name: string, contents: string[]): boolean;
export function removeCardsFromDoc(doc: JotDocument, cardIds: string[]): boolean;

// src/store.ts（追加）
insertCards(groupId: string, index: number, contents: string[]): Promise<boolean>;
insertThreadAfter(afterGroupId: string, name: string, contents: string[]): Promise<boolean>;
removeCards(cardIds: string[]): Promise<boolean>;
removeGroup(groupId: string): Promise<boolean>;
```

i18n 辞書（`en` / `ja`）に追加するキー：

| キー | en | ja |
|---|---|---|
| `NOTICE_DROP_SAME_FILE` | `Cannot drop onto the same file` | `同じファイルにはドロップできません` |
| `NOTICE_MOVE_SOURCE_NOT_REMOVED` | `Copied, but could not remove the original` | `コピーしましたが、元の内容を削除できませんでした` |
| `NOTICE_DROP_INSERT_UNCONFIRMED` | `Could not confirm the insertion; the original was kept` | `挿入を確認できなかったため、元の内容は残しました` |

## データモデル

- ファイルのデータフォーマットは変更しない。
- 追加するカード・スレッドは、既存と同じ `JotCard` / `JotGroup`（ID はその時点で採番）。本文は前後の空白を除いたもの（既存のカードと同じ）。
- スレッドを別の JotLine ビューへ移したときのスレッド名は、元のスレッド名をそのまま使う（同名のスレッドが既にあっても、別のスレッドとして追加する）。

## エラー処理

- **ドロップ先への追加に失敗した場合**（JotLine 側の書き込み失敗）：既存どおり「Failed to save file」を通知し、元は削除しない。
- **エディタへの挿入を確かめられない場合**：元は削除せず、`NOTICE_DROP_INSERT_UNCONFIRMED` を通知する。
- **元の削除に失敗した場合**（JotLine 側の書き込み失敗、対象のカードが見つからない、エディタの元の範囲の内容が変わっていた／エディタが閉じられた）：`NOTICE_MOVE_SOURCE_NOT_REMOVED` を通知する。ドロップ先には追加された内容が残る（重複はしても失われない）。
- **同じファイル**：何もせず `NOTICE_DROP_SAME_FILE` を通知する。
- **ドラッグセッションが残ってしまった場合**（`dragend` が来なかったなど）：次の `dragstart` で上書きされる。ドロップ時には、`text/plain` がセッションの `text` と一致する場合だけセッションを使うことで、古いセッションを誤って使わないようにする。

## テスト方針

- **`src/parser.test.ts`**：`insertCardsInDoc`（先頭・途中・末尾、存在しないグループ）、`insertGroupAfterInDoc`（直後への挿入、存在しないグループ）、`removeCardsFromDoc`（空になったスレッドの削除、未分類グループは残す、存在しない ID）。
- **`src/store.test.ts`**：`insertCards` / `insertThreadAfter` / `removeCards` / `removeGroup` について、ファイル内容の変化、1回の呼び出しが1件の履歴になりアンドゥで元に戻ること、書き込み失敗時に `false` を返し履歴に積まれないこと、対象がない場合に `false` を返すこと（AC4、AC7、AC8 の JotLine 側）。
- **`src/dnd.test.ts`**：`isCopyDrop`（macOS とそれ以外での修飾キーの判定）、ドラッグセッションの開始・取得・終了。
- **Obsidian 上の手動確認**（AC1〜AC9）：エディタとの間、別の JotLine ビューとの間、メイン入力欄、同じファイルの禁止、アンドゥ、既存の並び替えと画像ドロップ。手順は tasks に書く。
- 既存のテストは変更しない（追加のみ）。

## 検討した代替案

| 案 | 内容 | 採用しなかった理由 |
|---|---|---|
| エディタへの挿入を自前で行う | `editor-drop` で `preventDefault()` し、ドロップ座標から挿入位置を求めて `replaceRange` で挿入する | 座標から位置を求めるには、公開 API にない CodeMirror の内部（`editor.cm.posAtCoords`）を使う必要がある。エディタ標準の挿入に任せ、挿入後の内容で成功を確かめる方式にした |
| 移動の確定を `dragend` の `dropEffect` で判断する | ドラッグの元で、ドロップ先が受け入れたかを `dropEffect` で知る | ドロップ先（エディタ）が `dropEffect` をどう設定するかに依存し、確実でない。ドロップ先の処理の中で、追加の成功を確かめてから削除する方式にした |
| ドラッグの中身を `dataTransfer` に JSON で入れる | 元のファイルやカードの情報をすべて転送データに入れる | 元の `JotStore` やエディタへの参照は転送データに入れられず、削除のために結局ビューを探す必要がある。同じ JavaScript 環境内なので、モジュールの変数で共有する方が単純 |
| エディタの挿入の確認に位置まで使う | 挿入されたはずの位置にテキストがあるかを調べる | 位置の特定に CodeMirror の内部が必要になる。「エディタの内容に含まれるか」で確かめる。もともと同じテキストがノートにあった場合は誤って成功とみなすが、その場合もノートにはその内容が存在するため、データは失われない |
| 同じファイルへのドロップをドラッグ中に禁止表示にする | `dragover` で `dropEffect = "none"` にする | JotLine 側は可能だが、エディタ側ではドラッグ中の表示を制御できず、両側で動作がそろわない。ドロップ時に通知する方式に統一した |

### 実装時に確認すること

- `editor-drop` で `preventDefault()` しなかった場合に、エディタが `text/plain` をドロップ位置へ挿入すること、および `setTimeout(0)` の時点で挿入が完了していること。
- `preventDefault()` で、同じファイルへの挿入が止まること。
- Windows / Linux で Ctrl、macOS で Option を押しながらドロップしたときに、ドロップの `DragEvent` で修飾キーが取れること。
- `document` の `dragstart`（キャプチャ段階）で、エディタからのドラッグを検知でき、その時点でエディタの選択範囲が取れること。
