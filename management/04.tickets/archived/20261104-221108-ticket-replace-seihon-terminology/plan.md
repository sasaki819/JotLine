# 作業計画

## 合意した仕様

### 背景

システム全体の最新設計を示す文書や開発手順に、用語統一の対象となる旧語（Unicode: U+6B63 U+672C）が使われている。同じ語は ai-dev-standard から配布される雛形・スキルにも含まれ、そのままでは新しい文書にも引き継がれる。

### 目的

唯一の本体・最新の基準となる文書などを「マスター」、派生物を作成する元の資料を「原本」と呼ぶ。プロジェクト資材全体でこの使い分けを統一し、新しい文書の作成や標準の同期によって旧語が再導入されないようにする。

### スコープ

- プロジェクトが保守するテキスト資材全体。通常の文書に加え、隠しディレクトリ内のスキル・テンプレート・設定・スクリプト・ソースのコメントなども対象とする。
- 既存の Spec、progress、Review、Discussion、ADR、Backlog の未完了・アーカイブ済み Item。本 Item と本 Spec 自身も対象に含める。
- AGENTS.md の用語定義、固定 Task の名前、DoD、開発手順、雛形、MR テンプレートなどの関連表現。
- 標準管理対象は管理元の ai-dev-standard を更新したうえで sync で反映する。プロジェクト所有の資材は本プロジェクトで修正する。
- BACKLOG.md など、自動生成する資材への反映。

### スコープ外

- 文言以外の機能・保存形式・開発工程・Review の状態遷移の変更。
- Git の過去のコミット内容の書き換え。
- 外部依存ライブラリ、キャッシュなど、プロジェクトが保守しない資材の変更。

### 受入基準

- [x] AC1: 旧語の各使用箇所を文脈に応じて修正し、唯一の本体・最新の基準を指す場合は「マスター」、派生物の生成元を指す場合は「原本」とする。文書の意味と、完了済み Task・Review などの状態を維持する。
- [x] AC2: `docs/architecture/` を指す用語を「マスタードキュメント」に統一し、用語定義・固定 Task 名・説明・DoD・MR チェックリストの表現も一致させる。
- [x] AC3: `tools/ai-standard/manifest.txt` の管理対象は ai-dev-standard の管理元で修正し、sync で反映する。標準管理対象をプロジェクト側で直接編集しない。管理元と同期後の対象資材の両方に旧語が残っていないことを確認する。
- [x] AC4: AGENTS.md のプロジェクト固有欄（ブランチ運用など）を sync 後も維持し、`.agents/skills/` と `.claude/skills/` の対応する内容が一致する。
- [x] AC5: Git 管理対象のテキスト資材を隠しパスも含めて検索し、旧語が0件である。本 Item・本 Spec・既存の記録も検索対象から除外しない。
- [x] AC6: Item の変更後は backlog-index で BACKLOG.md を再生成する。雛形から作成する文書と、更新した標準を再度 sync した結果にも旧語が再導入されない。
- [x] AC7: `bash tools/ai-standard/check-docs.sh` が成功する。

### 関連

- Item: [backlog/archive/0008-replace-seihon-terminology.md](index.md)
- Discussion: なし
- ADR: なし
- 標準管理範囲: `tools/ai-standard/manifest.txt`（AIco 移行時に削除）
- 同期手順: `docs/ai-dev-standard-process.md`（AIco 移行時に削除）

## ステップ一覧

<!--
- 1 Task はおおむね1セッションで完結する粒度にする。
- 各 Task に「完了条件」と「検証コマンド」を書く。
- 依存関係がある場合は Task 名の末尾に (after: 2) のように書く。
- 検証コマンドが成功した場合だけチェックを入れる。
- 末尾の2つの固定 Task は削除しない。
-->

### 共通の検証コマンド

旧語残存検査は、対象リポジトリのルートで次を実行する。新規文書も検査するため、最終確認では今回追加したファイルを Git の index に含める。終了コード0を成功とし、旧語の残存と検索エラーは失敗にする。旧語自体を検証コードや記録に書き戻さない。

```bash
python3 -c 'import subprocess; r = subprocess.run(["git", "grep", "-nI", "-F", "-e", chr(0x6B63) + chr(0x672C), "--", "."]); raise SystemExit(0 if r.returncode == 1 else 1)'
```

以下の `<管理元>` と `<JotLine>` は、実装時に確認したリポジトリのルートパスとする。管理元の候補と origin は design.md に記載している。

### Task

- [x] 1. ai-dev-standard の管理元の用語を統一する
  - 完了条件: 管理元・適用先のバージョン、作業ツリー、origin を確認し、管理元も専用の feature ブランチで作業している。両リポジトリの用例を文脈ごとに分類し、管理元の配布用 payload・雛形・スキル・README・テストなどの旧語を「マスター」または「原本」に修正している。VERSION をパッチ更新して CHANGELOG に記録し、管理元の旧語残存検査と smoke テストが成功している。管理元の変更をコミットし、対象ブランチ、版、コミット ID、分類結果と検証結果を JotLine の progress.md に記録している。JotLine の標準管理対象の更新は Task 2 で sync によって行う。
  - 検証コマンド: 管理元で共通の旧語残存検査、`bash tests/smoke.sh`、`git diff --check`。JotLine で `bash tools/ai-standard/check-docs.sh`。smoke 内で実行できず SKIP になった環境があれば progress.md に記録する。
