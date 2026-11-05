# progress: 0008 文脈に応じた「マスター」「原本」への用語統一

<!-- 日付ごとに追記する。新しい日付を下に足す。 -->

## 2026-11-05

### 作業ログ

- マージ済みの main を取り込み、`feature/0008-replace-seihon-terminology` を作成した。
- requirements、design、tasks を順に作成し、各段階でユーザーの承認を得た。
- 管理元の候補として `/home/sasaki/workspace/20261103-094806-quiet-quartz/ai-dev-standard` を確認した。origin は `https://gitlab.sasaki819.mydns.jp/open/ai-dev-standard`。確認時点で管理元の VERSION と JotLine の `.ai-standard-version` はともに 0.1.2。実装時に再確認する。
- 全文書の承認が揃ったため、Item の status を ready にし、spec に本 Spec のパスを設定した。
- backlog-index で BACKLOG.md を再生成し、`bash tools/ai-standard/check-docs.sh` と `git diff --check` の成功を確認した。
- Task 1: Item を in-progress に更新し、BACKLOG.md を再生成した。管理元の origin、clean な作業ツリーと適用先の版を再確認し、管理元に `feature/0008-replace-seihon-terminology` を作成した。
- Task 1 棚卸し: 管理元は旧語を含む28行・15ファイル、JotLine は72行を確認した。管理元の README のリポジトリを指す用例は「マスター」、配布用スキルの生成元を指す用例は「原本」、設計文書・雛形・固定 Task・運用説明は「マスタードキュメント」または最新設計の「マスター」と分類した。管理元のテスト・スクリプトには旧語がなく、変更は不要だった。
- Task 1 棚卸し: JotLine 側は標準スキル・MR 雛形・AGENTS.md・文書・既存 Spec・Backlog の用例を確認した。全体の最新設計を指すものはマスタードキュメント、本 Item の旧語そのものに言及する説明は新しい表現または Unicode 表記に修正する対象として、Task 2 に引き継ぐ。
- Task 1 実装: 管理元の用語を更新し、AGENTS.md の配布用 payload に「マスター」「原本」の定義を追加した。VERSION を 0.1.3 に更新し、CHANGELOG に記録した。変更は用語修正15ファイルと版・変更履歴2ファイルの計17ファイル。
- Task 1 管理元コミット: `b87a4b7a5d80bbcff08606338edd0489eec8acd2`（ブランチ `feature/0008-replace-seihon-terminology`、版0.1.3）。push・タグ作成は行っていない。
- Task 1 検証: 管理元の共通旧語残存検査が成功（0件）、`bash tests/smoke.sh` は47件成功・失敗0件・スキップ1件、`git diff --check` が成功した。PowerShell が PATH 上にないため、bash／PowerShell 間の比較がスキップされた。JotLine の `bash tools/ai-standard/check-docs.sh` と `git diff --check` も成功した。

### 判断とその理由

- 唯一の本体・最新の基準は「マスター」、コピー・派生物の生成元は「原本」とする。`docs/architecture/` を指す名称は「マスタードキュメント」に統一する。
- 標準管理対象を配布先で直接編集せず、管理元を更新して sync する。更新と同期は別 Task に分け、管理元の変更コミットとの対応を記録する。
- 既存の記録と本 Item・本 Spec も対象に含め、意味や状態を維持して用語だけを修正する。旧語が説明や検証コードから再導入されないよう、必要な場合は Unicode の符号位置で表す。
- 用語の残存検索に加えて、雛形、BACKLOG.md の再生成、再同期、AGENTS.md のプロジェクト固有欄、スキル配布先の一致を検証する。
- Task 1 は承認済み design に従い、管理元の payload を更新した。配布先の標準管理対象は直接編集せず、管理元の版とコミットを固定して Task 2 の同期元とする。

### 中断点（次に何をすべきか）

- Task 1 は完了。次は Task 2「更新した標準を同期し、JotLine の既存資材を統一する」。管理元は上記パスの `b87a4b7a5d80bbcff08606338edd0489eec8acd2` を使用する。
- JotLine への sync は未実施で、適用版は0.1.2のまま。Task 2 以降と受入基準は未チェック。
