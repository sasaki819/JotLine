# requirements: 0008 文脈に応じた「マスター」「原本」への用語統一

## 背景

システム全体の最新設計を示す文書や開発手順に、用語統一の対象となる旧語（Unicode: U+6B63 U+672C）が使われている。同じ語は ai-dev-standard から配布される雛形・スキルにも含まれ、そのままでは新しい文書にも引き継がれる。

## 目的

唯一の本体・最新の基準となる文書などを「マスター」、派生物を作成する元の資料を「原本」と呼ぶ。プロジェクト資材全体でこの使い分けを統一し、新しい文書の作成や標準の同期によって旧語が再導入されないようにする。

## スコープ

- プロジェクトが保守するテキスト資材全体。通常の文書に加え、隠しディレクトリ内のスキル・テンプレート・設定・スクリプト・ソースのコメントなども対象とする。
- 既存の Spec、progress、Review、Discussion、ADR、Backlog の未完了・アーカイブ済み Item。本 Item と本 Spec 自身も対象に含める。
- AGENTS.md の用語定義、固定 Task の名前、DoD、開発手順、雛形、MR テンプレートなどの関連表現。
- 標準管理対象は管理元の ai-dev-standard を更新したうえで sync で反映する。プロジェクト所有の資材は本プロジェクトで修正する。
- BACKLOG.md など、自動生成する資材への反映。

## スコープ外

- 文言以外の機能・保存形式・開発工程・Review の状態遷移の変更。
- Git の過去のコミット内容の書き換え。
- 外部依存ライブラリ、キャッシュなど、プロジェクトが保守しない資材の変更。

## 受入基準

- [x] AC1: 旧語の各使用箇所を文脈に応じて修正し、唯一の本体・最新の基準を指す場合は「マスター」、派生物の生成元を指す場合は「原本」とする。文書の意味と、完了済み Task・Review などの状態を維持する。
- [x] AC2: `docs/architecture/` を指す用語を「マスタードキュメント」に統一し、用語定義・固定 Task 名・説明・DoD・MR チェックリストの表現も一致させる。
- [x] AC3: `tools/ai-standard/manifest.txt` の管理対象は ai-dev-standard の管理元で修正し、sync で反映する。標準管理対象をプロジェクト側で直接編集しない。管理元と同期後の対象資材の両方に旧語が残っていないことを確認する。
- [x] AC4: AGENTS.md のプロジェクト固有欄（ブランチ運用など）を sync 後も維持し、`.agents/skills/` と `.claude/skills/` の対応する内容が一致する。
- [x] AC5: Git 管理対象のテキスト資材を隠しパスも含めて検索し、旧語が0件である。本 Item・本 Spec・既存の記録も検索対象から除外しない。
- [x] AC6: Item の変更後は backlog-index で BACKLOG.md を再生成する。雛形から作成する文書と、更新した標準を再度 sync した結果にも旧語が再導入されない。
- [x] AC7: `bash tools/ai-standard/check-docs.sh` が成功する。

## 関連

- Item: [backlog/items/0008-replace-seihon-terminology.md](../../backlog/items/0008-replace-seihon-terminology.md)
- Discussion: なし
- ADR: なし
- 標準管理範囲: [manifest](../../tools/ai-standard/manifest.txt)
- 同期手順: [開発プロセス](../../docs/ai-dev-standard-process.md)