- [x] 2. 更新した標準を同期し、JotLine の既存資材を統一する (after: 1)
  - 完了条件: 同期前に AGENTS.md のプロジェクト固有欄を比較できる形で保持し、sync の dry-run で用語と版情報以外の変更がないことを確認してから同期している。JotLine の標準管理対象を直接編集していない。プロジェクト所有の文書・既存の記録・本 Item・本 Spec を含めて用語を統一し、既存の日付・ID・状態・チェック・コミット ID・技術的な判断内容を維持している。Item の更新後は BACKLOG.md を再生成し、Git 管理対象のテキストで旧語が0件である。AGENTS.md のプロジェクト固有欄と両方のスキル配布先も確認し、同期元のコミット ID と差分の確認結果を progress.md に記録している。
  - 検証コマンド: `bash <管理元>/sync.sh <JotLine> --dry-run`、`bash <管理元>/sync.sh <JotLine>`、`bash tools/ai-standard/backlog-index.sh`、共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。同期前後の AGENTS.md の標準管理領域外と、manifest に対応する両スキル配布先を比較する。
- [x] 3. 雛形・再生成・再同期で用語が維持されることを確認する (after: 2)
  - 完了条件: 更新後の Item・Spec の雛形を一時ディレクトリにコピーし、新しい用語で文書を作成できることを確認している。同じ管理元から再同期し、管理対象と版情報に新たな差分が出ず、AGENTS.md のプロジェクト固有欄とスキルの一致が維持されている。BACKLOG.md を再生成しても差分が増えず、管理元と JotLine の双方で旧語残存検査が成功している。文脈ごとの分類と最終差分を照合して AC1〜AC7 の結果を progress.md に記録している。
  - 検証コマンド: `bash <管理元>/sync.sh <JotLine> --dry-run`、`bash <管理元>/sync.sh <JotLine>`、`bash tools/ai-standard/backlog-index.sh`、両リポジトリで共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。雛形の一時コピーは Python などで対象文字列がないことを検査する。再同期前後・再生成前後の内容を比較する。
- [x] マスタードキュメント（docs/architecture/）へ design の内容を反映 (after: 3)
  - 完了条件: `docs/architecture/` の用語が design の使い分けに一致していることを確認している。必要な追加反映を行い、Task 2 の用語更新のみで十分な場合は、追加反映が不要である理由を progress.md に記録している。
  - 検証コマンド: 共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。
- [x] ADR の要否判断（必要なら作成） (after: 3)
  - 完了条件: 要否と理由を progress.md に記載し、必要なら templates/adr.md から docs/adr/ に ADR を作成している。作成した文書にも旧語が残っていない。
  - 検証コマンド: 共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。

## 検証方針

| 確認 | 方法 | 受入基準 |
|---|---|---|
| 文脈に応じた語の使い分け | 棚卸し結果と最終差分を照合し、意味・状態・履歴情報の維持を確認 | AC1・AC2 |
| 管理元からの反映 | 管理元の差分、smoke テスト、sync の dry-run と実行結果を記録 | AC3 |
| プロジェクト固有欄の保持 | sync 前後の標準管理領域外を比較 | AC4 |
| スキルの一致 | 対応する `.agents/skills/` と `.claude/skills/` を比較し、check-docs でも確認 | AC4 |
| 旧語の残存なし | 管理元と JotLine の双方で Git 管理対象テキストを検索。新規文書を含め0件であることを確認 | AC3・AC5 |
| 再生成・再同期 | backlog-index、雛形の一時コピー、再 sync で旧語が戻らず、再 sync による差分がないことを確認 | AC6 |
| 文書の整合 | `bash tools/ai-standard/check-docs.sh` が成功 | AC7 |

残存検索には、旧語を `chr(0x6B63) + chr(0x672C)` で組み立てて `git grep -nI -F -e <旧語> -- .` に渡す方法を使う。検索用コードやログで旧語を資材へ書き戻さない。git grep の終了コード1は該当なし、0は残存あり、2以上は検索失敗として区別する。

文言修正と既存の生成・同期の検証を対象とし、新規の用語検査ツールは追加しない。アプリの実装・依存関係・ビルド設定は変更しないため、JotLine のビルド・単体テスト・型検査は既存のものを変更せず、実装時に文言以外の変更が必要と判明した場合は検証範囲を見直す。

詳細な設計書は [notes/001-design.md](notes/001-design.md) を参照。

## 判断ログ

作業中の判断履歴と詳細な作業ログは [notes/002-progress.md](notes/002-progress.md) に保存している。
