---
name: self-review
description: 実装が終わり機械検証（ビルド・テスト・lint・check-docs）が通った Spec に対して、実装とは別のコンテキストでAIレビューを行い Review ファイルを作成するときに使う。
---

# self-review：AIレビュー

> **このスキルは、実装を行ったのと同じ会話では実行しない。**
> サブエージェント（独立したコンテキストで動く補助エージェント）が使えるなら、レビュー作業をサブエージェントに任せる。
> 使えないなら、ここで作業を止め、新しいセッション（新しい会話）でこのスキルを実行するようユーザーに促す。
> 実装の経緯を知らない状態で、文書と成果物だけを根拠にレビューするためである。

## 入力

- 対象 Spec のパス（`specs/<ID>-<slug>/`）
- レビュー対象（`requirements` / `design` / `impl` など。指定がなければ `impl`）

## 手順

1. 対象 Spec の requirements.md、design.md、tasks.md を読み、実装の差分（Item のブランチとベースブランチの差分など）を確認する。
2. 機械検証（ビルド、テスト、lint、check-docs）が通っていることを確認する。通っていなければレビューせず、その旨を報告する。
3. 次の観点でレビューする。
   - 要件への適合：受入基準をすべて満たしているか
   - design との整合：design.md と実装が一致しているか
   - テストの十分性：受入基準と主要な分岐がテストされているか
   - エラー処理：異常系が design どおりに扱われているか
   - セキュリティ：入力検証、認証・認可、秘密情報の扱いなど
   - 規約：AGENTS.md とプロジェクトの規約に沿っているか
4. `templates/review.md` を `specs/<ID>-<slug>/reviews/YYYY-MM-DD-<target>-ai.md` にコピーする（同じ日に同名がある場合は末尾に `-2` などを付ける）。frontmatter を埋める：`target`、`reviewer: ai`、`by`（モデル名）、`perspective`（観点の要約）、`date`。
5. Finding を表に1行ずつ記録する。ID は `R1` から連番、重大度は High / Medium / Low、状態はすべて `open`、対応欄は空にする。指摘には、場所（ファイルと行など）と理由を具体的に書く。指摘がない場合は表の例の行を削除し、表の下に「指摘なし」と書く。
6. check-docs を実行する。

## 出力

- Review ファイル
- Finding の件数（重大度別）の要約。次は人が Finding を選別する（open → accepted / wontfix）ことを伝える

## 禁止事項

- コードや文書を修正しない。Review ファイルを作成するだけにする。
- Finding の状態を `open` 以外で起票しない（accepted / wontfix の判定は人が行う）。
