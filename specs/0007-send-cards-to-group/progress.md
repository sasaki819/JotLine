# progress: 0007 カードの右クリックメニューからグループへ移動する

<!-- 日付ごとに追記する。新しい日付を下に足す。 -->

Item 0007 の承認経緯と、カードの移動・グループ解除に関する判断を記録する。

## 2026-11-24

### 作業ログ

- マージ済みの `main` から `feature/0007-send-cards-to-group` を作成し、requirements、design、tasks を順に作成した。
- ユーザーが各文書を承認したため、Item を `ready` に更新し、Spec を関連付けた。
- Task 1 に着手し、Item の `status` を `in-progress` に更新して `BACKLOG.md` を再生成した。
- `src/parser.ts` に共通一括移動ヘルパーと `moveCardsToGroupInDoc()`、`dissolveGroupInDoc()` を実装し、`ungroupCards()` を末尾の未分類グループへ移動する仕様に更新した。
- `src/store.ts` に `moveCardsToGroup()` と `dissolveGroup()` を追加し、`ungroupSelectedCards()` を `applyChange()` 経由に切り替えた。
- `src/ui/GroupView.svelte` のスレッド解散ボタンを `store.dissolveGroup()` へ接続した。
- `src/parser.test.ts`、`src/store.test.ts`、`scripts/group-dissolve.test.mjs` を追加・更新し、`npm run build`、全116テスト、`npx tsc --noEmit`、`bash tools/ai-standard/check-docs.sh` が成功した。

### 判断とその理由

- メニューの日本語表示は「グループへ移動」とする。名前付きグループは表示順に並べ、「グループ解除」は区切り線で分ける。
- カードのグループ解除は、対象カードの並び順を維持してファイル末尾の未分類グループへ移す。末尾に未分類グループがない場合は作成する。スレッド解散はその場で名前を外す専用の操作とする。
- 複数カードの移動は一括で保存し、履歴を1件にまとめる。保存に失敗した場合は操作前の配置を復元する。
- サブメニューを提供する環境ではその機能を使う。未対応環境では、親項目のクリックで移動先を選べる子メニューを開く。
- 共通一括移動ヘルパーは元のモデルを変更せずに次状態のグループ配列を組み立て、グループ ID・グループ名・カード ID 列が一致する場合は `false` を返して保存と履歴を抑制する方式とした（部分更新や途中状態の残留を防ぐため）。
- `ungroupSelectedCards()` の成功通知は `applyChange()` が `true` を返した場合のみ表示するよう変更した（無変更や保存失敗時に通知を出さないため）。

### 中断点（次に何をすべきか）

- 次は Task 2「右クリックメニューに「グループへ移動」を追加する (after: 1)」。
