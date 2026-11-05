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
- Task 2 同期: 管理元が clean でコミット `b87a4b7a5d80bbcff08606338edd0489eec8acd2`・VERSION 0.1.3 であることを確認した。sync の dry-run で標準管理対象と版情報の18ファイルが変更予定であることを確認し、同じ管理元から sync した。JotLine の適用版は0.1.3になった。
- Task 2 同期検証: host=gitlab の配布対象33ファイル・領域が管理元と一致することを確認した。同期前の HEAD と比較して AGENTS.md の標準管理領域外が完全に保持され、`.agents/skills/` と `.claude/skills/` の対応ファイルが一致している。標準管理対象は直接編集していない。
- Task 2 資材修正: 同期後に残った43行の用例を確認し、プロジェクト所有の既存文書・Spec・作業記録・アーカイブ済み Item の19ファイルを分類どおり修正した。本 Item のタイトル・概要・受入基準は旧語を直接含まない表現にし、BACKLOG.md を再生成した。既存の19ファイルの差分が用語の置換のみであること、本 Item のタイトル以外の frontmatter が不変であることを機械的に照合した。
- Task 2 検証: 共通の旧語残存検査が成功（JotLine 全体で0件）、`bash tools/ai-standard/check-docs.sh` と `git diff --check` が成功した。アプリのコード・依存関係・ビルド設定に変更はなく、ビルド・単体テスト・型検査は再実行していない。
- Task 3 再同期: 管理元の HEAD が `b87a4b7a5d80bbcff08606338edd0489eec8acd2` で clean であることを確認し、sync の dry-run と実際の再同期を実施した。どちらも No files changed となり、追跡対象の全ファイルの SHA-256 比較でも再同期前後に変化がないことを確認した。
- Task 3 再生成: backlog-index を再実行し、同じく追跡対象の全ファイルの内容が不変であることを確認した。AGENTS.md のプロジェクト固有欄・版情報も不変で、両スキル配布先の一致を確認した。
- Task 3 雛形: 一時ディレクトリに Item と Spec 4種（requirements・design・tasks・progress）をコピーして ID・件名・日付を埋めた。旧語がなく、Item・tasks の固定 Task と design の注記が新しい用語であることを確認した。検証用の文書は実際の Backlog に登録していない。
- Task 3 最終検証: 管理元と JotLine で旧語残存検査が成功（各0件）、`bash tools/ai-standard/check-docs.sh` と `git diff --check` が成功した。Task 2 前のコミット `feabd72` と照合し、プロジェクト所有の既存文書・記録19ファイルが分類した用語置換以外は不変であることを再確認した。管理元の実行スクリプト・既存テストにも変更はない。
- マスタードキュメント反映 Task: `docs/architecture/README.md` の見出しと固定 Task 名、`docs/architecture/00.Overview.md` のドキュメントマップが、Task 2 のコミット `26e7007` で新しい用語に更新済みであることを確認した。AGENTS.md の用語定義とも一致し、追加反映は不要と判断した。
- マスタードキュメント反映 Task 検証: 共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check` が成功した。
- ADR 要否判断 Task: 新規 ADR は不要と判断した。用語の使い分けと管理元からの同期方針は requirements・design と標準の用語定義・運用文書で説明でき、独立したアーキテクチャ上の新規判断はない。
- ADR 要否判断 Task 検証: 共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check` が成功した。

#### Task 3 受入基準の照合

| 受入基準 | 確認結果 |
|---|---|
| AC1 | 管理元のリポジトリを示す語はマスター、配布用スキルの生成元は原本、最新設計はマスター／マスタードキュメントに分類。既存文書・記録の用語以外の内容を維持した。 |
| AC2 | 用語定義、固定 Task、手順、DoD、MR 雛形と既存文書をマスタードキュメントの呼称に統一した。 |
| AC3 | 管理元のコミットを固定して sync し、管理対象が配布元と一致。両リポジトリに旧語はない。 |
| AC4 | sync 前後の AGENTS.md 固有欄を保持し、再同期でもファイル不変。対応する両スキル配布先が一致した。 |
| AC5 | Git 管理対象全体を隠しパス・本 Item・本 Spec・既存記録を除外せず検索し、旧語0件を確認した。 |
| AC6 | Item 更新後の生成済み一覧を再生成しても不変。雛形からの一時作成と再同期で旧語の再導入がない。 |
| AC7 | check-docs が成功した。 |

### 判断とその理由

- 唯一の本体・最新の基準は「マスター」、コピー・派生物の生成元は「原本」とする。`docs/architecture/` を指す名称は「マスタードキュメント」に統一する。
- 標準管理対象を配布先で直接編集せず、管理元を更新して sync する。更新と同期は別 Task に分け、管理元の変更コミットとの対応を記録する。
- 既存の記録と本 Item・本 Spec も対象に含め、意味や状態を維持して用語だけを修正する。旧語が説明や検証コードから再導入されないよう、必要な場合は Unicode の符号位置で表す。
- 用語の残存検索に加えて、雛形、BACKLOG.md の再生成、再同期、AGENTS.md のプロジェクト固有欄、スキル配布先の一致を検証する。
- Task 1 は承認済み design に従い、管理元の payload を更新した。配布先の標準管理対象は直接編集せず、管理元の版とコミットを固定して Task 2 の同期元とする。
- Task 2 では、過去の記録も承認済みの対象範囲に従って用語だけを修正した。旧語自体に言及していた本 Item は Unicode の符号位置で説明し、タイトルを「プロジェクト資材の用語を『マスター』『原本』に統一する」という内容に改めた。ID・slug・状態は維持した。
- Task 3 は既存の生成・同期コマンドと一時的な検証処理で確認し、新規の用語検査ツールは追加しなかった。受入基準7項目を確認済みとして requirements に記録した。
- マスタードキュメント反映 Task: 今回は用語のみの変更で、アプリの構成・データ形式・UI 操作・ビルドやリリースの仕様は変わらない。対象の見出し・参照名は Task 2 で反映済みであり、追加の設計記述は不要。用語の定義と標準の同期手順は AGENTS.md・標準の運用文書に集約し、アプリの設計文書へ重複して追加しない。
- ADR 要否判断 Task: 「マスター」「原本」の使い分けは用語整理であり、アプリの機能・データ形式・公開 API・責務分担を変更しない。標準管理対象の更新にも既存の manifest と sync を利用し、新たな同期経路・検査ツール・依存関係は導入していない。従来の設計判断を変える変更がないため、新規 ADR や既存 ADR の状態変更は不要。

### 中断点（次に何をすべきか）

- tasks.md の全 Task と受入基準7項目が完了。次の工程は、別コンテキストでの AI レビュー。Item の完了処理はまだ行っていない。
- JotLine の適用版は0.1.3、管理元は上記コミットのまま。両リポジトリとも push は未実施。
