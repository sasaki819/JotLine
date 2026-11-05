# tasks: 0008 文脈に応じた「マスター」「原本」への用語統一

<!--
- 1 Task はおおむね1セッションで完結する粒度にする。
- 各 Task に「完了条件」と「検証コマンド」を書く。
- 依存関係がある場合は Task 名の末尾に (after: 2) のように書く。
- 検証コマンドが成功した場合だけチェックを入れる。
- 末尾の2つの固定 Task は削除しない。
-->

## 共通の検証コマンド

旧語残存検査は、対象リポジトリのルートで次を実行する。新規文書も検査するため、最終確認では今回追加したファイルを Git の index に含める。終了コード0を成功とし、旧語の残存と検索エラーは失敗にする。旧語自体を検証コードや記録に書き戻さない。

```bash
python3 -c 'import subprocess; r = subprocess.run(["git", "grep", "-nI", "-F", "-e", chr(0x6B63) + chr(0x672C), "--", "."]); raise SystemExit(0 if r.returncode == 1 else 1)'
```

以下の `<管理元>` と `<JotLine>` は、実装時に確認したリポジトリのルートパスとする。管理元の候補と origin は design.md に記載している。

## Task

- [x] 1. ai-dev-standard の管理元の用語を統一する
  - 完了条件: 管理元・適用先のバージョン、作業ツリー、origin を確認し、管理元も専用の feature ブランチで作業している。両リポジトリの用例を文脈ごとに分類し、管理元の配布用 payload・雛形・スキル・README・テストなどの旧語を「マスター」または「原本」に修正している。VERSION をパッチ更新して CHANGELOG に記録し、管理元の旧語残存検査と smoke テストが成功している。管理元の変更をコミットし、対象ブランチ、版、コミット ID、分類結果と検証結果を JotLine の progress.md に記録している。JotLine の標準管理対象の更新は Task 2 で sync によって行う。
  - 検証コマンド: 管理元で共通の旧語残存検査、`bash tests/smoke.sh`、`git diff --check`。JotLine で `bash tools/ai-standard/check-docs.sh`。smoke 内で実行できず SKIP になった環境があれば progress.md に記録する。
- [ ] 2. 更新した標準を同期し、JotLine の既存資材を統一する (after: 1)
  - 完了条件: 同期前に AGENTS.md のプロジェクト固有欄を比較できる形で保持し、sync の dry-run で用語と版情報以外の変更がないことを確認してから同期している。JotLine の標準管理対象を直接編集していない。プロジェクト所有の文書・既存の記録・本 Item・本 Spec を含めて用語を統一し、既存の日付・ID・状態・チェック・コミット ID・技術的な判断内容を維持している。Item の更新後は BACKLOG.md を再生成し、Git 管理対象のテキストで旧語が0件である。AGENTS.md のプロジェクト固有欄と両方のスキル配布先も確認し、同期元のコミット ID と差分の確認結果を progress.md に記録している。
  - 検証コマンド: `bash <管理元>/sync.sh <JotLine> --dry-run`、`bash <管理元>/sync.sh <JotLine>`、`bash tools/ai-standard/backlog-index.sh`、共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。同期前後の AGENTS.md の標準管理領域外と、manifest に対応する両スキル配布先を比較する。
- [ ] 3. 雛形・再生成・再同期で用語が維持されることを確認する (after: 2)
  - 完了条件: 更新後の Item・Spec の雛形を一時ディレクトリにコピーし、新しい用語で文書を作成できることを確認している。同じ管理元から再同期し、管理対象と版情報に新たな差分が出ず、AGENTS.md のプロジェクト固有欄とスキルの一致が維持されている。BACKLOG.md を再生成しても差分が増えず、管理元と JotLine の双方で旧語残存検査が成功している。文脈ごとの分類と最終差分を照合して AC1〜AC7 の結果を progress.md に記録している。
  - 検証コマンド: `bash <管理元>/sync.sh <JotLine> --dry-run`、`bash <管理元>/sync.sh <JotLine>`、`bash tools/ai-standard/backlog-index.sh`、両リポジトリで共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。雛形の一時コピーは Python などで対象文字列がないことを検査する。再同期前後・再生成前後の内容を比較する。
- [ ] マスタードキュメント（docs/architecture/）へ design の内容を反映 (after: 3)
  - 完了条件: `docs/architecture/` の用語が design の使い分けに一致していることを確認している。必要な追加反映を行い、Task 2 の用語更新のみで十分な場合は、追加反映が不要である理由を progress.md に記録している。
  - 検証コマンド: 共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。
- [ ] ADR の要否判断（必要なら作成） (after: 3)
  - 完了条件: 要否と理由を progress.md に記載し、必要なら templates/adr.md から docs/adr/ に ADR を作成している。作成した文書にも旧語が残っていない。
  - 検証コマンド: 共通の旧語残存検査、`bash tools/ai-standard/check-docs.sh`、`git diff --check`。
